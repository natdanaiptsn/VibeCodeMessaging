import { route, readJson } from "@/lib/api/handler";
import { settingsUpdateSchema } from "@/lib/validation/settings";
import { getSettings, updateSettings } from "@/services/settings.service";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/errors";
import { auditFromCtx } from "@/lib/audit";

export const GET = route({ permission: "settings:view" }, async () => getSettings());

export const PUT = route({ permission: "settings:manage" }, async (ctx) => {
  const input = settingsUpdateSchema.parse(await readJson(ctx.req));
  const dr = input.defaultReply;
  if (dr?.textTemplateId) {
    const t = await prisma.replyTemplate.findUnique({ where: { id: dr.textTemplateId }, select: { id: true } });
    if (!t) throw badRequest("ไม่พบข้อความที่เลือกสำหรับ Default Reply");
  }
  if (dr?.flexTemplateId) {
    const f = await prisma.flexTemplate.findUnique({ where: { id: dr.flexTemplateId }, select: { id: true } });
    if (!f) throw badRequest("ไม่พบ Flex Message ที่เลือกสำหรับ Default Reply");
  }
  const before = await getSettings();
  const settings = await updateSettings(input, ctx.session.user.id);
  await auditFromCtx(ctx)({
    action: "settings.update",
    entityType: "SystemSetting",
    summary: `แก้ไขการตั้งค่า: ${Object.keys(input).join(", ")}`,
    metadata: {
      before: Object.fromEntries(Object.keys(input).map((k) => [k, before[k as keyof typeof before]])),
      after: input,
    },
  });
  return settings;
});
