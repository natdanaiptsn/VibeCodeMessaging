import { test, expect } from "./support/fixtures";
import { NO_MATCH_NOTE } from "./support/test-chat";

// หมวด E: แชททดสอบในเว็บ

test("E1 แชททดสอบตอบเหมือน LINE จริง (กฎทดสอบ test และ TestFlex)", async ({ page, project, chat }) => {
  // ปุ่ม “สร้างกฎทดสอบ” ในหน้า LINE OA Settings ใช้ API เดียวกันนี้
  await project.api.ok("POST", "/api/line/test-rule");
  await page.goto(`/p/${project.id}/customers`);

  await chat.expectReply("test", { contains: ["ระบบตอบกลับอัตโนมัติทำงานแล้ว", "ตรงกับกฎ", "ทดสอบระบบ (พิมพ์ test)"] });
  await expect(chat.panel).toContainText("แชททดสอบ · ไม่ส่งถึง LINE จริง");

  await chat.expectReply("TestFlex", { contains: ["ทดสอบ Flex (พิมพ์ TestFlex)"] });
  // ปุ่มในการ์ด Flex ส่งคำว่า test ออกไป แล้วได้คำตอบของกฎทดสอบ
  await chat.panel.getByRole("button", { name: "ทดสอบข้อความธรรมดา" }).click();
  await chat.waitForResult(2);
  await expect(chat.panel).toContainText("ระบบตอบกลับอัตโนมัติทำงานแล้ว");
});

test("E2 จำลองรูปภาพ สติกเกอร์ ตำแหน่ง และเพิ่มเพื่อน", async ({ page, project, chat }) => {
  const cases = [
    { kind: "image", trigger: "IMAGE", reply: "ได้รับรูปภาพแล้ว" },
    { kind: "sticker", trigger: "STICKER", reply: "ได้รับสติกเกอร์แล้ว" },
    { kind: "location", trigger: "LOCATION", reply: "ได้รับตำแหน่งแล้ว" },
    { kind: "follow", trigger: "FOLLOW", reply: "ยินดีต้อนรับเพื่อนใหม่" },
  ] as const;
  for (const c of cases) {
    await project.api.createRule({ triggerType: c.trigger, keywords: [], messages: [{ type: "TEXT", text: c.reply }] });
  }
  await page.goto(`/p/${project.id}/customers`);
  for (const c of cases) {
    await chat.expectReply({ simulate: c.kind }, { contains: [c.reply] });
  }
});

test("E3 ข้อความที่ไม่ตรงกฎในแชททดสอบ", async ({ page, project, chat }) => {
  await project.api.createRule({ keywords: ["สวัสดี"], messages: [{ type: "TEXT", text: "สวัสดีค่ะ" }] });
  await page.goto(`/p/${project.id}/customers`);
  await chat.expectReply("ข้อความที่ไม่มีกฎ", { contains: [NO_MATCH_NOTE], absent: ["สวัสดีค่ะ"] });
  await expect(chat.panel.getByRole("link", { name: "สร้างกฎ", exact: true })).toBeVisible();
});
