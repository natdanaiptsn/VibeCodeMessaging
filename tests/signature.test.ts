import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeLineSignature, verifyLineSignature } from "@/lib/line/signature";

const secret = "0123456789abcdef0123456789abcdef";
const body = JSON.stringify({ destination: "Uxxx", events: [{ type: "message", message: { type: "text", text: "สวัสดี" } }] });

describe("LINE webhook signature", () => {
  it("computes base64 HMAC-SHA256 of the raw body", () => {
    const expected = createHmac("sha256", secret).update(body).digest("base64");
    expect(computeLineSignature(secret, body)).toBe(expected);
  });

  it("accepts a valid signature", () => {
    expect(verifyLineSignature(secret, body, computeLineSignature(secret, body))).toBe(true);
  });

  it("rejects tampered body, wrong secret, missing or malformed signatures", () => {
    const sig = computeLineSignature(secret, body);
    expect(verifyLineSignature(secret, body.replace("สวัสดี", "hello"), sig)).toBe(false);
    expect(verifyLineSignature("ffffffffffffffffffffffffffffffff", body, sig)).toBe(false);
    expect(verifyLineSignature(secret, body, null)).toBe(false);
    expect(verifyLineSignature(secret, body, "")).toBe(false);
    expect(verifyLineSignature(secret, body, "abc")).toBe(false);
  });

  it("is sensitive to whitespace changes (must use raw body)", () => {
    const sig = computeLineSignature(secret, body);
    const reformatted = JSON.stringify(JSON.parse(body), null, 2);
    expect(verifyLineSignature(secret, reformatted, sig)).toBe(false);
  });
});
