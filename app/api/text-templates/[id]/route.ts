import { route, readJson } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { textTemplateSchema } from "@/lib/validation/templates";
import { idParamsSchema } from "@/lib/validation/common";
import { conflict, notFound } from "@/lib/errors";
import { textTemplateUsage, updateTextTemplate } from "@/services/text-template.service";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";
import { auditFromCtx } from "@/lib/audit";

export const GET = route<{ id: string }>({ permission: "templates:view" }, async ({ params }) => {
  const { id } = idParamsSchema.parse(params);
  const t = await prisma.replyTemplate.findUnique({ where: { id } });
  if (!t) throw notFound("ไม่พบข้อความ");
  return { ...t, usage: await textTemplateUsage(id) };
});

export const PUT = route<{ id: string }>({ permission: "templates:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const before = await prisma.replyTemplate.findUnique({ where: { id } });
  if (!before) throw notFound("ไม่พบข้อความ");
  const input = textTemplateSchema.parse(await readJson(ctx.req));
  const t = await updateTextTemplate(id, input);
  invalidateRuleCache();
  await auditFromCtx(ctx)({
    action: "text_template.update",
    entityType: "ReplyTemplate",
    entityId: id,
    summary: `แก้ไขข้อความ "${t.name}"`,
    metadata: { before: { name: before.name, content: before.content }, after: input },
  });
  return t;
});

export const DELETE = route<{ id: string }>({ permission: "templates:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const t = await prisma.replyTemplate.findUnique({ where: { id } });
  if (!t) throw notFound("ไม่พบข้อความ");
  const usage = await textTemplateUsage(id);
  if (usage.rules > 0) throw conflict(`ไม่สามารถลบได้ เนื่องจากถูกใช้งานในกฎตอบกลับ ${usage.rules} กฎ`);
  if (usage.usedAsDefault) throw conflict("ไม่สามารถลบได้ เนื่องจากถูกใช้เป็น Default Reply");
  await prisma.replyTemplate.delete({ where: { id } });
  await auditFromCtx(ctx)({ action: "text_template.delete", entityType: "ReplyTemplate", entityId: id, summary: `ลบข้อความ "${t.name}"`, metadata: { content: t.content } });
  return { ok: true };
});
