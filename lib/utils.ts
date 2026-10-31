import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

/** ลบอักขระควบคุม (ยกเว้น \n และ \t ถ้าอนุญาต) */
export function stripControlChars(input: string, keepNewlines = true): string {
  const pattern = keepNewlines
    ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u2028\u2029\uFEFF]/g
    : /[\u0000-\u001F\u007F\u200B-\u200D\u2028\u2029\uFEFF]/g;
  return input.replace(pattern, "");
}
