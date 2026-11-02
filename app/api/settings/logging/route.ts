import { route, readJson } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { loggingSchema } from "@/lib/validation/settings";
import { getLoggingSettings, invalidateSettingsCache } from "@/services/settings.service";
import { auditFromCtx } from "@/lib/audit";
import type { Prisma } from "@/lib/generated/prisma/client";

/** การตั้งค่า Log (ใช้ร่วมกันทุกโปรเจกต์) */
export const GET = route({ permission: "settings:view" }, async () => getLoggingSettings());

export const PUT = route({ permission: "settings:manage" }, async (ctx) => {
  const input = loggingSchema.parse(await readJson(ctx.req, 4096));
  const before = await getLoggingSettings();
  await prisma.systemSetting.upsert({
    where: { key: "logging" },
    create: { key: "logging", value: input as Prisma.InputJsonValue, updatedById: ctx.session.user.id },
    update: { value: input as Prisma.InputJsonValue, updatedById: ctx.session.user.id },
  });
  invalidateSettingsCache();
  await auditFromCtx(ctx)({
    action: "settings.update",
    entityType: "SystemSetting",
    summary: "แก้ไขการตั้งค่า: logging",
    metadata: { before, after: input },
  });
  return getLoggingSettings();
});
