import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deterministicUuid } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { conflict, badRequest } from "@/lib/errors";
import { lineApi, LineApiError, describeLineError, type LineResponse, type SentMessages } from "@/services/line-messaging.service";
import { outgoingToRecord, previewText } from "@/services/message.service";
import { invalidateRuleCache, type MatchedRuleInfo } from "@/services/auto-reply-engine.service";
import type { LineOutgoingMessage } from "@/lib/line/types";
import type { SystemSettings } from "@/lib/validation/settings";
import type { Prisma, ReplyContentType, ReplyLog, ReplySource } from "@/lib/generated/prisma/client";

type Customer = { id: string; lineUserId: string; lineAccountId: string; isFollowing: boolean };

function replyTypeOf(messages: LineOutgoingMessage[]): ReplyContentType {
  const types = new Set(messages.map((m) => m.type));
  if (types.size > 1) return "MIXED";
  return types.has("flex") ? "FLEX" : "TEXT";
}

function responseSummary(res: LineResponse<SentMessages>, store: boolean): Prisma.InputJsonValue | undefined {
  if (!store) return undefined;
  return {
    sentMessages: (res.data?.sentMessages ?? []).map((m) => ({ id: m.id })),
    ...(res.acceptedRequestId ? { acceptedRequestId: res.acceptedRequestId, duplicate: true } : {}),
  };
}

/** บันทึกผลสำเร็จ + สร้างข้อความขาออก + อัปเดตสถิติกฎ (ใน transaction เดียว) */
async function finalizeSuccess(params: {
  log: ReplyLog;
  customer: Customer;
  messages: LineOutgoingMessage[];
  response: LineResponse<SentMessages>;
  method: "REPLY" | "PUSH";
  settings: SystemSettings;
  sourceMessageId?: string | null;
  ruleIds?: string[];
  sentById?: string | null;
}) {
  const { log, customer, messages, response, method, settings } = params;
  const sent = response.data?.sentMessages ?? [];
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.replyLog.update({
      where: { id: log.id },
      data: {
        status: "SUCCESS",
        method,
        responseStatus: response.status,
        responseBody: responseSummary(response, settings.logging.storeLineResponse),
        lineRequestId: response.requestId ?? response.acceptedRequestId,
        errorMessage: null,
        completedAt: now,
      },
    });
    // ถ้าเป็นคำขอซ้ำ (409 + retry key) ข้อความถูกบันทึกไปแล้วในครั้งก่อน
    if (response.status !== 409) {
      for (const [i, m] of messages.entries()) {
        const rec = outgoingToRecord(m);
        await tx.message.create({
          data: {
            lineAccountId: customer.lineAccountId,
            customerId: customer.id,
            direction: "OUTBOUND",
            type: rec.type,
            text: rec.text,
            payload: rec.payload,
            lineMessageId: sent[i]?.id ?? null,
            status: "SENT",
            sentById: params.sentById ?? null,
            replyLogId: log.id,
            timestamp: new Date(now.getTime() + i),
          },
        });
      }
      const last = outgoingToRecord(messages[messages.length - 1]!);
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          lastMessageAt: now,
          lastMessageText: previewText(last.type, last.text).slice(0, 200),
          lastMessageType: last.type,
          messageCount: { increment: messages.length },
        },
      });
    }
    if (params.sourceMessageId) {
      await tx.message.update({ where: { id: params.sourceMessageId }, data: { status: "REPLIED" } });
    }
    if (params.ruleIds?.length) {
      await tx.replyRule.updateMany({
        where: { id: { in: params.ruleIds } },
        data: { matchCount: { increment: 1 }, lastMatchedAt: now },
      });
    }
  });
}

async function markFailed(logId: string, err: unknown, sourceMessageId?: string | null) {
  const status = err instanceof LineApiError ? err.status : null;
  await prisma.replyLog.update({
    where: { id: logId },
    data: {
      status: "FAILED",
      responseStatus: status,
      responseBody:
        err instanceof LineApiError ? ({ message: err.message, details: err.details } as Prisma.InputJsonValue) : undefined,
      lineRequestId: err instanceof LineApiError ? err.requestId : null,
      errorMessage: describeLineError(err).slice(0, 1000),
      completedAt: new Date(),
    },
  });
  if (sourceMessageId) {
    await prisma.message.update({ where: { id: sourceMessageId }, data: { status: "FAILED" } }).catch(() => undefined);
  }
}

