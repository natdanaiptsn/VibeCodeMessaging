import { projectRoute, readJson } from "@/lib/api/handler";
import { settingsUpdateSchema } from "@/lib/validation/settings";
import { getSettings, updateSettings } from "@/services/settings.service";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/lib/errors";
import { auditFromCtx } from "@/lib/audit";

/** การตั้งค่าของโปรเจกต์ (ทั่วไป / Default Reply) + การตั้งค่า Log ที่ใช้ร่วมกันทุกโปรเจกต์ */
export const GET = projectRoute({ permission: "settings:view" }, async ({ project }) => getSettings(project.id));

export const PUT = projectRoute({ permission: "settings:manage" }, async (ctx) => {
  const input = settingsUpdateSchema.parse(await readJson(ctx.req));
  const dr = input.defaultReply;
  if (dr?.textTemplateId) {
    const t = await prisma.replyTemplate.findFirst({ where: { id: dr.textTemplateId, projectId: ctx.project.id }, select: { id: true } });
    if (!t) throw badRequest("ไม่พบข้อความที่เลือกสำหรับ Default Reply");
  }
  if (dr?.flexTemplateId) {
    const f = await prisma.flexTemplate.findFirst({ where: { id: dr.flexTemplateId, projectId: ctx.project.id }, select: { id: true } });
    if (!f) throw badRequest("ไม่พบ Flex Message ที่เลือกสำหรับ Default Reply");
  }
  const before = await getSettings(ctx.project.id);
  const settings = await updateSettings(ctx.project.id, input, ctx.session.user.id);
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
