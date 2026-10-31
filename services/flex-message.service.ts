import "server-only";
import { prisma } from "@/lib/prisma";
import { renderFlexVariables } from "@/lib/flex/render";
import { validateFlexMessage, type FlexValidationResult } from "@/lib/flex/validate";
import { renderTemplate } from "@/lib/templates/variables";
import type { LineOutgoingFlex } from "@/lib/line/types";
import type { FlexTemplateInput } from "@/lib/validation/templates";
import type { Prisma } from "@/lib/generated/prisma/client";

export type RenderedFlex = { ok: true; message: LineOutgoingFlex } | { ok: false; error: string; validation: FlexValidationResult };

/** แทนค่าตัวแปรและตรวจสอบ Flex Message ก่อนส่ง LINE */
export function renderFlexMessage(
  template: { altText: string; contents: unknown },
  values: Record<string, string>,
): RenderedFlex {
  const contents = renderFlexVariables(template.contents, values) as Record<string, unknown>;
  const altText = [...renderTemplate(template.altText, values)].slice(0, 400).join("");
  const validation = validateFlexMessage(altText, contents);
  if (!validation.valid) {
    const first = validation.errors[0];
    return { ok: false, error: `Flex Message ไม่ผ่านการตรวจสอบ: ${first?.path} ${first?.message}`, validation };
  }
  return { ok: true, message: { type: "flex", altText, contents } };
}

export function containerTypeOf(contents: unknown): string {
  return (contents as { type?: string })?.type === "carousel" ? "carousel" : "bubble";
}

export async function listFlexTemplates(search?: string) {
  return prisma.flexTemplate.findMany({
    where: search ? { name: { contains: search, mode: "insensitive" } } : undefined,
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      name: true,
      description: true,
      altText: true,
      containerType: true,
      contents: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { rules: true } },
    },
  });
}

export async function createFlexTemplate(input: FlexTemplateInput, userId: string) {
  return prisma.flexTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      altText: input.altText,
      containerType: containerTypeOf(input.contents),
      contents: input.contents as Prisma.InputJsonValue,
      createdById: userId,
    },
  });
}

export async function updateFlexTemplate(id: string, input: FlexTemplateInput) {
  return prisma.flexTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      altText: input.altText,
      containerType: containerTypeOf(input.contents),
      contents: input.contents as Prisma.InputJsonValue,
    },
  });
}

export async function flexTemplateUsage(id: string) {
  const [rules, settings] = await Promise.all([
    prisma.replyRule.count({ where: { flexTemplateId: id } }),
    prisma.systemSetting.findUnique({ where: { key: "defaultReply" } }),
  ]);
  const usedAsDefault = (settings?.value as { flexTemplateId?: string } | null)?.flexTemplateId === id;
  return { rules, usedAsDefault };
}
