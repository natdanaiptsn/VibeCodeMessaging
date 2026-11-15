import { test, expect } from "./support/fixtures";
import { postbackBubble, simpleBubble } from "./support/api";
import { uniqueName } from "./support/env";
import { DEFAULT_REPLY_NOTE, NO_MATCH_NOTE } from "./support/test-chat";

// หมวด D: กฎตอบกลับอัตโนมัติ — ตรวจคำตอบผ่าน “แชททดสอบ” ซึ่งใช้กฎชุดเดียวกับ LINE จริง (แต่ไม่ส่งข้อความจริง)

test("D2 Exact Match กับ Contains", async ({ page, project, chat }) => {
  const rule = await project.api.createRule({
    matchType: "EXACT",
    keywords: ["ราคา"],
    messages: [{ type: "TEXT", text: "ราคา 100 บาท" }],
  });
  await page.goto(`/p/${project.id}/customers`);
  await chat.expectReply("ราคา", { contains: ["ราคา 100 บาท"] });
  await chat.expectReply("ขอราคาหน่อย", { contains: [NO_MATCH_NOTE], absent: ["ราคา 100 บาท"] });

  await project.api.updateRule(rule.id, { ...rule.body, matchType: "CONTAINS" });
  await chat.expectReply("ขอราคาหน่อย", { contains: ["ราคา 100 บาท"] });
});

test("D3 กฎเดียวตอบหลายข้อความ (สร้างจากฟอร์ม และสลับลำดับ)", async ({ page, project, chat }) => {
  const flex = await project.api.createFlexTemplate(simpleBubble("การ์ด-Flex-E2E"));
  await page.goto(`/p/${project.id}/auto-reply`);
  await page.getByRole("button", { name: "เพิ่มกฎ", exact: true }).click();
  const form = page.getByRole("dialog", { name: "เพิ่มกฎตอบกลับ" });
  await form.getByLabel("ชื่อกฎ").fill(uniqueName("หลายข้อความ"));
  const keyword = form.getByPlaceholder("พิมพ์ Keyword แล้วกด Enter");
  await keyword.fill("สามข้อความ");
  await keyword.press("Enter");

  await form.getByRole("textbox", { name: "ข้อความที่ 1", exact: true }).fill("ข้อความ-หนึ่ง");
  await form.getByRole("button", { name: "เพิ่ม Flex Message" }).click();
  await form.getByRole("combobox", { name: "Flex Message ของข้อความที่ 2" }).click();
  await page.getByRole("option", { name: flex.name }).click();
  await form.getByRole("button", { name: "เพิ่มข้อความ", exact: true }).click();
  await form.getByRole("textbox", { name: "ข้อความที่ 3", exact: true }).fill("ข้อความ-สาม");

  // [หนึ่ง, Flex, สาม] → [หนึ่ง, สาม, Flex] → [สาม, หนึ่ง, Flex]
  await form.getByRole("button", { name: "เลื่อนข้อความที่ 3 ขึ้น" }).click();
  await form.getByRole("button", { name: "เลื่อนข้อความที่ 1 ลง" }).click();
  await form.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("สร้างกฎตอบกลับแล้ว")).toBeVisible();

  await chat.expectReply("สามข้อความ", { inOrder: ["ข้อความ-สาม", "ข้อความ-หนึ่ง", "การ์ด-Flex-E2E"] });
});

test("D4 เพิ่มข้อความในกฎได้สูงสุด 5 อัน", async ({ page, project }) => {
  await page.goto(`/p/${project.id}/auto-reply`);
  await page.getByRole("button", { name: "เพิ่มกฎ", exact: true }).click();
  const form = page.getByRole("dialog", { name: "เพิ่มกฎตอบกลับ" });
  const addText = form.getByRole("button", { name: "เพิ่มข้อความ", exact: true });
  for (let i = 2; i <= 5; i++) {
    await addText.click();
    await expect(form.getByRole("textbox", { name: `ข้อความที่ ${i}`, exact: true })).toBeVisible();
  }
  await expect(addText).toBeDisabled();
  await expect(form.getByRole("button", { name: "เพิ่ม Flex Message" })).toBeDisabled();
});

