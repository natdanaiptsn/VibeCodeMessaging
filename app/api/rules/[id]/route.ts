import { z } from "zod";
import { projectRoute, readJson } from "@/lib/api/handler";
import { ruleInputSchema } from "@/lib/validation/rules";
import { idParamsSchema } from "@/lib/validation/common";
import { notFound } from "@/lib/errors";
import { deleteRule, getRule, patchRule, updateRule } from "@/services/rule.service";
import { auditFromCtx } from "@/lib/audit";

export const GET = projectRoute<{ id: string }>({ permission: "rules:view" }, async ({ params, project }) => {
  const { id } = idParamsSchema.parse(params);
  const rule = await getRule(project.id, id);
  if (!rule) throw notFound("ไม่พบกฎตอบกลับ");
  return rule;
});

export const PUT = projectRoute<{ id: string }>({ permission: "rules:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const before = await getRule(ctx.project.id, id);
  if (!before) throw notFound("ไม่พบกฎตอบกลับ");
  const input = ruleInputSchema.parse(await readJson(ctx.req));
  const rule = await updateRule(ctx.project.id, id, input, ctx.session.user.id);
  await auditFromCtx(ctx)({
    action: "rule.update",
    entityType: "ReplyRule",
    entityId: id,
    summary: `แก้ไขกฎ "${rule.name}"`,
    metadata: {
      before: { ...before, keywords: before.keywords.map((k) => k.keyword) },
      after: input,
    },
  });
  return rule;
});

const patchSchema = z
  .object({ isActive: z.boolean().optional(), priority: z.coerce.number().int().min(-1000).max(1000).optional() })
  .refine((d) => d.isActive !== undefined || d.priority !== undefined, "ไม่มีข้อมูลที่ต้องการแก้ไข");

export const PATCH = projectRoute<{ id: string }>({ permission: "rules:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const input = patchSchema.parse(await readJson(ctx.req));
  const rule = await patchRule(ctx.project.id, id, input, ctx.session.user.id);
  await auditFromCtx(ctx)({
    action: input.isActive !== undefined ? (input.isActive ? "rule.enable" : "rule.disable") : "rule.priority",
    entityType: "ReplyRule",
    entityId: id,
    summary: `${input.isActive === undefined ? "เปลี่ยนลำดับความสำคัญ" : input.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}กฎ "${rule.name}"`,
    metadata: input,
  });
  return rule;
});

export const DELETE = projectRoute<{ id: string }>({ permission: "rules:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const rule = await getRule(ctx.project.id, id);
  if (!rule) throw notFound("ไม่พบกฎตอบกลับ");
  await deleteRule(ctx.project.id, id);
  await auditFromCtx(ctx)({
    action: "rule.delete",
    entityType: "ReplyRule",
    entityId: id,
    summary: `ลบกฎ "${rule.name}"`,
    metadata: { ...rule, keywords: rule.keywords.map((k) => k.keyword) },
  });
  return { ok: true };
});
