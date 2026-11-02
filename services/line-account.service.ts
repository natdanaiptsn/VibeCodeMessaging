import "server-only";
import { prisma } from "@/lib/prisma";
import { env, appUrl } from "@/lib/env";
import { encrypt, safeDecrypt, sha256Hex } from "@/lib/crypto";
import { badRequest } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { lineApi, describeLineError } from "@/services/line-messaging.service";
import type { ConnectionStatus } from "@/lib/generated/prisma/client";

export type CredentialSource = "env" | "database" | null;

/**
 * ที่มาของ Channel access token
 * - env / database: token แบบ long-lived ที่ผู้ใช้กรอกเอง
 * - stateless: ระบบขอ token อายุ 15 นาทีจาก LINE เองด้วย Channel ID + Channel secret (ไม่ต้องออก token เอง)
 */
export type TokenSource = "env" | "database" | "stateless" | null;

export type LineCredentials = {
  accountId: string;
  channelId: string | null;
  channelSecret: string | null;
  channelAccessToken: string | null;
  secretSource: CredentialSource;
  tokenSource: TokenSource;
  /** เหตุผลที่ได้ token ไม่สำเร็จ (ใช้แสดงผลให้ผู้ใช้) */
  tokenError: string | null;
};

const STATELESS_REFRESH_MARGIN_MS = 60_000;
const g = globalThis as unknown as { __lineStatelessTokens?: Map<string, { token: string; expiresAt: number }> };
const tokenCache = (g.__lineStatelessTokens ??= new Map());

/** ขอ stateless channel access token (cache ต่อ instance จนใกล้หมดอายุ) */
async function getStatelessToken(channelId: string, channelSecret: string): Promise<string> {
  const key = sha256Hex(`${channelId}:${channelSecret}`);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - STATELESS_REFRESH_MARGIN_MS > Date.now()) return cached.token;
  const { accessToken, expiresIn } = await lineApi.issueStatelessToken(channelId, channelSecret);
  if (tokenCache.size > 20) tokenCache.clear();
  tokenCache.set(key, { token: accessToken, expiresAt: Date.now() + expiresIn * 1000 });
  return accessToken;
}

