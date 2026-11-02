import "server-only";
import { prisma } from "@/lib/prisma";
import { env, appUrl } from "@/lib/env";
import { encrypt, safeDecrypt, sha256Hex } from "@/lib/crypto";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { lineApi, describeLineError } from "@/services/line-messaging.service";
import type { ConnectionStatus, Project } from "@/lib/generated/prisma/client";

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

/**
 * โปรเจกต์หลัก — รับ Webhook จาก URL เดิม (/api/webhook/line) และใช้ LINE_* จาก Environment Variable ได้
 * (สร้างอัตโนมัติหากยังไม่มีโปรเจกต์เลย)
 */
export async function getDefaultProject(): Promise<Project> {
  const existing = await prisma.project.findFirst({ where: { isDefault: true }, orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  const any = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (any) return prisma.project.update({ where: { id: any.id }, data: { isDefault: true } });
  return prisma.project.create({ data: { name: "โปรเจกต์แรก", isDefault: true } });
}

export async function getProjectOrThrow(projectId: string): Promise<Project> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw notFound("ไม่พบโปรเจกต์");
  return project;
}

/** ค่า LINE_* ใน Environment Variable ใช้ได้เฉพาะโปรเจกต์หลัก (โปรเจกต์อื่นกรอกในหน้า LINE OA Settings) */
function envCredentials(project: Project) {
  if (!project.isDefault) return { id: null, secret: null, token: null };
  const e = env();
  return {
    id: e.LINE_CHANNEL_ID?.trim() || null,
    secret: e.LINE_CHANNEL_SECRET?.trim() || null,
    token: e.LINE_CHANNEL_ACCESS_TOKEN?.trim() || null,
  };
}

/**
 * อ่าน Credentials (ใช้เฉพาะฝั่ง Server เท่านั้น ห้ามส่งไป Frontend)
 * - ค่าใน Environment Variable มีลำดับความสำคัญสูงกว่าค่าในฐานข้อมูล
 * - ถ้าไม่มี token แบบ long-lived แต่มี Channel ID + Channel secret ระบบจะขอ token จาก LINE ให้อัตโนมัติ
 * @param opts.includeToken false = ไม่ต้องขอ token (เช่น ตอนตรวจลายเซ็น Webhook ที่ใช้แค่ secret)
 */
export async function getLineCredentials(
  projectOrId: string | Project,
  opts: { includeToken?: boolean } = {},
): Promise<LineCredentials> {
  const includeToken = opts.includeToken ?? true;
  const account = typeof projectOrId === "string" ? await getProjectOrThrow(projectOrId) : projectOrId;
  const fromEnv = envCredentials(account);
  const envSecret = fromEnv.secret;
  const envToken = fromEnv.token;
  const dbSecret = safeDecrypt(account.channelSecretEnc);
  const dbToken = safeDecrypt(account.channelAccessTokenEnc);
  const channelId = fromEnv.id || account.channelId || null;
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
        logger.warn("Failed to issue stateless channel access token", { projectId: account.id, error: (err as Error).message });
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

/** Webhook URL ของโปรเจกต์ (แต่ละโปรเจกต์มี URL ของตัวเอง) */
export function webhookUrl(projectId: string): string | null {
  const base = appUrl();
  return base ? `${base}/api/webhook/line/${projectId}` : null;
}

/** URL เดิมก่อนมีระบบโปรเจกต์ — ยังใช้ได้กับโปรเจกต์หลัก */
export function legacyWebhookUrl(): string | null {
  const base = appUrl();
  return base ? `${base}/api/webhook/line` : null;
}

/** ข้อมูลที่ปลอดภัยสำหรับแสดงผลบน Frontend (ไม่มี Token/Secret) */
export async function getLineAccountPublic(projectId: string) {
  const account = await getProjectOrThrow(projectId);
  const [creds, lastInbound] = await Promise.all([
    getLineCredentials(account, { includeToken: false }),
    prisma.message.findFirst({
      where: { direction: "INBOUND", projectId: account.id, type: { notIn: ["FOLLOW", "UNFOLLOW"] } },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true, text: true, type: true },
    }),
  ]);
  return {
    id: account.id,
    name: account.name,
    isDefault: account.isDefault,
    channelId: creds.channelId,
    channelIdSource: (envCredentials(account).id ? "env" : account.channelId ? "database" : null) as CredentialSource,
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
    webhookUrl: webhookUrl(account.id),
    /** โปรเจกต์หลักรับ Webhook จาก URL เดิมได้ด้วย */
    legacyWebhookUrl: account.isDefault ? legacyWebhookUrl() : null,
    /** ข้อความล่าสุดที่ลูกค้าส่งเข้ามา (ใช้ยืนยันว่าเชื่อมต่อใช้งานได้จริง) */
    lastInbound: lastInbound ? { at: lastInbound.timestamp, text: lastInbound.text, type: lastInbound.type } : null,
  };
}

export async function saveLineCredentials(
  projectId: string,
  input: {
    channelId?: string;
    channelSecret?: string;
    channelAccessToken?: string;
  },
) {
  const account = await getProjectOrThrow(projectId);
  const data: Record<string, unknown> = {};
  if (input.channelId !== undefined) data.channelId = input.channelId || null;
  if (input.channelSecret) data.channelSecretEnc = encrypt(input.channelSecret);
  if (input.channelAccessToken) data.channelAccessTokenEnc = encrypt(input.channelAccessToken);
  if (input.channelSecret || input.channelAccessToken) {
    data.credentialsUpdatedAt = new Date();
    data.connectionStatus = "UNKNOWN";
    data.connectionError = null;
  }
  return prisma.project.update({ where: { id: account.id }, data });
}

export async function clearLineCredentials(projectId: string, which: "secret" | "token" | "all") {
  const account = await getProjectOrThrow(projectId);
  return prisma.project.update({
    where: { id: account.id },
    data: {
      ...(which !== "token" ? { channelSecretEnc: null } : {}),
      ...(which !== "secret" ? { channelAccessTokenEnc: null } : {}),
      ...(which === "all" ? { channelId: null, botUserId: null } : {}),
      credentialsUpdatedAt: new Date(),
      connectionStatus: "UNKNOWN",
    },
  });
}

/**
 * 1 LINE OA ใช้ได้กับ 1 โปรเจกต์ — ถ้าบัญชีนี้ถูกเชื่อมกับโปรเจกต์อื่นอยู่แล้วจะโยน 409 พร้อมชื่อโปรเจกต์นั้น
 */
export async function assertBotNotUsedElsewhere(projectId: string, botUserId: string) {
  const other = await prisma.project.findFirst({ where: { botUserId, id: { not: projectId } }, select: { name: true } });
  if (other) {
    throw conflict(`LINE OA นี้เชื่อมต่อกับโปรเจกต์ “${other.name}” อยู่แล้ว — 1 LINE OA ใช้ได้กับ 1 โปรเจกต์ (ยกเลิกการเชื่อมต่อที่โปรเจกต์นั้นก่อน)`);
  }
}

export async function markConnection(
  accountId: string,
  status: ConnectionStatus,
  info?: { error?: string | null; botUserId?: string; basicId?: string; displayName?: string; pictureUrl?: string | null },
) {
  if (info?.botUserId) await assertBotNotUsedElsewhere(accountId, info.botUserId);
  return prisma.project.update({
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