/** บันทึก ReplyLog ที่ล้มเหลวตั้งแต่ขั้นสร้างข้อความ (เช่น Flex ไม่ผ่านการตรวจสอบ) */
export async function logBuildFailure(params: {
  webhookEventId: string;
  customer: Customer;
  sourceMessageId: string | null;
  source: ReplySource;
  matchedRules: MatchedRuleInfo[];
  errors: string[];
}) {
  const primary = params.matchedRules[0];
  await prisma.replyLog.upsert({
    where: { webhookEventId: params.webhookEventId },
    create: {
      lineAccountId: params.customer.lineAccountId,
      customerId: params.customer.id,
      sourceMessageId: params.sourceMessageId,
      webhookEventId: params.webhookEventId,
      ruleId: primary?.id ?? null,
      ruleName: primary?.name ?? null,
      matchedKeyword: primary?.keyword ?? null,
      matchedRules: params.matchedRules as Prisma.InputJsonValue,
      source: params.source,
      method: "REPLY",
      replyType: "TEXT",
      status: "FAILED",
      errorMessage: params.errors.join("\n").slice(0, 1000),
      completedAt: new Date(),
    },
    update: {},
  });
  if (params.sourceMessageId) {
    await prisma.message.update({ where: { id: params.sourceMessageId }, data: { status: "FAILED" } });
  }
}

/**
 * ส่งข้อความตอบกลับอัตโนมัติด้วย Reply API
 * - 1 Webhook Event มี ReplyLog ได้เพียง 1 รายการ (unique) → ป้องกันการตอบซ้ำ
 * - Reply Token หมดอายุ + เปิด Push Fallback → ส่งด้วย Push API พร้อม Retry Key
 */
export async function deliverAutoReply(params: {
  webhookEventId: string;
  customer: Customer;
  sourceMessageId: string | null;
  replyToken: string;
  token: string;
  messages: LineOutgoingMessage[];
  source: ReplySource;
  matchedRules: MatchedRuleInfo[];
  errors: string[];
  settings: SystemSettings;
}): Promise<"SUCCESS" | "FAILED" | "DUPLICATE"> {
  const { customer, messages, settings } = params;
  const existing = await prisma.replyLog.findUnique({ where: { webhookEventId: params.webhookEventId } });
  if (existing?.status === "SUCCESS") return "DUPLICATE";

  const primary = params.matchedRules[0];
  const data = {
    lineAccountId: customer.lineAccountId,
    customerId: customer.id,
    sourceMessageId: params.sourceMessageId,
    ruleId: params.source === "RULE" ? (primary?.id ?? null) : null,
    ruleName: params.source === "RULE" ? (primary?.name ?? null) : "Default Reply",
    matchedKeyword: primary?.keyword ?? null,
    matchedRules: params.matchedRules as Prisma.InputJsonValue,
    source: params.source,
    method: "REPLY" as const,
    replyType: replyTypeOf(messages),
    status: "PROCESSING" as const,
    requestMessages: messages as unknown as Prisma.InputJsonValue,
    errorMessage: params.errors.length ? params.errors.join("\n").slice(0, 1000) : null,
    startedAt: new Date(),
  };
  const log = existing
    ? await prisma.replyLog.update({ where: { id: existing.id }, data: { ...data, attempts: { increment: 1 } } })
    : await prisma.replyLog.create({ data: { ...data, webhookEventId: params.webhookEventId, attempts: 1 } });

  const ruleIds = params.source === "RULE" ? params.matchedRules.map((r) => r.id) : [];
  try {
    const res = await lineApi.reply(params.token, params.replyToken, messages);
    await finalizeSuccess({ log, customer, messages, response: res, method: "REPLY", settings, sourceMessageId: params.sourceMessageId, ruleIds });
    if (ruleIds.length) invalidateRuleCache();
    return "SUCCESS";
  } catch (err) {
    const canFallback =
      err instanceof LineApiError && err.code === "INVALID_REPLY_TOKEN" && settings.general.pushFallbackEnabled && customer.isFollowing;
    if (canFallback) {
      try {
        const retryKey = deterministicUuid(`auto-push:${params.webhookEventId}`);
        await prisma.replyLog.update({ where: { id: log.id }, data: { method: "PUSH", retryKey } });
        const res = await lineApi.push(params.token, customer.lineUserId, messages, retryKey);
        await finalizeSuccess({ log, customer, messages, response: res, method: "PUSH", settings, sourceMessageId: params.sourceMessageId, ruleIds });
        return "SUCCESS";
      } catch (pushErr) {
        await markFailed(log.id, pushErr, params.sourceMessageId);
        return "FAILED";
      }
    }
    await markFailed(log.id, err, params.sourceMessageId);
    return "FAILED";
  }
}

