import { config as loadEnv } from "dotenv";

// ค่าบัญชีทดสอบอยู่ในไฟล์ .env.e2e (ไม่ถูก commit) — ดูตัวอย่างที่ .env.e2e.example
loadEnv({ path: ".env.e2e", quiet: true });

/**
 * ค่าที่เทสต์ E2E ใช้ — อ่านจาก Environment (ใส่ไว้ในไฟล์ .env.e2e ที่ไม่ถูก commit)
 * ห้ามใส่ชื่อผู้ใช้/รหัสผ่านจริงในโค้ด
 */
export const BASE_URL = (process.env.E2E_BASE_URL ?? "https://vibe-code-messaging.vercel.app").replace(/\/+$/, "");
export const BASE_ORIGIN = new URL(BASE_URL).origin;

/** ชื่อข้อมูลทุกอย่างที่เทสต์สร้างจะขึ้นต้นด้วยคำนี้ (ใช้ลบทิ้งทีหลัง) */
export const E2E_PREFIX = "[E2E]";

export type AccountKey = "owner" | "member";

export type E2EAccount = {
  key: AccountKey;
  label: string;
  envPrefix: string;
  username: string | undefined;
  password: string | undefined;
  /** ไฟล์เก็บ cookie หลังล็อกอิน (อยู่ใน e2e/.auth ซึ่งไม่ถูก commit) */
  state: string;
};

export const ACCOUNTS: Record<AccountKey, E2EAccount> = {
  owner: {
    key: "owner",
    label: "บัญชีทดสอบหลัก (เจ้าของโปรเจกต์ทดสอบ)",
    envPrefix: "E2E_OWNER",
    username: process.env.E2E_OWNER_USERNAME,
    password: process.env.E2E_OWNER_PASSWORD,
    state: "e2e/.auth/owner.json",
  },
  member: {
    key: "member",
    label: "บัญชีทดสอบที่สอง (ใช้ทดสอบสมาชิก B5–B9)",
    envPrefix: "E2E_MEMBER",
    username: process.env.E2E_MEMBER_USERNAME,
    password: process.env.E2E_MEMBER_PASSWORD,
    state: "e2e/.auth/member.json",
  },
};

export function uniqueName(label: string) {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  return `${E2E_PREFIX} ${label} ${suffix}`;
}
