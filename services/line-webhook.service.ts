import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encrypt, sha256Hex } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { verifyLineSignature } from "@/lib/line/signature";
import { LINE_LIMITS } from "@/lib/line/limits";
import { getLineCredentials } from "@/services/line-account.service";
import type { Prisma } from "@/lib/generated/prisma/client";

const eventSchema = z
  .object({
    type: z.string().min(1).max(50),
    mode: z.string().max(20).optional(),
    timestamp: z.number().int().positive(),
    webhookEventId: z.string().min(1).max(100).optional(),
    replyToken: z.string().max(200).optional(),
    source: z
      .object({
        type: z.string().max(20),
        userId: z.string().max(100).optional(),
        groupId: z.string().max(100).optional(),
        roomId: z.string().max(100).optional(),
      })
      .loose()
      .optional(),
    deliveryContext: z.object({ isRedelivery: z.boolean() }).loose().optional(),
  })
  .loose();

const bodySchema = z.object({
  destination: z.string().max(100),
  events: z.array(eventSchema).max(500),
});

export type WebhookResult =
  | { ok: true; received: number; inserted: number; duplicates: number }
  | { ok: false; status: number; message: string };

/**
 * รับ Webhook จาก LINE
 * 1) ตรวจสอบ X-Line-Signature กับ raw body  2) ป้องกัน Event ซ้ำด้วย webhookEventId
 * 3) บันทึกลงคิว (WebhookEvent) — การประมวลผลจริงทำใน Background Worker
 */
export async function ingestWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
  if (Buffer.byteLength(rawBody) > LINE_LIMITS.WEBHOOK_BODY_MAX_BYTES) {
    return { ok: false, status: 413, message: "Payload too large" };
  }
  const creds = await getLineCredentials();
  if (!creds.channelSecret) {
    logger.error("Webhook received but LINE Channel Secret is not configured");
    return { ok: false, status: 503, message: "Channel secret is not configured" };
  }
  if (!verifyLineSignature(creds.channelSecret, rawBody, signature)) {
    logger.warn("Rejected webhook with invalid signature");
    return { ok: false, status: 401, message: "Invalid signature" };
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(rawBody));
  } catch {
    return { ok: false, status: 400, message: "Invalid webhook body" };
  }

  await prisma.lineAccount.update({
    where: { id: creds.accountId },
    data: { lastWebhookAt: new Date(), ...(parsed.destination ? { botUserId: parsed.destination } : {}) },
  }).catch((err) => logger.warn("Failed to update lineAccount webhook info", err));

  // LINE Developers "Verify" จะส่ง events เป็น array ว่าง
  if (parsed.events.length === 0) return { ok: true, received: 0, inserted: 0, duplicates: 0 };

  const rows: Prisma.WebhookEventCreateManyInput[] = parsed.events.map((event) => {
    const { replyToken, ...rest } = event;
    const webhookEventId = event.webhookEventId ?? `hash:${sha256Hex(JSON.stringify(rest))}`;
    return {
      lineAccountId: creds.accountId,
      webhookEventId,
      type: event.type,
      mode: event.mode ?? null,
      sourceType: event.source?.type ?? null,
      sourceUserId: event.source?.userId ?? null,
      eventTimestamp: new Date(event.timestamp),
      isRedelivery: event.deliveryContext?.isRedelivery ?? false,
      payload: rest as Prisma.InputJsonValue, // ไม่เก็บ replyToken ใน payload
      replyTokenEnc: replyToken ? encrypt(replyToken) : null,
      status: "PENDING",
    };
  });

  const inserted = await prisma.webhookEvent.createManyAndReturn({
    data: rows,
    skipDuplicates: true,
    select: { id: true },
  });
  const duplicates = rows.length - inserted.length;
  if (duplicates > 0) logger.info("Skipped duplicate webhook events", { duplicates });
  return { ok: true, received: rows.length, inserted: inserted.length, duplicates };
}
