import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * ตรวจสอบ X-Line-Signature
 * signature = Base64(HMAC-SHA256(channelSecret, rawBody))
 * ต้องใช้ raw body (ก่อน JSON.parse) เท่านั้น
 */
export function computeLineSignature(channelSecret: string, rawBody: string | Buffer): string {
  return createHmac("sha256", channelSecret).update(rawBody).digest("base64");
}

export function verifyLineSignature(
  channelSecret: string,
  rawBody: string | Buffer,
  signature: string | null | undefined,
): boolean {
  if (!signature || !channelSecret) return false;
  const expected = Buffer.from(computeLineSignature(channelSecret, rawBody), "base64");
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  if (received.length !== expected.length || received.length === 0) return false;
  return timingSafeEqual(expected, received);
}
