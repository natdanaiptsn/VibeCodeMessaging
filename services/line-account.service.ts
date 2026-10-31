import "server-only";
import { prisma } from "@/lib/prisma";
import { env, appUrl } from "@/lib/env";
import { encrypt, safeDecrypt } from "@/lib/crypto";
import type { ConnectionStatus } from "@/lib/generated/prisma/client";

export type CredentialSource = "env" | "database" | null;

export type LineCredentials = {
  accountId: string;
  channelSecret: string | null;
  channelAccessToken: string | null;
  secretSource: CredentialSource;
  tokenSource: CredentialSource;
};

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
 * ค่าใน Environment Variable มีลำดับความสำคัญสูงกว่าค่าในฐานข้อมูล
 */
export async function getLineCredentials(): Promise<LineCredentials> {
  const account = await getDefaultLineAccount();
  const e = env();
  const envSecret = e.LINE_CHANNEL_SECRET?.trim() || null;
  const envToken = e.LINE_CHANNEL_ACCESS_TOKEN?.trim() || null;
  const dbSecret = safeDecrypt(account.channelSecretEnc);
  const dbToken = safeDecrypt(account.channelAccessTokenEnc);
  return {
    accountId: account.id,
    channelSecret: envSecret ?? dbSecret,
    channelAccessToken: envToken ?? dbToken,
    secretSource: envSecret ? "env" : dbSecret ? "database" : null,
    tokenSource: envToken ? "env" : dbToken ? "database" : null,
  };
}

export function webhookUrl(): string | null {
  const base = appUrl();
  return base ? `${base}/api/webhook/line` : null;
}

/** ข้อมูลที่ปลอดภัยสำหรับแสดงผลบน Frontend (ไม่มี Token/Secret) */
export async function getLineAccountPublic() {
  const account = await getDefaultLineAccount();
  const creds = await getLineCredentials();
  return {
    id: account.id,
    name: account.name,
    channelId: env().LINE_CHANNEL_ID || account.channelId,
    botUserId: account.botUserId,
    basicId: account.basicId,
    displayName: account.displayName,
    pictureUrl: account.pictureUrl,
    hasChannelSecret: Boolean(creds.channelSecret),
    hasChannelAccessToken: Boolean(creds.channelAccessToken),
    secretSource: creds.secretSource,
    tokenSource: creds.tokenSource,
    credentialsUpdatedAt: account.credentialsUpdatedAt,
    connectionStatus: account.connectionStatus,
    connectionError: account.connectionError,
    lastVerifiedAt: account.lastVerifiedAt,
    lastWebhookAt: account.lastWebhookAt,
    webhookUrl: webhookUrl(),
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
