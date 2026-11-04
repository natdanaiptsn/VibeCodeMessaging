import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/auto-reply/normalize";
import { badRequest, notFound } from "@/lib/errors";
import { KEYWORD_TRIGGERS, summarizeReplyType, type RuleInput } from "@/lib/validation/rules";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";
import type { Prisma, RuleTrigger } from "@/lib/generated/prisma/client";

const ruleInclude = {
  keywords: { select: { id: true, keyword: true }, orderBy: { createdAt: "asc" } },
  messages: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      position: true,
      type: true,
      text: true,
      textTemplateId: true,
      flexTemplateId: true,
      textTemplate: { select: { id: true, name: true } },
      flexTemplate: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ReplyRuleInclude;

function keywordRows(input: RuleInput) {
  if (!KEYWORD_TRIGGERS.has(input.triggerType)) return [];
  const seen = new Set<string>();
  const rows: { keyword: string; normalizedKeyword: string }[] = [];
  for (const k of input.keywords) {
    const normalized = input.matchType === "REGEX" ? k : normalizeText(k, input.caseSensitive);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    rows.push({ keyword: k, normalizedKeyword: normalized });
  }
  return rows;
}

/** Template ทุกตัวที่เลือกต้องอยู่ในโปรเจกต์นี้ */
async function assertTemplates(projectId: string, input: RuleInput) {
  const textIds = [...new Set(input.messages.flatMap((m) => (m.type === "TEXT" && m.textTemplateId ? [m.textTemplateId] : [])))];
  const flexIds = [...new Set(input.messages.flatMap((m) => (m.type === "FLEX" ? [m.flexTemplateId] : [])))];
  const [texts, flexes] = await Promise.all([
    textIds.length ? prisma.replyTemplate.findMany({ where: { id: { in: textIds }, projectId }, select: { id: true } }) : [],
    flexIds.length ? prisma.flexTemplate.findMany({ where: { id: { in: flexIds }, projectId }, select: { id: true } }) : [],
  ]);
  const found = new Set([...texts, ...flexes].map((t) => t.id));
  input.messages.forEach((m, i) => {
    const id = m.type === "TEXT" ? m.textTemplateId : m.flexTemplateId;
    if (id && !found.has(id)) {
      const what = m.type === "TEXT" ? "ข้อความ (Text Template)" : "Flex Message";
      throw badRequest(`ไม่พบ${what}ที่เลือกในข้อความที่ ${i + 1}`, [
        { path: `messages.${i}.${m.type === "TEXT" ? "textTemplateId" : "flexTemplateId"}`, message: `ไม่พบ${what}` },
      ]);
    }
  });
}

/** แปลงข้อความจากฟอร์มเป็นแถวในฐานข้อมูล (เรียงตามลำดับที่ส่งมา) */
function messageRows(input: RuleInput) {
  return input.messages.map((m, position) =>
    m.type === "TEXT"
      ? {
          position,
          type: "TEXT" as const,
          text: m.textTemplateId ? null : (m.text ?? "").replace(/\r\n/g, "\n"),
          textTemplateId: m.textTemplateId || null,
          flexTemplateId: null,
        }
      : { position, type: "FLEX" as const, text: null, textTemplateId: null, flexTemplateId: m.flexTemplateId },
  );
}

function ruleData(input: RuleInput) {
  return {
    name: input.name,
    description: input.description ?? null,
    isActive: input.isActive,
    priority: input.priority,
    triggerType: input.triggerType,
    matchType: input.matchType,
    keywordLogic: input.keywordLogic,
    caseSensitive: input.caseSensitive,
    replyType: summarizeReplyType(input.messages),
  };
}

export async function listRules(projectId: string, q: { search?: string; trigger?: RuleTrigger; status?: "active" | "inactive" }) {
  return prisma.replyRule.findMany({
    where: {
      projectId,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" } },
              { keywords: { some: { keyword: { contains: q.search, mode: "insensitive" } } } },
            ],
          }
        : {}),
      ...(q.trigger ? { triggerType: q.trigger } : {}),
      ...(q.status ? { isActive: q.status === "active" } : {}),
    },
    orderBy: [{ isActive: "desc" }, { priority: "desc" }, { createdAt: "asc" }],
    include: ruleInclude,
    take: 1000,
  });
}

export async function getRule(projectId: string, id: string) {
  return prisma.replyRule.findFirst({ where: { id, projectId }, include: ruleInclude });
}

async function assertRuleInProject(projectId: string, id: string) {
  const found = await prisma.replyRule.findFirst({ where: { id, projectId }, select: { id: true } });
  if (!found) throw notFound("ไม่พบกฎตอบกลับ");
}

export async function createRule(projectId: string, input: RuleInput, userId: string) {
  await assertTemplates(projectId, input);
  const rule = await prisma.replyRule.create({
    data: {
      projectId,
      ...ruleData(input),
      createdById: userId,
      updatedById: userId,
      keywords: { create: keywordRows(input) },
      messages: { create: messageRows(input) },
    },
    include: ruleInclude,
  });
  invalidateRuleCache(projectId);
  return rule;
}

export async function updateRule(projectId: string, id: string, input: RuleInput, userId: string) {
  await assertRuleInProject(projectId, id);
  await assertTemplates(projectId, input);
  const rule = await prisma.$transaction(async (tx) => {
    await tx.replyKeyword.deleteMany({ where: { ruleId: id } });
    await tx.replyRuleMessage.deleteMany({ where: { ruleId: id } });
    return tx.replyRule.update({
      where: { id },
      data: {
        ...ruleData(input),
        updatedById: userId,
        keywords: { create: keywordRows(input) },
        messages: { create: messageRows(input) },
      },
      include: ruleInclude,
    });
  });
  invalidateRuleCache(projectId);
  return rule;
}

export async function patchRule(projectId: string, id: string, data: { isActive?: boolean; priority?: number }, userId: string) {
  await assertRuleInProject(projectId, id);
  const rule = await prisma.replyRule.update({ where: { id }, data: { ...data, updatedById: userId }, include: ruleInclude });
  invalidateRuleCache(projectId);
  return rule;
}

export async function deleteRule(projectId: string, id: string) {
  await assertRuleInProject(projectId, id);
  await prisma.replyRule.delete({ where: { id } });
  invalidateRuleCache(projectId);
}
