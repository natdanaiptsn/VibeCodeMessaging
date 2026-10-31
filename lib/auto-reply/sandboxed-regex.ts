import "server-only";
import vm from "node:vm";
import type { RegexTester } from "@/lib/auto-reply/matcher";
import { logger } from "@/lib/logger";

/**
 * รัน Regular Expression ใน vm context ที่มี timeout
 * หาก regex ใช้เวลานานเกินกำหนด (ReDoS) จะถูกยกเลิกและถือว่าไม่ตรง
 */
const TIMEOUT_MS = 50;
const context = vm.createContext({ __re: null as RegExp | null, __input: "" });
const script = new vm.Script("__re.test(__input)");
const compiled = new Map<string, RegExp>();

function getRegex(pattern: string, flags: string): RegExp {
  const key = `${flags}/${pattern}`;
  let re = compiled.get(key);
  if (!re) {
    re = new RegExp(pattern, flags);
    if (compiled.size > 500) compiled.clear();
    compiled.set(key, re);
  }
  re.lastIndex = 0;
  return re;
}

export const sandboxedRegexTester: RegexTester = (pattern, flags, input) => {
  const re = getRegex(pattern, flags);
  context.__re = re;
  context.__input = input;
  try {
    return Boolean(script.runInContext(context, { timeout: TIMEOUT_MS }));
  } catch (err) {
    logger.warn("Regex execution aborted (timeout or error)", { pattern, error: (err as Error).message });
    return false;
  } finally {
    context.__re = null;
    context.__input = "";
  }
};
