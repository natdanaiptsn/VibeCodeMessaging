import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { encrypt, randomToken, safeDecrypt, safeEqual } from "@/lib/crypto";
import { cookieSecure } from "@/lib/auth/session";
import { verifyIdToken, type IdTokenClaims } from "@/lib/auth/oauth/jwt";
import { callbackUrl, type OAuthProvider, type ProviderId } from "@/lib/auth/oauth/providers";

/**
 * ขั้นตอน OpenID Connect (Authorization Code + PKCE)
 * - state: กัน CSRF ของ callback  - nonce: ผูก ID Token กับคำขอนี้  - PKCE: กันการนำ code ไปใช้ที่อื่น
 * ค่าทั้งหมดเก็บใน cookie ที่เข้ารหัส (AES-256-GCM) อายุ 10 นาที และลบทิ้งทันทีที่กลับมาที่ callback
 */
const FLOW_COOKIE = "lineoa_oauth";
const FLOW_TTL_SEC = 600;

export type FlowMode = "login" | "link";

type FlowState = {
  provider: ProviderId;
  state: string;
  verifier: string;
  nonce: string;
  next: string;
  mode: FlowMode;
  userId: string | null;
  expiresAt: number;
};

export class OAuthFlowError extends Error {
  constructor(
    public code: "state" | "provider" | "config",
    message: string,
  ) {
    super(message);
  }
}

/** ใช้เฉพาะ path ภายในระบบ (กัน open redirect) */
export function safeNext(next: string | null | undefined, fallback = "/projects"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.length > 500) return fallback;
  return next;
}

export async function startFlow(
  provider: OAuthProvider,
  opts: { next: string; mode: FlowMode; userId: string | null },
): Promise<string> {
  const redirectUri = callbackUrl(provider.id);
  if (!redirectUri) throw new OAuthFlowError("config", "ยังไม่ได้ตั้งค่า APP_URL");
  const flow: FlowState = {
    provider: provider.id,
    state: randomToken(24),
    verifier: randomToken(48),
    nonce: randomToken(24),
    next: safeNext(opts.next),
    mode: opts.mode,
    userId: opts.userId,
    expiresAt: Date.now() + FLOW_TTL_SEC * 1000,
  };
  const store = await cookies();
  store.set(FLOW_COOKIE, encrypt(JSON.stringify(flow)), {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax", // ต้องส่งมากับการ redirect กลับจากผู้ให้บริการ (top-level GET)
    path: "/api/auth/oauth",
    maxAge: FLOW_TTL_SEC,
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    scope: provider.scope,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...provider.extraAuthParams,
  });
  return `${provider.authUrl}?${params}`;
}

/** อ่านและลบ cookie ของขั้นตอนนี้ แล้วตรวจ state (code จากผู้ให้บริการใช้ซ้ำไม่ได้อยู่แล้ว) */
export async function consumeFlow(providerId: ProviderId, state: string | null): Promise<FlowState> {
  const store = await cookies();
  const raw = store.get(FLOW_COOKIE)?.value;
  store.delete({ name: FLOW_COOKIE, path: "/api/auth/oauth" });
  const json = safeDecrypt(raw);
  if (!json) throw new OAuthFlowError("state", "หมดเวลาหรือเริ่มเข้าสู่ระบบจากหน้าอื่น กรุณาลองใหม่");
  let flow: FlowState;
  try {
    flow = JSON.parse(json) as FlowState;
  } catch {
    throw new OAuthFlowError("state", "ข้อมูลการเข้าสู่ระบบไม่ถูกต้อง กรุณาลองใหม่");
  }
  if (flow.provider !== providerId || flow.expiresAt < Date.now() || !state || !safeEqual(state, flow.state)) {
    throw new OAuthFlowError("state", "หมดเวลาหรือข้อมูลไม่ตรงกัน กรุณาลองใหม่");
  }
  return flow;
}

/** แลก code เป็น ID Token (สื่อสารกับผู้ให้บริการโดยตรง) แล้วตรวจลายเซ็นและ claim */
export async function exchangeCode(provider: OAuthProvider, code: string, flow: FlowState): Promise<IdTokenClaims> {
  const redirectUri = callbackUrl(provider.id);
  if (!redirectUri) throw new OAuthFlowError("config", "ยังไม่ได้ตั้งค่า APP_URL");
  let res: Response;
  try {
    res = await fetch(provider.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code_verifier: flow.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new OAuthFlowError("provider", `ติดต่อ ${provider.label} ไม่ได้ กรุณาลองใหม่`);
  }
  const json = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
  if (!res.ok || !json?.id_token) {
    throw new OAuthFlowError("provider", `${provider.label} ปฏิเสธการเข้าสู่ระบบ (${json?.error ?? res.status})`);
  }
  try {
    return await verifyIdToken(json.id_token, {
      ...provider.verify,
      issuers: provider.issuers,
      audience: provider.clientId,
      nonce: flow.nonce,
    });
  } catch (err) {
    throw new OAuthFlowError("provider", (err as Error).message);
  }
}