test("D5 จำกัดจำนวนข้อความต่อการตอบกลับ", async ({ page, project, chat }) => {
  await project.api.updateSettings({ general: { maxMessagesPerReply: 2 } });
  const rule = await project.api.createRule({
    keywords: ["จำกัดข้อความ"],
    messages: [
      { type: "TEXT", text: "ส่วนที่-1" },
      { type: "TEXT", text: "ส่วนที่-2" },
      { type: "TEXT", text: "ส่วนที่-3" },
    ],
  });

  // ฟอร์มกฎเตือนว่าข้อความที่ 3 จะไม่ถูกส่ง
  await expect(async () => {
    await page.goto(`/p/${project.id}/auto-reply`);
    await page.getByRole("row").filter({ hasText: rule.name }).getByRole("button", { name: "เมนู", exact: true }).click();
    await page.getByRole("menuitem", { name: "แก้ไข" }).click();
    await expect(page.getByRole("dialog")).toContainText("ข้อความลำดับที่ 3 เป็นต้นไปจะไม่ถูกส่ง", { timeout: 3_000 });
  }).toPass({ timeout: 25_000 });
  await page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }).click();

  await chat.expectReply("จำกัดข้อความ", { contains: ["ส่วนที่-1", "ส่วนที่-2"], absent: ["ส่วนที่-3"] });
});

test("D6 Priority และโหมดเมื่อข้อความตรงหลายกฎ", async ({ page, project, chat }) => {
  await project.api.createRule({ priority: 10, keywords: ["โปร"], messages: [{ type: "TEXT", text: "คำตอบ-กฎ-A" }] });
  await project.api.createRule({ priority: 1, keywords: ["โปร"], messages: [{ type: "TEXT", text: "คำตอบ-กฎ-B" }] });
  await page.goto(`/p/${project.id}/customers`);

  // ค่าเริ่มต้น: ใช้กฎ Priority สูงสุดกฎเดียว
  await chat.expectReply("โปรเดือนนี้", { contains: ["คำตอบ-กฎ-A"], absent: ["คำตอบ-กฎ-B"] });
  await project.api.updateSettings({ general: { multiRuleMode: "ALL_MATCHES" } });
  await chat.expectReply("โปรเดือนนี้", { inOrder: ["คำตอบ-กฎ-A", "คำตอบ-กฎ-B"] });
});

