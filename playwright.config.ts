import { defineConfig, devices } from "@playwright/test";
import { ACCOUNTS, BASE_URL } from "./e2e/support/env"; // อ่านค่าจาก .env.e2e

/**
 * Playwright E2E — ทดสอบผ่านเบราว์เซอร์จริง (ค่าเริ่มต้นคือเว็บจริงบน Vercel)
 * ปลอดภัยกับเว็บจริงเพราะ: ใช้บัญชีทดสอบแยก, สร้างโปรเจกต์ [E2E] ใหม่ทุกเทสต์แล้วลบทิ้ง, ไม่เชื่อม LINE OA,
 * ทดสอบกฎผ่านแชททดสอบ (ไม่ส่งข้อความจริง) และรันทีละเทสต์
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // ทีละเทสต์ ไม่ยิงเว็บจริงถี่เกินไป
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, teardown: "cleanup" },
    { name: "cleanup", testMatch: /cleanup\.teardown\.ts/ },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: ACCOUNTS.owner.state },
    },
  ],
});
