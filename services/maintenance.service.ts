import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getSettings } from "@/services/settings.service";

const DAY = 24 * 60 * 60 * 1000;

/** ลบข้อมูลตามระยะเวลาเก็บรักษาที่ตั้งค่าไว้ และล้างข้อมูลชั่วคราว */
export async function runMaintenance() {
  const settings = await getSettings();
  const now = Date.now();
  const results: Record<string, number> = {};

  // Reply Token ใช้ได้ระยะสั้นเท่านั้น — ลบทิ้งหากค้างเกิน 10 นาที
  results.clearedReplyTokens = (
    await prisma.webhookEvent.updateMany({
      where: { replyTokenEnc: { not: null }, createdAt: { lt: new Date(now - 10 * 60 * 1000) } },
      data: { replyTokenEnc: null },
    })
  ).count;

  results.expiredSessions = (await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date(now) } } })).count;

  results.webhookEvents = (
    await prisma.webhookEvent.deleteMany({
      where: {
        status: { in: ["PROCESSED", "SKIPPED", "FAILED"] },
        createdAt: { lt: new Date(now - settings.logging.webhookEventRetentionDays * DAY) },
      },
    })
  ).count;

  if (settings.logging.replyLogRetentionDays > 0) {
    results.replyLogs = (
      await prisma.replyLog.deleteMany({
        where: { createdAt: { lt: new Date(now - settings.logging.replyLogRetentionDays * DAY) } },
      })
    ).count;
  }
  logger.info("Maintenance completed", results);
  return results;
}