test("D7 ปิดกฎแล้วไม่ตอบ", async ({ page, project, chat }) => {
  const rule = await project.api.createRule({ keywords: ["ปิดกฎ"], messages: [{ type: "TEXT", text: "กฎนี้ยังเปิดอยู่" }] });
  await page.goto(`/p/${project.id}/auto-reply`);
  await chat.expectReply("ปิดกฎ", { contains: ["กฎนี้ยังเปิดอยู่"] });
  await chat.close();

  const toggle = page.getByRole("switch", { name: `เปิด/ปิด ${rule.name}` });
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/api/rules/${rule.id}`) && r.request().method() !== "GET" && r.ok()),
    toggle.click(),
  ]);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await chat.expectReply("ปิดกฎ", { contains: [NO_MATCH_NOTE], absent: ["กฎนี้ยังเปิดอยู่"] });
});

test("D8 Default Reply เมื่อไม่ตรงกฎใดเลย", async ({ page, project, chat }) => {
  const template = await project.api.createTextTemplate("ขออภัย ยังไม่เข้าใจข้อความ (Default E2E)");
  await page.goto(`/p/${project.id}/customers`);
  await chat.expectReply("asdfgh", { contains: [NO_MATCH_NOTE] });

  await project.api.updateSettings({
    defaultReply: { enabled: true, replyType: "TEXT", textTemplateId: template.id, flexTemplateId: null, cooldownMinutes: 0 },
  });
  await chat.expectReply("asdfgh", { contains: [DEFAULT_REPLY_NOTE, "ยังไม่เข้าใจข้อความ (Default E2E)"] });
});

test("D9 ตัวแปรในข้อความ ({{displayName}} และ {{time}})", async ({ page, project, chat, api }) => {
  const me = await api.me();
  await project.api.createRule({
    keywords: ["ตัวแปร"],
    messages: [{ type: "TEXT", text: "สวัสดีคุณ {{displayName}} ตอนนี้ {{time}} น." }],
  });
  await page.goto(`/p/${project.id}/customers`);
  await chat.expectReply("ตัวแปร", { contains: [`สวัสดีคุณ ${me.name} ตอนนี้`], absent: ["{{"] });

  // เวลาตาม Timezone ของโปรเจกต์ (ค่าเริ่มต้น Asia/Bangkok)
  const shown = (await chat.text()).match(/ตอนนี้ (\d{1,2}):(\d{2}) น\./);
  expect(shown, "ควรเห็นเวลาแบบ ชั่วโมง:นาที").toBeTruthy();
  const bangkokHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date()));
  const diff = Math.abs(Number(shown![1]) - bangkokHour) % 23; // เผื่อเทสต์รันคร่อมชั่วโมง
  expect(diff).toBeLessThanOrEqual(1);
});

test("D12 Postback จากปุ่มใน Flex", async ({ page, project, chat }) => {
  const flex = await project.api.createFlexTemplate(postbackBubble("รับคูปอง", "action=coupon&id=PROMO20"));
  await project.api.createRule({ keywords: ["คูปอง"], messages: [{ type: "FLEX", flexTemplateId: flex.id }] });
  await project.api.createRule({
    triggerType: "POSTBACK",
    keywords: ["action=coupon"],
    messages: [{ type: "TEXT", text: "รับคูปองเรียบร้อย ✅" }],
  });
  await page.goto(`/p/${project.id}/customers`);
  await chat.expectReply("คูปอง", { contains: ["โปรโมชันพิเศษ"] });

  await chat.panel.getByRole("button", { name: "รับคูปอง" }).click();
  await chat.waitForResult(2);
  await expect(chat.panel).toContainText("รับคูปองเรียบร้อย ✅");
});

test("D13 Regular Expression และการกัน ReDoS", async ({ page, project, chat }) => {
  await page.goto(`/p/${project.id}/auto-reply`);
  await page.getByRole("button", { name: "เพิ่มกฎ", exact: true }).click();
  const form = page.getByRole("dialog", { name: "เพิ่มกฎตอบกลับ" });
  await form.getByLabel("ชื่อกฎ").fill(uniqueName("Regex"));
  const matchField = form
    .locator("div")
    .filter({ has: page.getByText("เงื่อนไขการจับคู่", { exact: true }) })
    .filter({ has: page.getByRole("combobox") })
    .last();
  await matchField.getByRole("combobox").click();
  await page.getByRole("option", { name: "Regular Expression" }).click();

  const keyword = form.getByPlaceholder("เช่น ^(ราคา|เท่าไหร่)");
  const save = form.getByRole("button", { name: "บันทึก", exact: true });
  await keyword.fill("(a+)+");
  await keyword.press("Enter");
  await expect(form.getByText(/มีความเสี่ยง ReDoS|ไม่อนุญาต quantifier ซ้อน/).first()).toBeVisible();
  await expect(save).toBeDisabled();

  await form.getByRole("button", { name: "ลบ (a+)+" }).click();
  await keyword.fill("^(ราคา|เท่าไหร่)");
  await keyword.press("Enter");
  await expect(save).toBeEnabled();
  await form.getByRole("textbox", { name: "ข้อความที่ 1", exact: true }).fill("ตอบจาก Regex");
  await save.click();
  await expect(page.getByText("สร้างกฎตอบกลับแล้ว")).toBeVisible();

  await chat.expectReply("เท่าไหร่ครับ", { contains: ["ตอบจาก Regex"] });
  await chat.expectReply("ขอดูราคาหน่อย", { contains: [NO_MATCH_NOTE], absent: ["ตอบจาก Regex"] });
});

test("D14 ปิด Auto Reply ทั้งโปรเจกต์", async ({ page, project, chat }) => {
  await project.api.createRule({ keywords: ["test"], messages: [{ type: "TEXT", text: "บอทตอบอยู่" }] });
  const warning = "ระบบตอบกลับอัตโนมัติปิดอยู่ ลูกค้าจริงจะไม่ได้รับคำตอบ";

  const setAutoReply = async (on: boolean) => {
    await page.goto(`/p/${project.id}/settings`);
    const toggle = page
      .getByText("เปิด/ปิด Auto Reply", { exact: true })
      .locator("xpath=ancestor::div[.//button[@role='switch']][1]")
      .getByRole("switch");
    await expect(toggle).toHaveAttribute("aria-checked", on ? "false" : "true");
    await toggle.click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
    await expect(page.getByText("บันทึกการตั้งค่าแล้ว")).toBeVisible();
  };

  await setAutoReply(false);
  // แชททดสอบยังแสดงคำตอบให้ดู แต่เตือนว่าลูกค้าจริงจะไม่ได้รับคำตอบ
  await chat.expectReply("test", { contains: ["บอทตอบอยู่", warning] });
  await expect(async () => {
    await page.goto("/projects");
    const card = page
      .locator("div")
      .filter({ has: page.getByRole("link", { name: project.name }) })
      .filter({ hasText: "ตอบกลับอัตโนมัติ" })
      .last();
    await expect(card).toContainText("ตอบกลับอัตโนมัติปิด", { timeout: 3_000 });
  }).toPass({ timeout: 25_000 });

  await setAutoReply(true);
  await chat.expectReply("test", { contains: ["บอทตอบอยู่"], absent: [warning] });
});
