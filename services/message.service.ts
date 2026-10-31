import "server-only";
import { prisma } from "@/lib/prisma";
import type { LineWebhookEvent, LineOutgoingMessage } from "@/lib/line/types";
import type { MessageType, Prisma } from "@/lib/generated/prisma/client";
import { truncate } from "@/lib/utils";

export type DescribedEvent = {
  type: MessageType;
  text: string | null;
  payload: Record<string, unknown> | null;
  lineMessageId: string | null;
};

/** แปลง Webhook Event เป็นข้อมูลข้อความสำหรับบันทึก */
export function describeEvent(event: LineWebhookEvent): DescribedEvent | null {
  if (event.type === "message" && "message" in event) {
    const m = event.message as Record<string, unknown> & { id: string; type: string };
    switch (m.type) {
      case "text":
        return {
          type: "TEXT",
          text: String(m.text ?? "").slice(0, 5000),
          payload: m.emojis || m.mention ? { emojis: m.emojis, mention: m.mention } : null,
          lineMessageId: m.id,
        };
      case "image":
        return { type: "IMAGE", text: null, payload: { contentProvider: m.contentProvider, imageSet: m.imageSet }, lineMessageId: m.id };
      case "video":
        return { type: "VIDEO", text: null, payload: { duration: m.duration, contentProvider: m.contentProvider }, lineMessageId: m.id };
      case "audio":
        return { type: "AUDIO", text: null, payload: { duration: m.duration, contentProvider: m.contentProvider }, lineMessageId: m.id };
      case "file":
        return {
          type: "FILE",
          text: typeof m.fileName === "string" ? m.fileName.slice(0, 300) : null,
          payload: { fileName: m.fileName, fileSize: m.fileSize },
          lineMessageId: m.id,
        };
      case "sticker":
        return {
          type: "STICKER",
          text: Array.isArray(m.keywords) ? (m.keywords as string[]).slice(0, 5).join(", ") : null,
          payload: {
            packageId: m.packageId,
            stickerId: m.stickerId,
            stickerResourceType: m.stickerResourceType,
            keywords: Array.isArray(m.keywords) ? (m.keywords as string[]).slice(0, 20) : undefined,
          },
          lineMessageId: m.id,
        };
      case "location":
        return {
          type: "LOCATION",
          text: [m.title, m.address].filter(Boolean).join(" — ").slice(0, 500) || null,
          payload: { title: m.title, address: m.address, latitude: m.latitude, longitude: m.longitude },
          lineMessageId: m.id,
        };
      default:
        return { type: "OTHER", text: null, payload: { messageType: m.type }, lineMessageId: m.id };
    }
  }
  if (event.type === "postback" && "postback" in event) {
    const p = event.postback as { data: string; params?: Record<string, unknown> };
    return { type: "POSTBACK", text: String(p.data ?? "").slice(0, 300), payload: { data: p.data, params: p.params }, lineMessageId: null };
  }
  if (event.type === "follow") {
    const f = (event as { follow?: { isUnblocked?: boolean } }).follow;
    return { type: "FOLLOW", text: null, payload: { isUnblocked: f?.isUnblocked ?? false }, lineMessageId: null };
  }
  if (event.type === "unfollow") return { type: "UNFOLLOW", text: null, payload: null, lineMessageId: null };
  return null;
}

const TYPE_LABEL: Record<MessageType, string> = {
  TEXT: "ข้อความ",
  IMAGE: "รูปภาพ",
  VIDEO: "วิดีโอ",
  AUDIO: "เสียง",
  FILE: "ไฟล์",
  STICKER: "สติกเกอร์",
  LOCATION: "ตำแหน่ง",
  POSTBACK: "Postback",
  FOLLOW: "เพิ่มเพื่อน",
  UNFOLLOW: "เลิกติดตาม/บล็อก",
  FLEX: "Flex Message",
  OTHER: "อื่น ๆ",
};

export function previewText(type: MessageType, text: string | null): string {
  if (type === "TEXT") return truncate(text ?? "", 120);
  const label = `[${TYPE_LABEL[type]}]`;
  return text ? `${label} ${truncate(text, 100)}` : label;
}

export function outgoingToRecord(message: LineOutgoingMessage): { type: MessageType; text: string; payload: Prisma.InputJsonValue } {
  if (message.type === "text") return { type: "TEXT", text: message.text, payload: { kind: "text" } };
  return {
    type: "FLEX",
    text: message.altText,
    payload: { kind: "flex", altText: message.altText, contents: message.contents as Prisma.InputJsonValue },
  };
}

export type ConversationQuery = {
  search?: string;
  messageSearch?: string;
  type?: MessageType;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
};

/** รายการแชทสำหรับ Inbox (เรียงตามข้อความล่าสุด) */
export async function listConversations(q: ConversationQuery) {
  const messageFilter: Prisma.MessageWhereInput = {
    ...(q.messageSearch ? { text: { contains: q.messageSearch, mode: "insensitive" } } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.from || q.to ? { timestamp: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lt: q.to } : {}) } } : {}),
  };
  const hasMessageFilter = Object.keys(messageFilter).length > 0;
  const where: Prisma.CustomerWhereInput = {
    lastMessageAt: { not: null },
    ...(q.search
      ? { OR: [{ displayName: { contains: q.search, mode: "insensitive" } }, { lineUserId: { contains: q.search } }] }
      : {}),
    ...(hasMessageFilter ? { messages: { some: messageFilter } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        isFollowing: true,
        lastMessageAt: true,
        lastMessageText: true,
        lastMessageType: true,
        messages: {
          where: { direction: "INBOUND" },
          orderBy: { timestamp: "desc" },
          take: 1,
          select: { status: true },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);
  return {
    items: items.map(({ messages, ...c }) => ({ ...c, lastInboundStatus: messages[0]?.status ?? null })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export async function listCustomerMessages(
  customerId: string,
  opts: { before?: Date; limit: number; type?: MessageType; search?: string; from?: Date; to?: Date },
) {
  const items = await prisma.message.findMany({
    where: {
      customerId,
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.search ? { text: { contains: opts.search, mode: "insensitive" } } : {}),
      timestamp: {
        ...(opts.before ? { lt: opts.before } : {}),
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lt: opts.to } : {}),
      },
    },
    orderBy: { timestamp: "desc" },
    take: opts.limit + 1,
    select: {
      id: true,
      direction: true,
      type: true,
      text: true,
      payload: true,
      status: true,
      timestamp: true,
      lineMessageId: true,
      sentBy: { select: { id: true, name: true } },
      replyLog: { select: { id: true, status: true, source: true, ruleName: true, errorMessage: true } },
      sourceOf: { select: { id: true, status: true, ruleName: true, errorMessage: true, source: true }, take: 1 },
    },
  });
  const hasMore = items.length > opts.limit;
  const page = items.slice(0, opts.limit).reverse();
  return { items: page, hasMore, nextBefore: hasMore ? page[0]?.timestamp.toISOString() : null };
}
