import fs from "node:fs";
import { test as setup, expect, request, type Page } from "@playwright/test";
import { ACCOUNTS, BASE_URL, type E2EAccount } from "./support/env";

/**
 * ล็อกอินบัญชีทดสอบทั้งสองบัญชี แล้วเก็บ cookie ไว้ใน e2e/.auth/*.json
 * - ถ้า cookie เดิมยังใช้ได้ (อายุ 7 วัน) จะไม่ล็อกอินซ้ำ → ไม่โดนจำกัดจำนวนครั้ง และไม่เสี่ยงถูกล็อกบัญชี
 * - ไม่ได้ทดสอบระบบบัญชี (หมวด A) — แค่เข้าสู่ระบบเพื่อใช้ทดสอบส่วนอื่น
 */

async function savedSessionUser(account: E2EAccount) {
  if (!fs.existsSync(account.state)) return null;
  const ctx = await request.newContext({ baseURL: BASE_URL, storageState: account.state });
  try {
    const res = await ctx.get("/api/auth/me");
    return res.ok() ? ((await res.json()).data as { id: string; role: string; name: string }) : null;
  } finally {
    await ctx.dispose();
  }
}

async function login(page: Page, account: E2EAccount) {
  if (!account.username || !account.password) {
    throw new Error(
      `ยังไม่ได้ตั้ง ${account.envPrefix}_USERNAME และ ${account.envPrefix}_PASSWORD ในไฟล์ .env.e2e (ดูวิธีที่ e2e/README.md)`,
    );
  }
  await page.goto("/login");
  // ถ้าเปิดปุ่ม Google/LINE ไว้ ช่องรหัสผ่านจะถูกซ่อน ต้องกดเปิดก่อน
  const toggle = page.getByRole("button", { name: /เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน/ });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByLabel("ชื่อผู้ใช้").fill(account.username);
  await page.getByLabel("รหัสผ่าน").fill(account.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page, `ล็อกอิน ${account.username} ไม่สำเร็จ — ตรวจชื่อผู้ใช้/รหัสผ่านใน .env.e2e`).toHaveURL(/\/projects/, {
    timeout: 20_000,
  });
  await page.context().storageState({ path: account.state });
}

const users: Record<string, string> = {};

for (const account of Object.values(ACCOUNTS)) {
  setup(`เข้าสู่ระบบ: ${account.label}`, async ({ page }) => {
    let me = await savedSessionUser(account);
    if (!me) {
      await login(page, account);
      me = await savedSessionUser(account);
    }
    expect(me, "เข้าสู่ระบบแล้วแต่อ่านข้อมูลบัญชีไม่ได้").toBeTruthy();
    // กันพลาด: ห้ามใช้บัญชีผู้ดูแลหลัก (OWNER ของระบบ) มารันเทสต์ — ลบ cookie ทิ้งทันที ไม่ให้ขั้นตอนอื่นใช้ต่อ
    if (me!.role === "OWNER") {
      fs.rmSync(account.state, { force: true });
      throw new Error(`${account.envPrefix} ต้องเป็นบัญชีทดสอบแยก ไม่ใช่บัญชีผู้ดูแลหลักของระบบ (สิทธิ์ “เจ้าของ”)`);
    }
    users[account.key] = me!.id;
  });
}

setup("บัญชีทดสอบทั้งสองต้องเป็นคนละบัญชี", async () => {
  expect(users.owner).toBeTruthy();
  expect(users.member).toBeTruthy();
  expect(users.owner, "E2E_OWNER และ E2E_MEMBER ต้องเป็นคนละบัญชี").not.toBe(users.member);
});
