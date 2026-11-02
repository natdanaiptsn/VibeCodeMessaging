import { projectRoute, readJson } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { flexTemplateSchema } from "@/lib/validation/templates";
import { idParamsSchema } from "@/lib/validation/common";
import { conflict, notFound } from "@/lib/errors";
import { flexTemplateUsage, getFlexTemplate, updateFlexTemplate } from "@/services/flex-message.service";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";
import { auditFromCtx } from "@/lib/audit";

export const GET = projectRoute<{ id: string }>({ permission: "templates:view" }, async ({ params, project }) => {
  const { id } = idParamsSchema.parse(params);
  const t = await getFlexTemplate(project.id, id);
  if (!t) throw notFound("ไม่พบ Flex Template");
  return { ...t, usage: await flexTemplateUsage(project.id, id) };
});

export const PUT = projectRoute<{ id: string }>({ permission: "flex:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const before = await getFlexTemplate(ctx.project.id, id);
  if (!before) throw notFound("ไม่พบ Flex Template");
  const input = flexTemplateSchema.parse(await readJson(ctx.req, 256 * 1024));
  const t = await updateFlexTemplate(id, input);
  invalidateRuleCache(ctx.project.id);
  await auditFromCtx(ctx)({ action: "flex_template.update", entityType: "FlexTemplate", entityId: id, summary: `แก้ไข Flex "${t.name}"` });
  return t;
});

export const DELETE = projectRoute<{ id: string }>({ permission: "flex:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const t = await getFlexTemplate(ctx.project.id, id);
  if (!t) throw notFound("ไม่พบ Flex Template");
  const usage = await flexTemplateUsage(ctx.project.id, id);
  if (usage.rules > 0) throw conflict(`ไม่สามารถลบได้ เนื่องจากถูกใช้งานในกฎตอบกลับ ${usage.rules} กฎ`);
  if (usage.usedAsDefault) throw conflict("ไม่สามารถลบได้ เนื่องจากถูกใช้เป็น Default Reply");
  await prisma.flexTemplate.delete({ where: { id } });
  await auditFromCtx(ctx)({ action: "flex_template.delete", entityType: "FlexTemplate", entityId: id, summary: `ลบ Flex "${t.name}"` });
  return { ok: true };
});
