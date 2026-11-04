import "server-only";
import { prisma } from "@/lib/prisma";
import { matchRule } from "@/lib/auto-reply/matcher";
import { sandboxedRegexTester } from "@/lib/auto-reply/sandboxed-regex";
import { buildTemplateValues } from "@/lib/templates/variables";
import { KEYWORD_TRIGGERS } from "@/lib/validation/rules";
import { LINE_LIMITS } from "@/lib/line/limits";
import { renderTextMessage } from "@/services/text-template.service";
import { renderFlexMessage } from "@/services/flex-message.service";
import type { LineOutgoingMessage } from "@/lib/line/types";
import type { SystemSettings } from "@/lib/validation/settings";
import type { RuleTrigger, ReplyContentType } from "@/lib/generated/prisma/client";

/**
 * Auto Reply Engine (Rule-based / Keyword Matching — ไม่ใช้ AI)
 *
 * ลำดับการทำงาน:
 * 1. โหลดกฎที่เปิดใช้งานของ trigger นั้น เรียงตาม priority (มาก→น้อย) แล้วตามวันที่สร้าง (เก่า→ใหม่)
 * 2. FIRST_MATCH: ใช้กฎแรกที่ตรง | ALL_MATCHES: ใช้ทุกกฎที่ตรง
 *    แต่ละกฎตอบได้หลายข้อความ (เรียงตามลำดับ) — รวมทั้งหมดไม่เกิน maxMessagesPerReply และไม่เกิน 5 ข้อความ (ข้อจำกัดของ LINE)
 * 3. ไม่พบกฎ → ใช้ Default Reply (ถ้าเปิดใช้งาน และไม่ติด cooldown)
 */

const RULE_CACHE_TTL_MS = 5_000;

async function fetchActiveRules(projectId: string) {
  return prisma.replyRule.findMany({
    where: { projectId, isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: {
      keywords: { select: { keyword: true }, orderBy: { createdAt: "asc" } },
      messages: {
        orderBy: { position: "asc" },
        select: {
          type: true,
          text: true,
          textTemplate: { select: { content: true } },
          flexTemplate: { select: { altText: true, contents: true } },
        },
      },
    },
  });
}

type LoadedRule = Awaited<ReturnType<typeof fetchActiveRules>>[number];

// cache กฎที่เปิดใช้งาน แยกตามโปรเจกต์
const g = globalThis as unknown as { __ruleCacheByProject?: Map<string, { at: number; rules: LoadedRule[] }> };
const ruleCache = (g.__ruleCacheByProject ??= new Map());

export function invalidateRuleCache(projectId?: string) {
  if (projectId) ruleCache.delete(projectId);
  else ruleCache.clear();
}

async function loadActiveRules(projectId: string): Promise<LoadedRule[]> {
  const c = ruleCache.get(projectId);
  if (c && Date.now() - c.at < RULE_CACHE_TTL_MS) return c.rules;
  const rules = await fetchActiveRules(projectId);
  if (ruleCache.size > 200) ruleCache.clear();
  ruleCache.set(projectId, { at: Date.now(), rules });
  return rules;
}

export type MatchedRuleInfo = { id: string; name: string; keyword?: string };

export type EngineResult = {
  source: "RULE" | "DEFAULT" | null;
  messages: LineOutgoingMessage[];
  replyType: ReplyContentType | null;
  matchedRules: MatchedRuleInfo[];
  errors: string[];
  skippedReason?: "AUTO_REPLY_DISABLED" | "NO_MATCH" | "DEFAULT_COOLDOWN" | "BUILD_FAILED";
};

type ReplySpec = {
  replyType: ReplyContentType;
  textTemplate: { content: string } | null;
  flexTemplate: { altText: string; contents: unknown } | null;
};

export function buildReplyMessage(spec: ReplySpec, values: Record<string, string>):
  | { ok: true; message: LineOutgoingMessage }
  | { ok: false; error: string } {
  if (spec.replyType === "TEXT") {
    if (!spec.textTemplate) return { ok: false, error: "ไม่พบข้อความตอบกลับ (Text Template ถูกลบหรือไม่ได้เลือก)" };
    const msg = renderTextMessage(spec.textTemplate.content, values);
    if (!msg.text.trim()) return { ok: false, error: "ข้อความตอบกลับว่างเปล่า" };
    return { ok: true, message: msg };
  }
  if (!spec.flexTemplate) return { ok: false, error: "ไม่พบ Flex Message (ถูกลบหรือไม่ได้เลือก)" };
  const r = renderFlexMessage(spec.flexTemplate, values);
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error };
}

/** สร้างข้อความทั้งหมดของกฎตามลำดับ (ข้อความที่สร้างไม่ได้จะถูกข้ามและรายงานใน errors) */
export function buildRuleMessages(rule: { messages: LoadedRule["messages"] }, values: Record<string, string>) {
  const messages: LineOutgoingMessage[] = [];
  const errors: string[] = [];
  rule.messages.forEach((m, i) => {
    const spec: ReplySpec =
      m.type === "FLEX"
        ? { replyType: "FLEX", textTemplate: null, flexTemplate: m.flexTemplate }
        : { replyType: "TEXT", textTemplate: m.textTemplate ?? (m.text ? { content: m.text } : null), flexTemplate: null };
    const built = buildReplyMessage(spec, values);
    if (built.ok) messages.push(built.message);
    else errors.push(rule.messages.length > 1 ? `ข้อความที่ ${i + 1}: ${built.error}` : built.error);
  });
  if (rule.messages.length === 0) errors.push("กฎนี้ยังไม่มีข้อความตอบกลับ");
  return { messages, errors };
}

