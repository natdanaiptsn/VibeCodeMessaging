import { describe, expect, it } from "vitest";
import { matchRule, type MatchableRule } from "@/lib/auto-reply/matcher";
import { normalizeText } from "@/lib/auto-reply/normalize";
import { sandboxedRegexTester } from "@/lib/auto-reply/sandboxed-regex";

const rule = (r: Partial<MatchableRule>): MatchableRule => ({
  matchType: "CONTAINS",
  keywordLogic: "ANY",
  caseSensitive: false,
  keywords: [],
  ...r,
});

describe("normalizeText", () => {
  it("trims, collapses whitespace and removes zero-width characters", () => {
    expect(normalizeText("  ราคา\u200B   เท่าไหร่ \n")).toBe("ราคา เท่าไหร่");
  });
  it("lowercases unless case-sensitive", () => {
    expect(normalizeText("Hello")).toBe("hello");
    expect(normalizeText("Hello", true)).toBe("Hello");
  });
});

describe("matchRule", () => {
  it("EXACT matches the whole message only", () => {
    const r = rule({ matchType: "EXACT", keywords: ["ราคา"] });
    expect(matchRule(r, "ราคา").matched).toBe(true);
    expect(matchRule(r, "  ราคา ").matched).toBe(true);
    expect(matchRule(r, "ขอราคา").matched).toBe(false);
  });

  it("CONTAINS / STARTS_WITH / ENDS_WITH", () => {
    expect(matchRule(rule({ keywords: ["สมัครสมาชิก"] }), "อยากสมัครสมาชิกครับ").matched).toBe(true);
    expect(matchRule(rule({ matchType: "STARTS_WITH", keywords: ["สวัสดี"] }), "สวัสดีครับ").matched).toBe(true);
    expect(matchRule(rule({ matchType: "STARTS_WITH", keywords: ["สวัสดี"] }), "ครับสวัสดี").matched).toBe(false);
    expect(matchRule(rule({ matchType: "ENDS_WITH", keywords: ["ครับ"] }), "ขอบคุณครับ").matched).toBe(true);
  });

  it("is case-insensitive by default and respects caseSensitive", () => {
    expect(matchRule(rule({ keywords: ["PROMO"] }), "use promo code").matched).toBe(true);
    expect(matchRule(rule({ keywords: ["PROMO"], caseSensitive: true }), "use promo code").matched).toBe(false);
  });

  it("supports multiple keywords with ANY and ALL logic", () => {
    const any = rule({ keywords: ["ราคา", "เท่าไหร่"] });
    expect(matchRule(any, "อันนี้เท่าไหร่").matchedKeyword).toBe("เท่าไหร่");
    const all = rule({ keywords: ["ส่ง", "ฟรี"], keywordLogic: "ALL" });
    expect(matchRule(all, "ส่งฟรีไหม").matched).toBe(true);
    expect(matchRule(all, "ส่งยังไง").matched).toBe(false);
  });

  it("REGEX uses the sandboxed tester and ignores invalid patterns", () => {
    const r = rule({ matchType: "REGEX", keywords: ["^(ราคา|price)\\s*\\d*$"] });
    expect(matchRule(r, "PRICE 2", sandboxedRegexTester).matched).toBe(true);
    expect(matchRule(r, "ขอราคา", sandboxedRegexTester).matched).toBe(false);
    expect(matchRule(rule({ matchType: "REGEX", keywords: ["("] }), "(", sandboxedRegexTester).matched).toBe(false);
  });

  it("aborts catastrophic regex via timeout instead of hanging", () => {
    const start = Date.now();
    const r = rule({ matchType: "REGEX", keywords: ["^(a+)+$"] });
    expect(matchRule(r, `${"a".repeat(40)}b`, sandboxedRegexTester).matched).toBe(false);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("never matches empty keywords or empty text", () => {
    expect(matchRule(rule({ keywords: [] }), "hello").matched).toBe(false);
    expect(matchRule(rule({ keywords: ["a"] }), "   ").matched).toBe(false);
  });
});
