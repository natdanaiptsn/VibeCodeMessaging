import "server-only";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/templates/variables";
import { LINE_LIMITS } from "@/lib/line/limits";
import type { LineOutgoingText } from "@/lib/line/types";
import type { TextTemplateInput } from "@/lib/validation/templates";
import { getSettings } from "@/services/settings.service";

export function renderTextMessage(content: string, values: Record<string, string>): LineOutgoingText {
  const text = [...renderTemplate(content, values)].slice(0, LINE_LIMITS.TEXT_MAX_CHARS).join("");
  return { type: "text", text };
}

/** จำนวนกฎที่ใช้ Template นี้ (นับกฎไม่ซ้ำ แม้ใช้หลายข้อความในกฎเดียวกัน) */
function countRules(ruleMessages: { ruleId: string }[]) {
  return new Set(ruleMessages.map((m) => m.ruleId)).size;
}

export async function listTextTemplates(projectId: string, search?: string) {
  const items = await prisma.replyTemplate.findMany({
    where: {
      projectId,
      ...(search
        ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { content: { contains: search, mode: "insensitive" } }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: { ruleMessages: { select: { ruleId: true } } },
  });
  return items.map(({ ruleMessages, ...t }) => ({ ...t, _count: { rules: countRules(ruleMessages) } }));
}

export async function getTextTemplate(projectId: string, id: string) {
  return prisma.replyTemplate.findFirst({ where: { id, projectId } });
}

export async function createTextTemplate(projectId: string, input: TextTemplateInput, userId: string) {
  return prisma.replyTemplate.create({
    data: { projectId, name: input.name, description: input.description ?? null, content: input.content, createdById: userId },
  });
}

export async function updateTextTemplate(id: string, input: TextTemplateInput) {
  return prisma.replyTemplate.update({
    where: { id },
    data: { name: input.name, description: input.description ?? null, content: input.content },
  });
}

export async function textTemplateUsage(projectId: string, id: string) {
  const [rules, settings] = await Promise.all([
    prisma.replyRule.count({ where: { messages: { some: { textTemplateId: id } } } }),
    getSettings(projectId),
  ]);
  const usedAsDefault = settings.defaultReply.textTemplateId === id;
  return { rules, usedAsDefault };
}