/** บัญชี LINE OA หลัก (สร้างอัตโนมัติหากยังไม่มี) */
export async function getDefaultLineAccount() {
  const existing = await prisma.lineAccount.findFirst({
    where: { isDefault: true, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  const any = await prisma.lineAccount.findFirst({ orderBy: { createdAt: "asc" } });
  if (any) return prisma.lineAccount.update({ where: { id: any.id }, data: { isDefault: true, isActive: true } });
  return prisma.lineAccount.create({ data: { name: "LINE OA หลัก", isDefault: true } });
}

/**
 * อ่าน Credentials (ใช้เฉพาะฝั่ง Server เท่านั้น ห้ามส่งไป Frontend)
 * - ค่าใน Environment Variable มีลำดับความสำคัญสูงกว่าค่าในฐานข้อมูล
 * - ถ้าไม่มี token แบบ long-lived แต่มี Channel ID + Channel secret ระบบจะขอ token จาก LINE ให้อัตโนมัติ
 * @param opts.includeToken false = ไม่ต้องขอ token (เช่น ตอนตรวจลายเซ็น Webhook ที่ใช้แค่ secret)
 */
export async function getLineCredentials(opts: { includeToken?: boolean } = {}): Promise<LineCredentials> {
  const includeToken = opts.includeToken ?? true;
  const account = await getDefaultLineAccount();
  const e = env();
  const envSecret = e.LINE_CHANNEL_SECRET?.trim() || null;
  const envToken = e.LINE_CHANNEL_ACCESS_TOKEN?.trim() || null;
  const dbSecret = safeDecrypt(account.channelSecretEnc);
  const dbToken = safeDecrypt(account.channelAccessTokenEnc);
  const channelId = e.LINE_CHANNEL_ID?.trim() || account.channelId || null;
  const channelSecret = envSecret ?? dbSecret;
  const longLived = envToken ?? dbToken;

  let channelAccessToken: string | null = longLived;
  let tokenSource: TokenSource = envToken ? "env" : dbToken ? "database" : null;
  let tokenError: string | null = null;

  if (!longLived) {
    if (!channelSecret || !channelId) {
      tokenError = !channelSecret && !channelId
        ? "ยังไม่ได้กรอก Channel ID และ Channel secret"
        : !channelId
          ? "ยังไม่ได้กรอก Channel ID"
          : "ยังไม่ได้กรอก Channel secret";
    } else if (includeToken) {
      try {
        channelAccessToken = await getStatelessToken(channelId, channelSecret);
        tokenSource = "stateless";
      } catch (err) {
        tokenError = `ขอ Access token จาก LINE ไม่สำเร็จ: ${describeLineError(err)} — ตรวจสอบว่า Channel ID และ Channel secret มาจาก channel เดียวกัน`;
        logger.warn("Failed to issue stateless channel access token", { error: (err as Error).message });
      }
    } else {
      tokenSource = "stateless";
    }
  }

  return {
    accountId: account.id,
    channelId,
    channelSecret,
    channelAccessToken,
    secretSource: envSecret ? "env" : dbSecret ? "database" : null,
    tokenSource,
    tokenError,
  };
}

/** คืน Access token หรือโยน error 400 พร้อมข้อความที่บอกวิธีแก้ */
export function requireAccessToken(creds: LineCredentials): string {
  if (creds.channelAccessToken) return creds.channelAccessToken;
  throw badRequest(`ยังเชื่อมต่อ LINE ไม่ได้: ${creds.tokenError ?? "ยังไม่ได้ตั้งค่า"} (ตั้งค่าที่หน้า LINE OA Settings)`);
}

export function webhookUrl(): string | null {
  const base = appUrl();
  return base ? `${base}/api/webhook/line` : null;
}

/** ข้อมูลที่ปลอดภัยสำหรับแสดงผลบน Frontend (ไม่มี Token/Secret) */
export async function getLineAccountPublic() {
  const account = await getDefaultLineAccount();
  const [creds, lastInbound] = await Promise.all([
    getLineCredentials({ includeToken: false }),
    prisma.message.findFirst({
      where: { direction: "INBOUND", lineAccountId: account.id, type: { notIn: ["FOLLOW", "UNFOLLOW"] } },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true, text: true, type: true },
    }),
  ]);
  const e = env();
  return {
    id: account.id,
    name: account.name,
    channelId: creds.channelId,
    channelIdSource: (e.LINE_CHANNEL_ID?.trim() ? "env" : account.channelId ? "database" : null) as CredentialSource,
    botUserId: account.botUserId,
    basicId: account.basicId,
    displayName: account.displayName,
    pictureUrl: account.pictureUrl,
    hasChannelSecret: Boolean(creds.channelSecret),
    hasChannelAccessToken: creds.tokenSource === "env" || creds.tokenSource === "database",
    /** มีข้อมูลพอสำหรับเชื่อมต่อ LINE หรือยัง */
    canConnect: Boolean(creds.channelSecret && (creds.channelAccessToken || creds.channelId)),
    secretSource: creds.secretSource,
    tokenSource: creds.tokenSource,
    addFriendUrl: account.basicId ? `https://line.me/R/ti/p/${encodeURIComponent(account.basicId)}` : null,
    credentialsUpdatedAt: account.credentialsUpdatedAt,
    connectionStatus: account.connectionStatus,
    connectionError: account.connectionError,
    lastVerifiedAt: account.lastVerifiedAt,
    lastWebhookAt: account.lastWebhookAt,
    webhookUrl: webhookUrl(),
    /** ข้อความล่าสุดที่ลูกค้าส่งเข้ามา (ใช้ยืนยันว่าเชื่อมต่อใช้งานได้จริง) */
    lastInbound: lastInbound ? { at: lastInbound.timestamp, text: lastInbound.text, type: lastInbound.type } : null,
  };
}

export async function saveLineCredentials(input: {
  name?: string;
  channelId?: string;
  channelSecret?: string;
  channelAccessToken?: string;
}) {
  const account = await getDefaultLineAccount();
  const data: Record<string, unknown> = {};
  if (input.name) data.name = input.name;
  if (input.channelId !== undefined) data.channelId = input.channelId || null;
  if (input.channelSecret) data.channelSecretEnc = encrypt(input.channelSecret);
  if (input.channelAccessToken) data.channelAccessTokenEnc = encrypt(input.channelAccessToken);
  if (input.channelSecret || input.channelAccessToken) {
    data.credentialsUpdatedAt = new Date();
    data.connectionStatus = "UNKNOWN";
    data.connectionError = null;
  }
  return prisma.lineAccount.update({ where: { id: account.id }, data });
}

export async function clearLineCredentials(which: "secret" | "token" | "all") {
  const account = await getDefaultLineAccount();
  return prisma.lineAccount.update({
    where: { id: account.id },
    data: {
      ...(which !== "token" ? { channelSecretEnc: null } : {}),
      ...(which !== "secret" ? { channelAccessTokenEnc: null } : {}),
      ...(which === "all" ? { channelId: null } : {}),
      credentialsUpdatedAt: new Date(),
      connectionStatus: "UNKNOWN",
    },
  });
}

export async function markConnection(
  accountId: string,
  status: ConnectionStatus,
  info?: { error?: string | null; botUserId?: string; basicId?: string; displayName?: string; pictureUrl?: string | null },
) {
  return prisma.lineAccount.update({
    where: { id: accountId },
    data: {
      connectionStatus: status,
      connectionError: info?.error?.slice(0, 500) ?? null,
      lastVerifiedAt: new Date(),
      ...(info?.botUserId ? { botUserId: info.botUserId } : {}),
      ...(info?.basicId ? { basicId: info.basicId } : {}),
      ...(info?.displayName ? { displayName: info.displayName } : {}),
      ...(info?.pictureUrl !== undefined ? { pictureUrl: info.pictureUrl } : {}),
    },
  });
}
