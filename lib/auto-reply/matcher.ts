/** จับคู่ข้อความกับกฎตอบกลับ (pure function — ทดสอบได้ง่าย) */
import { normalizeText } from "@/lib/auto-reply/normalize";

export type MatchTypeValue = "EXACT" | "CONTAINS" | "STARTS_WITH" | "ENDS_WITH" | "REGEX";
export type KeywordLogicValue = "ANY" | "ALL";

export type MatchableRule = {
  matchType: MatchTypeValue;
  keywordLogic: KeywordLogicValue;
  caseSensitive: boolean;
  keywords: string[];
};

export type RegexTester = (pattern: string, flags: string, input: string) => boolean;

export type MatchResult = { matched: boolean; matchedKeyword?: string };

/** จำกัดความยาวข้อความที่นำไปทดสอบ regex */
export const REGEX_INPUT_MAX = 1000;

const defaultTester: RegexTester = (pattern, flags, input) => new RegExp(pattern, flags).test(input);

function matchOne(rule: MatchableRule, text: string, keyword: string, tester: RegexTester): boolean {
  if (rule.matchType === "REGEX") {
    const flags = rule.caseSensitive ? "u" : "iu";
    try {
      return tester(keyword, flags, text.slice(0, REGEX_INPUT_MAX));
    } catch {
      return false;
    }
  }
  const kw = normalizeText(keyword, rule.caseSensitive);
  if (!kw) return false;
  switch (rule.matchType) {
    case "EXACT":
      return text === kw;
    case "CONTAINS":
      return text.includes(kw);
    case "STARTS_WITH":
      return text.startsWith(kw);
    case "ENDS_WITH":
      return text.endsWith(kw);
    default:
      return false;
  }
}

export function matchRule(rule: MatchableRule, rawText: string, tester: RegexTester = defaultTester): MatchResult {
  if (rule.keywords.length === 0) return { matched: false };
  // REGEX ใช้ข้อความที่ normalize เฉพาะช่องว่าง (คงตัวพิมพ์ไว้ ให้ flag i จัดการ)
  const text = rule.matchType === "REGEX" ? normalizeText(rawText, true) : normalizeText(rawText, rule.caseSensitive);
  if (!text) return { matched: false };
  if (rule.keywordLogic === "ALL") {
    const all = rule.keywords.every((k) => matchOne(rule, text, k, tester));
    return all ? { matched: true, matchedKeyword: rule.keywords.join(" + ") } : { matched: false };
  }
  for (const k of rule.keywords) {
    if (matchOne(rule, text, k, tester)) return { matched: true, matchedKeyword: k };
  }
  return { matched: false };
}
