import "server-only";
import { createHmac, createPublicKey, timingSafeEqual, verify, type JsonWebKey } from "node:crypto";

/**
 * ตรวจสอบ ID Token (JWT) จากผู้ให้บริการ OpenID Connect
 * - RS256: ตรวจลายเซ็นด้วย public key จาก JWKS ของผู้ให้บริการ (Google)
 * - HS256: ตรวจลายเซ็นด้วย Channel secret (LINE Login)
 * - ตรวจ iss / aud / exp / nonce ทุกครั้ง และไม่ยอมรับ alg อื่นนอกจากที่กำหนด (กัน alg confusion)
 */

export type IdTokenClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  [key: string]: unknown;
};

export type VerifyOptions = {
  issuers: string[];
  audience: string;
  nonce: string;
  now?: number;
} & ({ alg: "HS256"; secret: string } | { alg: "RS256"; getKey: (kid: string | undefined) => Promise<JsonWebKey | null> });

export class IdTokenError extends Error {}

const SKEW_SEC = 120;

function b64urlJson(part: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new IdTokenError("รูปแบบ ID Token ไม่ถูกต้อง");
  }
}

export async function verifyIdToken(token: string, opts: VerifyOptions): Promise<IdTokenClaims> {
  const parts = token.split(".");
  if (parts.length !== 3 || token.length > 16_384) throw new IdTokenError("รูปแบบ ID Token ไม่ถูกต้อง");
  const [h, p, s] = parts as [string, string, string];
  const header = b64urlJson(h);
  if (header.alg !== opts.alg) throw new IdTokenError(`ID Token ใช้ alg ที่ไม่รองรับ (${String(header.alg)})`);
  const signingInput = Buffer.from(`${h}.${p}`);
  const signature = Buffer.from(s, "base64url");

  let valid = false;
  if (opts.alg === "HS256") {
    const expected = createHmac("sha256", opts.secret).update(signingInput).digest();
    valid = expected.length === signature.length && timingSafeEqual(expected, signature);
  } else {
    const jwk = await opts.getKey(typeof header.kid === "string" ? header.kid : undefined);
    if (!jwk) throw new IdTokenError("ไม่พบ public key สำหรับตรวจ ID Token");
    valid = verify("RSA-SHA256", signingInput, createPublicKey({ key: jwk, format: "jwk" }), signature);
  }
  if (!valid) throw new IdTokenError("ลายเซ็น ID Token ไม่ถูกต้อง");

  const claims = b64urlJson(p) as IdTokenClaims;
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (!opts.issuers.includes(claims.iss)) throw new IdTokenError("ผู้ออก ID Token ไม่ถูกต้อง");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(opts.audience)) throw new IdTokenError("ID Token ไม่ได้ออกให้ระบบนี้");
  if (typeof claims.exp !== "number" || claims.exp + SKEW_SEC < now) throw new IdTokenError("ID Token หมดอายุแล้ว");
  if (typeof claims.iat === "number" && claims.iat - SKEW_SEC > now) throw new IdTokenError("เวลาใน ID Token ไม่ถูกต้อง");
  if (!claims.nonce || claims.nonce !== opts.nonce) throw new IdTokenError("nonce ไม่ตรงกัน");
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) throw new IdTokenError("ไม่พบรหัสผู้ใช้ใน ID Token");
  return claims;
}

/** โหลด public key จาก JWKS (cache 1 ชั่วโมง และโหลดใหม่ถ้าพบ kid ที่ไม่รู้จัก) */
export function jwksKeyLoader(url: string, fetchImpl: typeof fetch = fetch) {
  let cache: { at: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;
  const load = async () => {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new IdTokenError(`โหลด JWKS ไม่สำเร็จ (${res.status})`);
    const json = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
    cache = { at: Date.now(), keys: Array.isArray(json.keys) ? json.keys : [] };
    return cache.keys;
  };
  return async (kid: string | undefined): Promise<JsonWebKey | null> => {
    const fresh = cache && Date.now() - cache.at < 60 * 60 * 1000;
    let keys = fresh ? cache!.keys : await load();
    let key = keys.find((k) => (kid ? k.kid === kid : true) && k.kty === "RSA");
    if (!key && fresh) {
      keys = await load();
      key = keys.find((k) => (kid ? k.kid === kid : true) && k.kty === "RSA");
    }
    return key ?? null;
  };
}
