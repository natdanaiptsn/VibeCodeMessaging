import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/auto-reply/normalize";
import { badRequest } from "@/lib/errors";
import { KEYWORD_TRIGGERS, type RuleInput } from "@/lib/validation/rules";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";
import type { Prisma, RuleTrigger } from "@/lib/generated/prisma/client";

const ruleInclude = {
  keywords: { select: { id: true, keyword: true }, orderBy: { createdAt: "asc" } },
  textTemplate: { select: { id: true, name: true, content: true } },
  flexTemplate: { select: { id: true, name: true, altText: true } },
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

async function assertTemplates(input: RuleInput) {
  if (input.replyType === "TEXT") {
    const t = await prisma.replyTemplate.findUnique({ where: { id: input.textTemplateId! }, select: { id: true } });
    if (!t) throw badRequest("ไม่พบข้อความตอบกลับที่เลือก", [{ path: "textTemplateId", message: "ไม่พบข้อความ" }]);
  } else {
    const f = await prisma.flexTemplate.findUnique({ where: { id: input.flexTemplateId! }, select: { id: true } });
    if (!f) throw badRequest("ไม่พบ Flex Message ที่เลือก", [{ path: "flexTemplateId", message: "ไม่พบ Flex Message" }]);
  }
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
    replyType: input.replyType,
    textTemplateId: input.replyType === "TEXT" ? input.textTemplateId! : null,
    flexTemplateId: input.replyType === "FLEX" ? input.flexTemplateId! : null,
  };
}

export async function listRules(q: { search?: string; trigger?: RuleTrigger; status?: "active" | "inactive" }) {
  return prisma.replyRule.findMany({
    where: {
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

export async function getRule(id: string) {
  return prisma.replyRule.findUnique({ where: { id }, include: ruleInclude });
}

export async function createRule(input: RuleInput, userId: string) {
  await assertTemplates(input);
  const rule = await prisma.replyRule.create({
    data: {
      ...ruleData(input),
      createdById: userId,
      updatedById: userId,
      keywords: { create: keywordRows(input) },
    },
    include: ruleInclude,
  });
  invalidateRuleCache();
  return rule;
}

export async function updateRule(id: string, input: RuleInput, userId: string) {
  await assertTemplates(input);
  const rule = await prisma.$transaction(async (tx) => {
    await tx.replyKeyword.deleteMany({ where: { ruleId: id } });
    return tx.replyRule.update({
      where: { id },
      data: { ...ruleData(input), updatedById: userId, keywords: { create: keywordRows(input) } },
      include: ruleInclude,
    });
  });
  invalidateRuleCache();
  return rule;
}

export async function patchRule(id: string, data: { isActive?: boolean; priority?: number }, userId: string) {
  const rule = await prisma.replyRule.update({ where: { id }, data: { ...data, updatedById: userId }, include: ruleInclude });
  invalidateRuleCache();
  return rule;
}

export async function deleteRule(id: string) {
  await prisma.replyRule.delete({ where: { id } });
  invalidateRuleCache();
}
