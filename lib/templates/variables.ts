/**
 * ตัวแปร Dynamic สำหรับข้อความตอบกลับ เช่น {{displayName}}
 * - แทนค่าแบบ single-pass (ค่าที่แทนเข้าไปจะไม่ถูกตีความเป็นตัวแปรซ้ำ)
 * - Escape/ทำความสะอาดค่าก่อนแทน เพื่อป้องกันปัญหาการแสดงผล
 */
import { stripControlChars } from "@/lib/utils";

export const TEMPLATE_VARIABLES = [
  { key: "displayName", label: "ชื่อที่แสดงของลูกค้า", example: "สมชาย" },
  { key: "userId", label: "LINE User ID", example: "U1234567890abcdef1234567890abcdef" },
  { key: "date", label: "วันที่ปัจจุบัน", example: "31 ตุลาคม 2569" },
  { key: "time", label: "เวลาปัจจุบัน", example: "14:30" },
  { key: "datetime", label: "วันที่และเวลา", example: "31 ตุลาคม 2569 14:30" },
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type TemplateValues = Record<TemplateVariableKey, string>;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
const VARIABLE_RE = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

export function findVariables(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(VARIABLE_RE)) found.add(m[1]!);
  return [...found];
}

export function findUnknownVariables(template: string): string[] {
  return findVariables(template).filter((v) => !KNOWN.has(v));
}

/** ทำความสะอาดค่าตัวแปร: ตัดอักขระควบคุม, ขึ้นบรรทัดใหม่, จำกัดความยาว */
export function sanitizeVariableValue(value: string, maxLength = 150): string {
  const cleaned = stripControlChars(value.replace(/[\r\n\t]+/g, " "), false).replace(/\s+/g, " ").trim();
  return [...cleaned].slice(0, maxLength).join("");
}

export function renderTemplate(
  template: string,
  values: Partial<Record<string, string>>,
  encode: (value: string) => string = (v) => v,
): string {
  return template.replace(VARIABLE_RE, (match, key: string) => {
    const value = values[key];
    if (value === undefined) return match;
    return encode(sanitizeVariableValue(value));
  });
}

export function buildTemplateValues(input: {
  displayName?: string | null;
  userId?: string | null;
  now?: Date;
  timezone?: string;
}): TemplateValues {
  const now = input.now ?? new Date();
  const timeZone = input.timezone || "Asia/Bangkok";
  const date = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone }).format(now);
  const time = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(now);
  return {
    displayName: input.displayName?.trim() ? input.displayName : "ลูกค้า",
    userId: input.userId ?? "",
    date,
    time,
    datetime: `${date} ${time}`,
  };
}

export function sampleTemplateValues(): TemplateValues {
  return Object.fromEntries(TEMPLATE_VARIABLES.map((v) => [v.key, v.example])) as TemplateValues;
}
