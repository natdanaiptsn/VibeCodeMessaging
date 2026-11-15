import { randomBytes } from "node:crypto";
import { devices } from "@playwright/test";
import { test, expect } from "./support/fixtures";
import { ACCOUNTS, BASE_URL } from "./support/env";

// หมวด H: ความปลอดภัยและอื่น ๆ

test("H2 Webhook ที่ไม่มีลายเซ็น / ลายเซ็นผิด ถูกปฏิเสธ", async ({ project, playwright }) => {
  // ตั้ง Channel secret ปลอมให้โปรเจกต์ทดสอบ (ไม่ได้เชื่อม LINE จริง และโปรเจกต์จะถูกลบหลังจบ)
  await project.api.ok("PUT", "/api/line/credentials", { channelSecret: randomBytes(16).toString("hex") });

  const outsider = await playwright.request.newContext({ baseURL: BASE_URL }); // ไม่มี cookie เหมือนคนภายนอก
  try {
    const body = { destination: "U0000000000000000000000000000000", events: [] };
    const noSignature = await outsider.post(`/api/webhook/line/${project.id}`, { data: body });
    expect(noSignature.status()).toBe(401);
    const wrongSignature = await outsider.post(`/api/webhook/line/${project.id}`, {
      data: body,
      headers: { "x-line-signature": "aW52YWxpZC1zaWduYXR1cmU=" },
    });
    expect(wrongSignature.status()).toBe(401);
  } finally {
    await outsider.dispose();
  }
});

test("H3 โหมดมืดจำค่าหลังรีเฟรช และไม่กระพริบ", async ({ page, project }) => {
  const isDark = () => page.evaluate(() => document.documentElement.classList.contains("dark"));
  await page.goto(`/p/${project.id}/auto-reply`);
  const theme = page.getByRole("radiogroup", { name: "ธีมสี" });
  await theme.getByRole("radio", { name: "มืด" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  try {
    for (const path of ["/auto-reply", "/inbox", "/customers", "/text-messages", "/flex-builder", "/settings"]) {
      // เช็คทันทีที่ HTML โหลดเสร็จ (ก่อนรูป/สคริปต์อื่น) — ถ้ามืดแล้วแปลว่าไม่มีจอขาวกระพริบ
      await page.goto(`/p/${project.id}${path}`, { waitUntil: "domcontentloaded" });
      expect(await isDark(), `${path} ควรเป็นโหมดมืดตั้งแต่โหลด`).toBe(true);
    }
  } finally {
    await page.getByRole("radiogroup", { name: "ธีมสี" }).getByRole("radio", { name: "สว่าง" }).click();
  }
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});

test("H4 ใช้งานบนมือถือ (ไม่ล้นจอ และเปิดเมนูได้)", async ({ browser, project }) => {
  const context = await browser.newContext({ ...devices["Pixel 7"], storageState: ACCOUNTS.owner.state });
  const page = await context.newPage();
  try {
    for (const path of ["/inbox", "/customers", "/auto-reply", "/text-messages", "/flex-builder", "/line-settings", "/settings"]) {
      await page.goto(`/p/${project.id}${path}`);
      await expect(page.locator("main")).not.toContainText("กำลังโหลด", { timeout: 15_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} ไม่ควรล้นจอแนวนอน`).toBeLessThanOrEqual(1);
    }
    await page.getByRole("button", { name: "เปิดเมนู" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu.getByRole("link", { name: "ระบบตอบกลับอัตโนมัติ" })).toBeVisible();
    await menu.getByRole("link", { name: "ระบบตอบกลับอัตโนมัติ" }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${project.id}/auto-reply`));
    await expect(menu).toBeHidden();
  } finally {
    await context.close();
  }
});
