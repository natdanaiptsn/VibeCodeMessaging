import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/auto-reply/normalize";
import { badRequest, notFound } from "@/lib/errors";
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

async function assertTemplates(projectId: string, input: RuleInput) {
  if (input.replyType === "TEXT") {
    const t = await prisma.replyTemplate.findFirst({ where: { id: input.textTemplateId!, projectId }, select: { id: true } });
    if (!t) throw badRequest("ไม่พบข้อความตอบกลับที่เลือก", [{ path: "textTemplateId", message: "ไม่พบข้อความ" }]);
  } else {
    const f = await prisma.flexTemplate.findFirst({ where: { id: input.flexTemplateId!, projectId }, select: { id: true } });
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
    return tx.replyRule.update({
      where: { id },
      data: { ...ruleData(input), updatedById: userId, keywords: { create: keywordRows(input) } },
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
