import { z } from "zod";
import { projectRoute, readJson, searchParamsObject } from "@/lib/api/handler";
import { ruleInputSchema, TRIGGERS } from "@/lib/validation/rules";
import { emptyToUndefined, searchSchema } from "@/lib/validation/common";
import { createRule, listRules } from "@/services/rule.service";
import { auditFromCtx } from "@/lib/audit";

const querySchema = z.object({
  search: z.preprocess(emptyToUndefined, searchSchema),
  trigger: z.preprocess(emptyToUndefined, z.enum(TRIGGERS).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(["active", "inactive"]).optional()),
});

export const GET = projectRoute({ permission: "rules:view" }, async ({ req, project }) =>
  listRules(project.id, querySchema.parse(searchParamsObject(req))),
);

export const POST = projectRoute({ permission: "rules:manage" }, async (ctx) => {
  const input = ruleInputSchema.parse(await readJson(ctx.req));
  const rule = await createRule(ctx.project.id, input, ctx.session.user.id);
  await auditFromCtx(ctx)({
    action: "rule.create",
    entityType: "ReplyRule",
    entityId: rule.id,
    summary: `สร้างกฎ "${rule.name}"`,
    metadata: input,
  });
  return rule;
});
