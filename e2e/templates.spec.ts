import { test, expect } from "./support/fixtures";
import { simpleBubble } from "./support/api";
import { uniqueName } from "./support/env";

// หมวด F: Text Message และ Flex Message

test("F1 สร้าง Text Message พร้อมตัวแปร แล้วใช้ในกฎ", async ({ page, project, chat }) => {
  const name = uniqueName("ต้อนรับ");
  await page.goto(`/p/${project.id}/text-messages`);
  await page.getByRole("button", { name: "สร้างข้อความใหม่" }).click();
  await page.getByLabel("ชื่อ Template").fill(name);
  await page.locator("textarea").first().fill("สวัสดีคุณ {{displayName}} ยินดีต้อนรับ");
  // พรีวิวแทนตัวแปรด้วยชื่อตัวอย่าง
  await page.getByLabel("ชื่อลูกค้าตัวอย่าง").fill("สมหญิง");
  await expect(page.getByText("สวัสดีคุณ สมหญิง ยินดีต้อนรับ")).toBeVisible();
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(page.getByText("บันทึกข้อความแล้ว")).toBeVisible();

  const templates = await project.api.get<{ id: string; name: string }[]>("/api/text-templates");
  const saved = templates.find((t) => t.name === name);
  expect(saved, "ต้องบันทึก Template แล้ว").toBeTruthy();
  await project.api.createRule({ keywords: ["ต้อนรับ"], messages: [{ type: "TEXT", textTemplateId: saved!.id }] });
  await chat.expectReply("ต้อนรับ", { contains: ["ยินดีต้อนรับ"], absent: ["{{displayName}}"] });
});

test("F2 สร้าง Flex จากเทมเพลตตั้งต้นใน Flex Message Builder แล้วใช้ในกฎ", async ({ page, project, chat }) => {
  const name = uniqueName("โปรโมชัน");
  await page.goto(`/p/${project.id}/flex-builder/new`);
  // ระบบจะถามยืนยันก่อนแทนที่งานที่ยังไม่บันทึก → ตอบตกลง
  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "โหลด Template" }).click();
  await page.getByRole("dialog", { name: "โหลด Template" }).getByRole("button", { name: /^โปรโมชัน/ }).click();
  await expect(page.getByText("โหลด Flex Message แล้ว")).toBeVisible();
  await page.getByLabel("ชื่อ Template").fill(name);
  await page.getByRole("button", { name: "บันทึก Template" }).click();
  await expect(page.getByText("บันทึก Template แล้ว")).toBeVisible();
  await expect(page).toHaveURL(/\/flex-builder\/[0-9a-f-]{36}/);

  const id = new URL(page.url()).pathname.split("/").pop()!;
  await project.api.createRule({ keywords: ["ดูโปร"], messages: [{ type: "FLEX", flexTemplateId: id }] });
  // การ์ดที่ได้มีปุ่ม “รับคูปอง” แบบเดียวกับพรีวิว
  await chat.expectReply("ดูโปร", { contains: ["รับคูปอง"] });
});

test("F3 นำเข้า JSON ที่ผิดรูปแบบ", async ({ page, project }) => {
  await page.goto(`/p/${project.id}/flex-builder/new`);
  await page.getByRole("button", { name: "นำเข้า JSON" }).click();
  const dialog = page.getByRole("dialog", { name: "นำเข้า JSON" });
  await dialog.locator("textarea").fill('{"type": "bubble", "body": ');
  await dialog.getByRole("button", { name: "นำเข้า", exact: true }).click();
  await expect(dialog.getByText(/JSON ไม่ถูกต้อง/)).toBeVisible();
  await expect(dialog, "หน้าต่างยังเปิดอยู่ให้แก้ไข").toBeVisible();
});

test("F4 ลบเทมเพลตที่กฎใช้อยู่ไม่ได้", async ({ page, project }) => {
  const template = await project.api.createTextTemplate("ข้อความที่กฎใช้อยู่");
  await project.api.createRule({ keywords: ["ใช้อยู่"], messages: [{ type: "TEXT", textTemplateId: template.id }] });

  await page.goto(`/p/${project.id}/text-messages`);
  await page.getByRole("button", { name: new RegExp(template.name.replace(/[[\]]/g, "\\$&")) }).click();
  await page.getByRole("button", { name: "ลบ", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "ลบ", exact: true }).click();
  await expect(page.getByText("ไม่สามารถลบได้ เนื่องจากถูกใช้งานในกฎตอบกลับ 1 กฎ")).toBeVisible();

  // Flex Message ก็ลบไม่ได้เช่นกัน
  const flex = await project.api.createFlexTemplate(simpleBubble("Flex ที่กฎใช้อยู่"));
  await project.api.createRule({ keywords: ["flexใช้อยู่"], messages: [{ type: "FLEX", flexTemplateId: flex.id }] });
  const res = await project.api.call("DELETE", `/api/flex-templates/${flex.id}`);
  expect(res.status).toBe(409);
  expect(res.message).toContain("ถูกใช้งานในกฎตอบกลับ");
});
