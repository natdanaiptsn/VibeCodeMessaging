import { projectRoute, readJson } from "@/lib/api/handler";
import { flexTemplateSchema } from "@/lib/validation/templates";
import { createFlexTemplate, listFlexTemplates } from "@/services/flex-message.service";
import { auditFromCtx } from "@/lib/audit";

export const GET = projectRoute({ permission: "templates:view" }, async ({ req, project }) => {
  const search = req.nextUrl.searchParams.get("search")?.trim().slice(0, 200) || undefined;
  return listFlexTemplates(project.id, search);
});

export const POST = projectRoute({ permission: "flex:manage" }, async (ctx) => {
  const input = flexTemplateSchema.parse(await readJson(ctx.req, 256 * 1024));
  const t = await createFlexTemplate(ctx.project.id, input, ctx.session.user.id);
  await auditFromCtx(ctx)({ action: "flex_template.create", entityType: "FlexTemplate", entityId: t.id, summary: `สร้าง Flex "${t.name}"` });
  return t;
});
