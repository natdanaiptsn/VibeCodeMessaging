import "server-only";
import { prisma } from "@/lib/prisma";
import { lineApi, LineApiError } from "@/services/line-messaging.service";
import { logger } from "@/lib/logger";
import { sanitizeVariableValue } from "@/lib/templates/variables";
import type { Customer, MessageType, Prisma } from "@/lib/generated/prisma/client";

const PROFILE_STALE_MS = 24 * 60 * 60 * 1000;

export async function upsertCustomer(lineAccountId: string, lineUserId: string) {
  return prisma.customer.upsert({
    where: { lineAccountId_lineUserId: { lineAccountId, lineUserId } },
    create: { lineAccountId, lineUserId, followedAt: new Date() },
    update: {},
  });
}

export function profileIsStale(customer: Pick<Customer, "profileSyncedAt" | "displayName">) {
  if (!customer.displayName) return true;
  return !customer.profileSyncedAt || Date.now() - customer.profileSyncedAt.getTime() > PROFILE_STALE_MS;
}

/** ดึง Display Name / รูปโปรไฟล์จาก LINE (ถ้าเรียกได้) */
export async function syncCustomerProfile(customer: Customer, token: string | null): Promise<Customer> {
  if (!token) return customer;
  try {
    const { data } = await lineApi.getProfile(token, customer.lineUserId);
    return await prisma.customer.update({
      where: { id: customer.id },
      data: {
        displayName: data.displayName ? sanitizeVariableValue(data.displayName, 100) : customer.displayName,
        pictureUrl: data.pictureUrl ?? null,
        statusMessage: data.statusMessage ? data.statusMessage.slice(0, 500) : null,
        language: data.language ?? null,
        profileSyncedAt: new Date(),
      },
    });
  } catch (err) {
    // 404 = ผู้ใช้ไม่ได้เป็นเพื่อน/บล็อกบัญชี — ไม่ถือเป็นข้อผิดพลาดร้ายแรง
    if (!(err instanceof LineApiError && err.status === 404)) {
      logger.warn("Failed to fetch LINE profile", { customerId: customer.id, error: (err as Error).message });
    }
    return prisma.customer.update({ where: { id: customer.id }, data: { profileSyncedAt: new Date() } });
  }
}

export async function touchCustomerLastMessage(
  customerId: string,
  info: { at: Date; preview: string; type: MessageType },
) {
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      lastMessageAt: info.at,
      lastMessageText: info.preview.slice(0, 200),
      lastMessageType: info.type,
      messageCount: { increment: 1 },
    },
  });
}

export type CustomerListQuery = {
  search?: string;
  following?: "all" | "following" | "unfollowed";
  page: number;
  pageSize: number;
};

export async function listCustomers(q: CustomerListQuery) {
  const where: Prisma.CustomerWhereInput = {
    ...(q.search
      ? {
          OR: [
            { displayName: { contains: q.search, mode: "insensitive" } },
            { lineUserId: { contains: q.search } },
            { note: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(q.following === "following" ? { isFollowing: true } : q.following === "unfollowed" ? { isFollowing: false } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}
