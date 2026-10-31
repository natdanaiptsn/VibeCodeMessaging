import { route, readJson } from "@/lib/api/handler";
import { flexTemplateSchema } from "@/lib/validation/templates";
import { createFlexTemplate, listFlexTemplates } from "@/services/flex-message.service";
import { auditFromCtx } from "@/lib/audit";

export const GET = route({ permission: "templates:view" }, async ({ req }) => {
  const search = req.nextUrl.searchParams.get("search")?.trim().slice(0, 200) || undefined;
  return listFlexTemplates(search);
});

export const POST = route({ permission: "flex:manage" }, async (ctx) => {
  const input = flexTemplateSchema.parse(await readJson(ctx.req, 256 * 1024));
  const t = await createFlexTemplate(input, ctx.session.user.id);
  await auditFromCtx(ctx)({ action: "flex_template.create", entityType: "FlexTemplate", entityId: t.id, summary: `สร้าง Flex "${t.name}"` });
  return t;
});
