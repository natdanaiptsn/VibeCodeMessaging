/**
 * ตรวจสอบความปลอดภัยของ Regular Expression (ป้องกัน ReDoS)
 * - จำกัดความยาว pattern
 * - ห้าม backreference
 * - ห้าม nested quantifier (star height > 1) เช่น (a+)+
 * นอกจากนี้ฝั่ง Server ยังรัน regex ใน sandbox ที่มี timeout อีกชั้นหนึ่ง
 */
import safeRegex from "safe-regex2";

export const REGEX_MAX_LENGTH = 200;

export type RegexCheck = { ok: true } | { ok: false; reason: string };

export function checkRegexSafety(pattern: string): RegexCheck {
  if (!pattern) return { ok: false, reason: "ต้องระบุ Regular Expression" };
  if (pattern.length > REGEX_MAX_LENGTH) return { ok: false, reason: `Regular Expression ยาวเกิน ${REGEX_MAX_LENGTH} ตัวอักษร` };
  let re: RegExp;
  try {
    re = new RegExp(pattern, "u");
  } catch (e) {
    return { ok: false, reason: `รูปแบบ Regular Expression ไม่ถูกต้อง: ${(e as Error).message}` };
  }
  if (/\\[1-9]|\\k</.test(pattern)) return { ok: false, reason: "ไม่อนุญาต backreference (\\1, \\k<name>) เพื่อป้องกัน ReDoS" };
  if (!safeRegex(re, { limit: 25 })) {
    return { ok: false, reason: "Regular Expression มีความเสี่ยง ReDoS (เช่น quantifier ซ้อนกัน (a+)+) กรุณาปรับรูปแบบ" };
  }
  if (/\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)[+*{]/.test(pattern)) {
    return { ok: false, reason: "ไม่อนุญาต quantifier ซ้อนกันในกลุ่ม เพื่อป้องกัน ReDoS" };
  }
  return { ok: true };
}
