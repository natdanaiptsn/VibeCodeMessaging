import { projectRoute, readJson } from "@/lib/api/handler";
import { textTemplateSchema } from "@/lib/validation/templates";
import { createTextTemplate, listTextTemplates } from "@/services/text-template.service";
import { auditFromCtx } from "@/lib/audit";

export const GET = projectRoute({ permission: "templates:view" }, async ({ req, project }) => {
  const search = req.nextUrl.searchParams.get("search")?.trim().slice(0, 200) || undefined;
  return listTextTemplates(project.id, search);
});

export const POST = projectRoute({ permission: "templates:manage" }, async (ctx) => {
  const input = textTemplateSchema.parse(await readJson(ctx.req));
  const t = await createTextTemplate(ctx.project.id, input, ctx.session.user.id);
  await auditFromCtx(ctx)({ action: "text_template.create", entityType: "ReplyTemplate", entityId: t.id, summary: `สร้างข้อความ "${t.name}"` });
  return t;
});
