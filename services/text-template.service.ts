import "server-only";
import { prisma } from "@/lib/prisma";
import { renderTemplate } from "@/lib/templates/variables";
import { LINE_LIMITS } from "@/lib/line/limits";
import type { LineOutgoingText } from "@/lib/line/types";
import type { TextTemplateInput } from "@/lib/validation/templates";

export function renderTextMessage(content: string, values: Record<string, string>): LineOutgoingText {
  const text = [...renderTemplate(content, values)].slice(0, LINE_LIMITS.TEXT_MAX_CHARS).join("");
  return { type: "text", text };
}

export async function listTextTemplates(search?: string) {
  return prisma.replyTemplate.findMany({
    where: search
      ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { content: { contains: search, mode: "insensitive" } }] }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: { _count: { select: { rules: true } } },
  });
}

export async function createTextTemplate(input: TextTemplateInput, userId: string) {
  return prisma.replyTemplate.create({
    data: { name: input.name, description: input.description ?? null, content: input.content, createdById: userId },
  });
}

export async function updateTextTemplate(id: string, input: TextTemplateInput) {
  return prisma.replyTemplate.update({
    where: { id },
    data: { name: input.name, description: input.description ?? null, content: input.content },
  });
}

export async function textTemplateUsage(id: string) {
  const [rules, settings] = await Promise.all([
    prisma.replyRule.count({ where: { textTemplateId: id } }),
    prisma.systemSetting.findUnique({ where: { key: "defaultReply" } }),
  ]);
  const usedAsDefault = (settings?.value as { textTemplateId?: string } | null)?.textTemplateId === id;
  return { rules, usedAsDefault };
}