/** ส่งข้อความโดย Admin ผ่าน Push API (ตรวจสอบสิทธิ์และ idempotency ด้วย clientRequestId) */
export async function sendAdminPush(params: {
  customer: Customer;
  messages: LineOutgoingMessage[];
  token: string;
  userId: string;
  clientRequestId: string;
  settings: SystemSettings;
  source?: ReplySource;
  retryOfId?: string;
}): Promise<ReplyLog> {
  const { customer, messages } = params;
  if (!customer.isFollowing) {
    throw badRequest("ลูกค้าเลิกติดตามหรือบล็อกบัญชีแล้ว ไม่สามารถส่งข้อความได้");
  }
  const existing = await prisma.replyLog.findUnique({ where: { retryKey: params.clientRequestId } });
  if (existing) {
    if (existing.status === "SUCCESS") return existing;
    if (existing.status === "PROCESSING" || existing.status === "PENDING") throw conflict("ข้อความนี้กำลังถูกส่งอยู่");
  }
  const log =
    existing ??
    (await prisma.replyLog.create({
      data: {
        lineAccountId: customer.lineAccountId,
        customerId: customer.id,
        source: params.source ?? "ADMIN",
        method: "PUSH",
        replyType: replyTypeOf(messages),
        status: "PROCESSING",
        requestMessages: messages as unknown as Prisma.InputJsonValue,
        retryKey: params.clientRequestId,
        triggeredById: params.userId,
        retryOfId: params.retryOfId ?? null,
        attempts: 1,
        startedAt: new Date(),
      },
    }));
  if (existing) {
    await prisma.replyLog.update({ where: { id: log.id }, data: { status: "PROCESSING", attempts: { increment: 1 } } });
  }
  try {
    const res = await lineApi.push(params.token, customer.lineUserId, messages, params.clientRequestId);
    await finalizeSuccess({ log, customer, messages, response: res, method: "PUSH", settings: params.settings, sentById: params.userId });
  } catch (err) {
    logger.warn("Admin push failed", { customerId: customer.id, error: describeLineError(err) });
    await markFailed(log.id, err);
  }
  return prisma.replyLog.findUniqueOrThrow({ where: { id: log.id } });
}

/** ส่งข้อความที่ล้มเหลวอีกครั้ง (ใช้ Push API เพราะ Reply Token ใช้ได้ครั้งเดียว) */
export async function retryReplyLog(logId: string, ctx: { userId: string; token: string; settings: SystemSettings }) {
  const log = await prisma.replyLog.findUnique({ where: { id: logId }, include: { customer: true } });
  if (!log) throw badRequest("ไม่พบประวัติการตอบกลับ");
  if (log.status !== "FAILED") throw badRequest("ส่งซ้ำได้เฉพาะรายการที่ไม่สำเร็จเท่านั้น");
  if (!log.customer) throw badRequest("ไม่พบข้อมูลลูกค้า");
  const messages = log.requestMessages as unknown as LineOutgoingMessage[] | null;
  if (!Array.isArray(messages) || messages.length === 0) throw badRequest("รายการนี้ไม่มีข้อความให้ส่งซ้ำ");
  const alreadyRetried = await prisma.replyLog.findFirst({ where: { retryOfId: log.id, status: "SUCCESS" } });
  if (alreadyRetried) throw conflict("รายการนี้ถูกส่งซ้ำสำเร็จแล้ว");
  return sendAdminPush({
    customer: log.customer,
    messages,
    token: ctx.token,
    userId: ctx.userId,
    clientRequestId: randomUUID(),
    settings: ctx.settings,
    source: "RETRY",
    retryOfId: log.id,
  });
}
