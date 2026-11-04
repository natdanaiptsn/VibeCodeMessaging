import { createHmac, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyIdToken } from "@/lib/auth/oauth/jwt";

const now = Date.now();
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const claims = (extra: Record<string, unknown> = {}) => ({
  iss: "https://issuer.example",
  sub: "user-123",
  aud: "client-1",
  exp: Math.floor(now / 1000) + 600,
  iat: Math.floor(now / 1000),
  nonce: "n-1",
  ...extra,
});

function hs256(payload: object, secret = "line-secret", header: object = { alg: "HS256", typ: "JWT" }) {
  const input = `${b64(header)}.${b64(payload)}`;
  return `${input}.${createHmac("sha256", secret).update(input).digest("base64url")}`;
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
function rs256(payload: object, kid = "k1") {
  const input = `${b64({ alg: "RS256", kid, typ: "JWT" })}.${b64(payload)}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

const hsOpts = { alg: "HS256" as const, secret: "line-secret", issuers: ["https://issuer.example"], audience: "client-1", nonce: "n-1", now };
const rsOpts = {
  alg: "RS256" as const,
  getKey: async (kid: string | undefined) => (kid === "k1" ? jwk : null),
  issuers: ["https://issuer.example"],
  audience: "client-1",
  nonce: "n-1",
  now,
};

describe("verifyIdToken", () => {
  it("accepts a valid HS256 token (LINE Login)", async () => {
    await expect(verifyIdToken(hs256(claims({ name: "สมชาย" })), hsOpts)).resolves.toMatchObject({ sub: "user-123", name: "สมชาย" });
  });

  it("accepts a valid RS256 token (Google, JWKS)", async () => {
    await expect(verifyIdToken(rs256(claims({ email: "a@b.com" })), rsOpts)).resolves.toMatchObject({ email: "a@b.com" });
  });

  it("rejects a wrong signature / secret", async () => {
    await expect(verifyIdToken(hs256(claims(), "other-secret"), hsOpts)).rejects.toThrow(/ลายเซ็น/);
    const t = rs256(claims());
    const tampered = t.replace(/\.([^.]+)\./, `.${b64(claims({ sub: "attacker" }))}.`);
    await expect(verifyIdToken(tampered, rsOpts)).rejects.toThrow(/ลายเซ็น/);
  });

  it("rejects alg confusion and unsigned tokens", async () => {
    await expect(verifyIdToken(hs256(claims(), "line-secret", { alg: "none" }), hsOpts)).rejects.toThrow(/alg/);
    await expect(verifyIdToken(hs256(claims()), rsOpts)).rejects.toThrow(/alg/);
  });

  it("checks issuer, audience, expiry and nonce", async () => {
    await expect(verifyIdToken(hs256(claims({ iss: "https://evil.example" })), hsOpts)).rejects.toThrow(/ผู้ออก/);
    await expect(verifyIdToken(hs256(claims({ aud: "other-client" })), hsOpts)).rejects.toThrow(/ระบบนี้/);
    await expect(verifyIdToken(hs256(claims({ exp: Math.floor(now / 1000) - 3600 })), hsOpts)).rejects.toThrow(/หมดอายุ/);
    await expect(verifyIdToken(hs256(claims({ nonce: "replayed" })), hsOpts)).rejects.toThrow(/nonce/);
  });

  it("rejects unknown signing keys and malformed tokens", async () => {
    await expect(verifyIdToken(rs256(claims(), "unknown"), rsOpts)).rejects.toThrow(/public key/);
    await expect(verifyIdToken("not.a.jwt", hsOpts)).rejects.toThrow();
    await expect(verifyIdToken("onlyonepart", hsOpts)).rejects.toThrow(/รูปแบบ/);
  });
});
