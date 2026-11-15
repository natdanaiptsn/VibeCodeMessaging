import { test, expect } from "./support/fixtures";
import { uniqueName } from "./support/env";

// หมวด B: โปรเจกต์ (ใช้บัญชีทดสอบหลัก ทุกโปรเจกต์ชื่อขึ้นต้นด้วย [E2E] และถูกลบหลังจบ)

test("B1 สร้างโปรเจกต์ใหม่", async ({ page, api }) => {
  const name = uniqueName("สร้างจากหน้าเว็บ");
  await page.goto("/projects");
  await page.getByRole("button", { name: "สร้างโปรเจกต์", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "สร้างโปรเจกต์ใหม่" });
  await dialog.getByLabel("ชื่อโปรเจกต์").fill(name);

  // เข้าหน้า LINE OA Settings ของโปรเจกต์ใหม่ทันที
  // (ระบบจำกัดการสร้างโปรเจกต์ 20 ครั้ง/นาที — ถ้าขึ้นว่าถี่เกินไป ให้รอแล้วกดใหม่)
  const created = /\/p\/[0-9a-f-]{36}\/line-settings/;
  await expect(async () => {
    if (!created.test(page.url())) await dialog.getByRole("button", { name: "สร้างโปรเจกต์" }).click();
    await expect(page).toHaveURL(created, { timeout: 5_000 });
  }).toPass({ timeout: 75_000, intervals: [10_000] });
  const id = page.url().match(/\/p\/([0-9a-f-]{36})\//)![1]!;
  try {
    await expect(page.getByText("ยังไม่ได้เชื่อมต่อ").first()).toBeVisible();
    await page.goto("/projects");
    await page.getByRole("tab", { name: /^ของฉัน/ }).click();
    await expect(page.getByRole("link", { name })).toBeVisible();
  } finally {
    await api.call("DELETE", `/api/projects/${id}`);
  }
});

test("B2 เปลี่ยนชื่อโปรเจกต์", async ({ page, project }) => {
  const newName = uniqueName("ชื่อใหม่");
  await page.goto("/projects");
  await page.getByRole("button", { name: `เมนูของ ${project.name}` }).click();
  await page.getByRole("menuitem", { name: "เปลี่ยนชื่อ / คำอธิบาย" }).click();
  const dialog = page.getByRole("dialog", { name: "แก้ไขโปรเจกต์" });
  await dialog.getByLabel("ชื่อโปรเจกต์").fill(newName);
  await dialog.getByRole("button", { name: "บันทึก" }).click();

  await expect(page.getByRole("link", { name: newName })).toBeVisible();
  await page.goto(`/p/${project.id}/inbox`);
  await expect(page.getByRole("button", { name: "เปลี่ยนโปรเจกต์" })).toContainText(newName);
});

test("B3 ข้อมูลแต่ละโปรเจกต์แยกกัน และสลับโปรเจกต์แล้วอยู่เมนูเดิม", async ({ page, project, newProject }) => {
  const other = await newProject("โปรเจกต์ B");
  const rule = await project.api.createRule({ keywords: ["แยกโปรเจกต์"] });

  await page.goto(`/p/${project.id}/auto-reply`);
  await expect(page.getByText(rule.name).first()).toBeVisible();

  await page.getByRole("button", { name: "เปลี่ยนโปรเจกต์" }).click();
  await page.getByRole("menuitem", { name: other.name }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${other.id}/auto-reply`));
  await expect(page.getByRole("button", { name: "เพิ่มกฎแรก" })).toBeVisible();
  await expect(page.getByText(rule.name)).toHaveCount(0);
});

test("B4 ตัวกรองในหน้าโปรเจกต์", async ({ page, project }) => {
  await page.goto("/projects");
  const card = page.getByRole("link", { name: project.name });
  // โปรเจกต์ทดสอบเป็นของเรา และยังไม่เชื่อม LINE
  const cases: [string, boolean][] = [
    ["ทั้งหมด", true],
    ["ของฉัน", true],
    ["แชร์กับฉัน", false],
    ["เชื่อมต่อแล้ว", false],
    ["ยังไม่เชื่อมต่อ", true],
  ];
  for (const [label, shown] of cases) {
    const tab = page.getByRole("tab", { name: new RegExp(`^${label}`) });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    if (shown) await expect(card, `ตัวกรอง “${label}” ควรแสดงโปรเจกต์นี้`).toBeVisible();
    else await expect(card, `ตัวกรอง “${label}” ไม่ควรแสดงโปรเจกต์นี้`).toHaveCount(0);
  }
});

test("B10 ลบโปรเจกต์ต้องพิมพ์ชื่อยืนยัน", async ({ page, project }) => {
  await page.goto("/projects");
  await page.getByRole("button", { name: `เมนูของ ${project.name}` }).click();
  await page.getByRole("menuitem", { name: "ลบโปรเจกต์" }).click();

  const dialog = page.getByRole("dialog");
  const confirmInput = dialog.getByLabel(/พิมพ์ชื่อโปรเจกต์/);
  const deleteButton = dialog.getByRole("button", { name: "ลบโปรเจกต์" });
  await expect(deleteButton).toBeDisabled();
  await confirmInput.fill("ชื่อไม่ตรง");
  await expect(deleteButton).toBeDisabled();
  await confirmInput.fill(project.name);
  await expect(deleteButton).toBeEnabled();
  await deleteButton.click();

  // รอให้ลบเสร็จและหน้าต่างปิดก่อน (ระหว่างหน้าต่างเปิด ส่วนอื่นของหน้าจะถูกซ่อนจากการค้นหา)
  await expect(page.getByText(`ลบโปรเจกต์ “${project.name}” แล้ว`)).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: project.name })).toHaveCount(0);
  expect((await project.api.call("GET", "/api/rules")).status, "ลบแล้วต้องเปิดโปรเจกต์ไม่ได้").toBe(404);
});
