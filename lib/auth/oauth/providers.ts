import "server-only";
import { appUrl, env } from "@/lib/env";
import { jwksKeyLoader } from "@/lib/auth/oauth/jwt";
import type { AuthProvider } from "@/lib/generated/prisma/client";
import type { JsonWebKey } from "node:crypto";

/**
 * ผู้ให้บริการเข้าสู่ระบบแบบ OpenID Connect (Authorization Code + PKCE)
 * ค่า Client ID / Secret อ่านจาก Environment Variable เท่านั้น — ไม่ตั้งค่า = ไม่แสดงปุ่มนั้น
 */
export type ProviderId = "google" | "line";

export type OAuthProvider = {
  id: ProviderId;
  label: string;
  dbProvider: AuthProvider;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  issuers: string[];
  scope: string;
  extraAuthParams: Record<string, string>;
  verify: { alg: "HS256"; secret: string } | { alg: "RS256"; getKey: (kid: string | undefined) => Promise<JsonWebKey | null> };
  /** อีเมลจากผู้ให้บริการนี้เชื่อถือได้ (ยืนยันแล้ว) จึงใช้จับคู่กับบัญชีเดิมได้ */
  trustEmail: boolean;
};

export const PROVIDER_LABELS: Record<ProviderId, string> = { google: "Google", line: "LINE" };

const googleKeysByUrl = new Map<string, ReturnType<typeof jwksKeyLoader>>();

function google(): OAuthProvider | null {
  const e = env();
  const clientId = e.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = e.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const test = e.OAUTH_TEST_GOOGLE_BASE_URL?.replace(/\/+$/, "");
  const jwksUrl = test ? `${test}/certs` : "https://www.googleapis.com/oauth2/v3/certs";
  let getKey = googleKeysByUrl.get(jwksUrl);
  if (!getKey) googleKeysByUrl.set(jwksUrl, (getKey = jwksKeyLoader(jwksUrl)));
  return {
    id: "google",
    label: PROVIDER_LABELS.google,
    dbProvider: "GOOGLE",
    clientId,
    clientSecret,
    authUrl: test ? `${test}/auth` : "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: test ? `${test}/token` : "https://oauth2.googleapis.com/token",
    issuers: test ? [test] : ["https://accounts.google.com", "accounts.google.com"],
    scope: "openid email profile",
    extraAuthParams: { prompt: "select_account" },
    verify: { alg: "RS256", getKey },
    trustEmail: true,
  };
}

function line(): OAuthProvider | null {
  const e = env();
  const clientId = e.LINE_LOGIN_CHANNEL_ID?.trim();
  const clientSecret = e.LINE_LOGIN_CHANNEL_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const test = e.OAUTH_TEST_LINE_BASE_URL?.replace(/\/+$/, "");
  return {
    id: "line",
    label: PROVIDER_LABELS.line,
    dbProvider: "LINE",
    clientId,
    clientSecret,
    authUrl: test ? `${test}/authorize` : "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: test ? `${test}/token` : "https://api.line.me/oauth2/v2.1/token",
    issuers: test ? [test] : ["https://access.line.me"],
    // ขออีเมลต้องยื่นขอสิทธิ์กับ LINE ก่อน จึงใช้แค่ชื่อ/รูป และระบุตัวตนด้วย LINE user ID
    scope: "openid profile",
    extraAuthParams: {},
    verify: { alg: "HS256", secret: clientSecret },
    trustEmail: false,
  };
}

export function getProvider(id: string): OAuthProvider | null {
  if (id === "google") return google();
  if (id === "line") return line();
  return null;
}

/** ผู้ให้บริการที่ตั้งค่าแล้ว (ใช้แสดงปุ่มในหน้าเข้าสู่ระบบ) */
export function enabledProviders(): { id: ProviderId; label: string }[] {
  return (["google", "line"] as const).filter((id) => getProvider(id)).map((id) => ({ id, label: PROVIDER_LABELS[id] }));
}

export function providerIdOf(db: AuthProvider): ProviderId {
  return db === "GOOGLE" ? "google" : "line";
}

/** Callback URL ที่ต้องลงทะเบียนไว้ที่ผู้ให้บริการ */
export function callbackUrl(id: ProviderId): string | null {
  const base = appUrl();
  return base ? `${base}/api/auth/oauth/${id}/callback` : null;
}