function combinedType(messages: LineOutgoingMessage[]): ReplyContentType | null {
  if (messages.length === 0) return null;
  const types = new Set(messages.map((m) => m.type));
  if (types.size > 1) return "MIXED";
  return types.has("flex") ? "FLEX" : "TEXT";
}

export type EngineInput = {
  projectId: string;
  trigger: RuleTrigger;
  text?: string | null;
  customer: { id: string; displayName: string | null; lineUserId: string } | null;
};

/** หา rule ที่ตรงกับข้อความ (ไม่สร้างข้อความ) */
export async function findMatchingRules(
  projectId: string,
  trigger: RuleTrigger,
  text: string | null | undefined,
  mode: SystemSettings["general"]["multiRuleMode"],
  limit: number,
) {
  const rules = (await loadActiveRules(projectId)).filter((r) => r.triggerType === trigger);
  const matched: { rule: LoadedRule; keyword?: string }[] = [];
  let messageCount = 0;
  for (const rule of rules) {
    if (KEYWORD_TRIGGERS.has(trigger)) {
      const r = matchRule(
        {
          matchType: rule.matchType,
          keywordLogic: rule.keywordLogic,
          caseSensitive: rule.caseSensitive,
          keywords: rule.keywords.map((k) => k.keyword),
        },
        text ?? "",
        sandboxedRegexTester,
      );
      if (!r.matched) continue;
      matched.push({ rule, keyword: r.matchedKeyword });
    } else {
      matched.push({ rule });
    }
    // จำกัดตามจำนวนข้อความรวม (กฎหนึ่งอาจมีหลายข้อความ)
    messageCount += Math.max(rule.messages.length, 1);
    if (mode === "FIRST_MATCH" || messageCount >= limit) break;
  }
  return matched;
}

export async function resolveAutoReply(input: EngineInput, settings: SystemSettings): Promise<EngineResult> {
  const base: EngineResult = { source: null, messages: [], replyType: null, matchedRules: [], errors: [] };
  if (!settings.general.autoReplyEnabled) return { ...base, skippedReason: "AUTO_REPLY_DISABLED" };

  const limit = Math.min(settings.general.maxMessagesPerReply, LINE_LIMITS.MAX_MESSAGES_PER_REQUEST);
  const values = buildTemplateValues({
    displayName: input.customer?.displayName,
    userId: input.customer?.lineUserId,
    timezone: settings.general.timezone,
  });

  const matched = await findMatchingRules(input.projectId, input.trigger, input.text, settings.general.multiRuleMode, limit);
  if (matched.length > 0) {
    const messages: LineOutgoingMessage[] = [];
    const used: MatchedRuleInfo[] = [];
    const errors: string[] = [];
    for (const m of matched) {
      if (messages.length >= limit) break;
      const built = buildRuleMessages(m.rule, values);
      errors.push(...built.errors.map((e) => `กฎ "${m.rule.name}": ${e}`));
      const room = limit - messages.length;
      messages.push(...built.messages.slice(0, room));
      if (built.messages.length > room) {
        errors.push(`กฎ "${m.rule.name}": ส่งได้ ${room} จาก ${built.messages.length} ข้อความ (จำกัดไม่เกิน ${limit} ข้อความต่อการตอบกลับ)`);
      }
      if (built.messages.length > 0 || used.length === 0) used.push({ id: m.rule.id, name: m.rule.name, keyword: m.keyword });
    }
    return {
      source: "RULE",
      messages,
      replyType: combinedType(messages),
      matchedRules: used,
      errors,
      skippedReason: messages.length === 0 ? "BUILD_FAILED" : undefined,
    };
  }

  // ─── Default Reply ───
  const dr = settings.defaultReply;
  const eligible =
    dr.enabled &&
    (input.trigger === "TEXT" ||
      (dr.applyToNonText && (input.trigger === "IMAGE" || input.trigger === "STICKER" || input.trigger === "LOCATION")));
  if (!eligible) return { ...base, skippedReason: "NO_MATCH" };

  if (dr.cooldownMinutes > 0 && input.customer) {
    const recent = await prisma.replyLog.findFirst({
      where: {
        customerId: input.customer.id,
        source: "DEFAULT",
        status: "SUCCESS",
        createdAt: { gte: new Date(Date.now() - dr.cooldownMinutes * 60_000) },
      },
      select: { id: true },
    });
    if (recent) return { ...base, skippedReason: "DEFAULT_COOLDOWN" };
  }

  const [textTemplate, flexTemplate] = await Promise.all([
    dr.replyType === "TEXT" && dr.textTemplateId
      ? prisma.replyTemplate.findFirst({ where: { id: dr.textTemplateId, projectId: input.projectId }, select: { content: true } })
      : null,
    dr.replyType === "FLEX" && dr.flexTemplateId
      ? prisma.flexTemplate.findFirst({ where: { id: dr.flexTemplateId, projectId: input.projectId }, select: { altText: true, contents: true } })
      : null,
  ]);
  const built = buildReplyMessage({ replyType: dr.replyType, textTemplate, flexTemplate }, values);
  if (!built.ok) {
    return { ...base, source: "DEFAULT", errors: [`Default Reply: ${built.error}`], skippedReason: "BUILD_FAILED" };
  }
  return { ...base, source: "DEFAULT", messages: [built.message], replyType: combinedType([built.message]) };
}
