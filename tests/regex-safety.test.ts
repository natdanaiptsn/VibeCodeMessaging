import { describe, expect, it } from "vitest";
import { checkRegexSafety } from "@/lib/auto-reply/regex-safety";

describe("checkRegexSafety (ReDoS guard)", () => {
  it("accepts simple safe patterns", () => {
    expect(checkRegexSafety("^(ราคา|เท่าไหร่)").ok).toBe(true);
    expect(checkRegexSafety("\\d{3}-\\d{4}").ok).toBe(true);
  });
  it("rejects nested quantifiers", () => {
    expect(checkRegexSafety("(a+)+").ok).toBe(false);
    expect(checkRegexSafety("(\\w*)*x").ok).toBe(false);
  });
  it("rejects backreferences, invalid and overly long patterns", () => {
    expect(checkRegexSafety("(a)\\1").ok).toBe(false);
    expect(checkRegexSafety("[").ok).toBe(false);
    expect(checkRegexSafety("a".repeat(201)).ok).toBe(false);
    expect(checkRegexSafety("").ok).toBe(false);
  });
});
