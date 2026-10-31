import "server-only";
import { prisma } from "@/lib/prisma";
import { safeDecrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { getSettings } from "@/services/settings.service";
import { getLineCredentials } from "@/services/line-account.service";
import { profileIsStale, syncCustomerProfile, upsertCustomer } from "@/services/customer.service";
import { describeEvent, previewText } from "@/services/message.service";
import { resolveAutoReply } from "@/services/auto-reply-engine.service";
import { deliverAutoReply, logBuildFailure } from "@/services/reply.service";
import type { LineWebhookEvent } from "@/lib/line/types";
import type { Prisma, RuleTrigger, WebhookEvent, WebhookEventStatus } from "@/lib/generated/prisma/client";

export const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [2_000, 10_000, 30_000];

function triggerFor(event: LineWebhookEvent): RuleTrigger | null {
  if (event.type === "follow") return "FOLLOW";
  if (event.type === "postback") return "POSTBACK";
  if (event.type === "message" && "message" in event) {
    const t = (event.message as { type: string }).type;
    if (t === "text") return "TEXT";
    if (t === "image") return "IMAGE";
    if (t === "sticker") return "STICKER";
    if (t === "location") return "LOCATION";
  }
  return null;
}

/**
 * ประมวลผล Webhook Event 1 รายการ
 * 1) บันทึก/อัปเดตลูกค้า 2) บันทึกข้อความ 3) Auto Reply Engine 4) ส่งข้อความกลับ 5) บันทึกผล
 */
async function handleEvent(row: WebhookEvent): Promise<{ status: WebhookEventStatus; note?: string }> {
  const event = row.payload as unknown as LineWebhookEvent;
  const userId = event.source?.userId;
  if (!userId) return { status: "SKIPPED", note: "ไม่มี LINE User ID" };
  if (event.source?.type !== "user") return { status: "SKIPPED", note: "ไม่รองรับแชทกลุ่ม/ห้อง" };

  const described = describeEvent(event);
  if (!described) return { status: "SKIPPED", note: `ไม่รองรับ event ประเภท ${event.type}` };

  const [settings, creds] = await Promise.all([getSettings(), getLineCredentials()]);
  let customer = await upsertCustomer(row.lineAccountId, userId);
  const timestamp = new Date(event.timestamp);

  if (event.type === "follow") {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { isFollowing: true, followedAt: timestamp, unfollowedAt: null },
    });
  } else if (event.type === "unfollow") {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: { isFollowing: false, unfollowedAt: timestamp },
    });
  } else if (!customer.isFollowing) {
    // ลูกค้าส่งข้อความมาได้ = ยังเป็นเพื่อนอยู่
    customer = await prisma.customer.update({ where: { id: customer.id }, data: { isFollowing: true } });
  }

  // ดึงโปรไฟล์ก่อนตอบกลับเฉพาะลูกค้าใหม่ (ต้องใช้ {{displayName}})
  const needsProfile = settings.general.fetchProfileEnabled && event.type !== "unfollow";
  if (needsProfile && !customer.displayName) customer = await syncCustomerProfile(customer, creds.channelAccessToken);

  // idempotent: ถ้าเคยบันทึกข้อความของ Event นี้แล้ว (เช่น retry) จะไม่สร้างซ้ำ
  const existingMessage = await prisma.message.findUnique({ where: { webhookEventId: row.id } });
  const message = existingMessage
    ? await prisma.message.update({ where: { id: existingMessage.id }, data: { status: "PROCESSING" } })
    : await prisma.message.create({
        data: {
          lineAccountId: row.lineAccountId,
          customerId: customer.id,
          webhookEventId: row.id,
          direction: "INBOUND",
          type: described.type,
          text: described.text,
          payload: (described.payload ?? undefined) as Prisma.InputJsonValue | undefined,
          lineMessageId: described.lineMessageId,
          status: "PROCESSING",
          timestamp,
        },
      });
  if (!existingMessage) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        lastMessageAt: timestamp,
        lastMessageText: previewText(described.type, described.text).slice(0, 200),
        lastMessageType: described.type,
        messageCount: { increment: 1 },
      },
    });
  }

  const finishNoReply = async (note: string) => {
    await prisma.message.update({ where: { id: message.id }, data: { status: "NO_REPLY" } });
    return { status: "PROCESSED" as const, note };
  };

  const trigger = triggerFor(event);
  if (!trigger) return finishNoReply("ไม่มีการตอบกลับสำหรับ event นี้");
  if (event.mode === "standby") return finishNoReply("Channel อยู่ในโหมด standby");
  const replyToken = safeDecrypt(row.replyTokenEnc);
  if (!replyToken) return finishNoReply("ไม่มี Reply Token");
  if (!creds.channelAccessToken) return finishNoReply("ยังไม่ได้ตั้งค่า Channel Access Token");

  const result = await resolveAutoReply(
    { trigger, text: described.text, customer: { id: customer.id, displayName: customer.displayName, lineUserId: customer.lineUserId } },
    settings,
  );

  if (result.messages.length === 0) {
    if (result.errors.length && result.source) {
      await logBuildFailure({
        webhookEventId: row.id,
        customer,
        sourceMessageId: message.id,
        source: result.source,
        matchedRules: result.matchedRules,
        errors: result.errors,
      });
      return { status: "PROCESSED", note: result.errors.join("; ") };
    }
    return finishNoReply(result.skippedReason ?? "NO_MATCH");
  }

  const delivery = await deliverAutoReply({
    webhookEventId: row.id,
    customer,
    sourceMessageId: message.id,
    replyToken,
    token: creds.channelAccessToken,
    messages: result.messages,
    source: result.source === "DEFAULT" ? "DEFAULT" : "RULE",
    matchedRules: result.matchedRules,
    errors: result.errors,
    settings,
  });

  // อัปเดตโปรไฟล์ที่เก่าเกิน 24 ชม. หลังตอบกลับแล้ว (ไม่ทำให้การตอบช้า)
  if (needsProfile && profileIsStale(customer)) await syncCustomerProfile(customer, creds.channelAccessToken);

  return { status: "PROCESSED", note: delivery };
}

/** ประมวลผล Event ที่ถูก claim แล้ว (status = PROCESSING) */
export async function processWebhookEvent(id: string): Promise<void> {
  const row = await prisma.webhookEvent.findUnique({ where: { id } });
  if (!row || row.status !== "PROCESSING") return;
  try {
    const result = await handleEvent(row);
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: result.status,
        processedAt: new Date(),
        lockedAt: null,
        replyTokenEnc: null, // ลบ Reply Token ทันทีหลังใช้งาน
        lastError: result.status === "SKIPPED" ? (result.note ?? null) : null,
      },
    });
  } catch (err) {
    const final = row.attempts >= MAX_ATTEMPTS;
    logger.error("Webhook event processing failed", { id, attempts: row.attempts, error: err });
    await prisma.webhookEvent.update({
      where: { id },
      data: {
        status: final ? "FAILED" : "PENDING",
        lockedAt: null,
        availableAt: new Date(Date.now() + (BACKOFF_MS[row.attempts - 1] ?? 30_000)),
        lastError: (err as Error).message?.slice(0, 1000) ?? "Unknown error",
        ...(final ? { replyTokenEnc: null, processedAt: new Date() } : {}),
      },
    });
    if (final) {
      await prisma.message
        .updateMany({ where: { webhookEventId: id, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "FAILED" } })
        .catch(() => undefined);
    }
  }
}
