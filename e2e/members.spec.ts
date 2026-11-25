import { test, expect } from "./support/fixtures";
import { ruleBody } from "./support/api";

// หมวด B5–B9: สมาชิกและสิทธิ์ — ใช้บัญชีทดสอบ 2 บัญชีพร้อมกัน (page = บัญชีหลัก, memberPage = บัญชีที่สอง)

test("B5 บัญชีอื่นเปิดโปรเจกต์ที่ไม่ได้เป็นสมาชิกไม่ได้", async ({ project, memberPage, memberApi }) => {
  const res = await memberPage.goto(`/p/${project.id}/auto-reply`);
  expect(res?.status(), "ต้องได้หน้า “ไม่พบหน้า”").toBe(404);
  await expect(memberPage.getByText(project.name)).toHaveCount(0);
  expect((await memberApi.forProject(project.id).call("GET", "/api/rules")).status).toBe(404);

  await memberPage.goto("/projects");
  // รอให้รายการโปรเจกต์โหลดเสร็จก่อน (ตัวเลขในแท็บ “ทั้งหมด” ขึ้นแล้ว) แล้วค่อยเช็คว่าไม่มีโปรเจกต์นี้
  await expect(memberPage.getByRole("tab", { name: /^ทั้งหมด\s*\d+$/ })).toBeVisible();
  await expect(memberPage.getByRole("link", { name: project.name })).toHaveCount(0);
});

test("B6 เพิ่มสมาชิกด้วยชื่อผู้ใช้ แล้วอีกบัญชีเห็นใน “แชร์กับฉัน”", async ({ page, project, memberPage, memberApi }) => {
  const member = await memberApi.me();
  await page.goto(`/p/${project.id}/settings?tab=members`);
  await page.getByLabel("อีเมลหรือชื่อผู้ใช้").fill(member.username ?? member.email!);
  await expect(page.getByRole("combobox", { name: "บทบาท", exact: true })).toContainText("เจ้าหน้าที่");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
  await expect(page.getByText("เพิ่มสมาชิกแล้ว")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: member.name })).toBeVisible();

  await memberPage.goto("/projects");
  await memberPage.getByRole("tab", { name: /^แชร์กับฉัน/ }).click();
  await expect(memberPage.getByRole("link", { name: project.name })).toBeVisible();
  await expect(memberPage.getByText("แชร์กับฉัน · เจ้าหน้าที่")).toBeVisible();
});

test("B6 (อีเมล) เพิ่มสมาชิกด้วยอีเมลได้", async ({ project, memberApi }) => {
  const member = await memberApi.me();
  test.skip(!member.email, "บัญชีทดสอบที่สองไม่มีอีเมล — ข้ามการเพิ่มด้วยอีเมล");
  await project.api.ok("POST", "/api/members", { identifier: member.email!.toUpperCase(), role: "AGENT" });
  expect((await memberApi.forProject(project.id).call("GET", "/api/rules")).status).toBe(200);
});

test("B7 สิทธิ์ของเจ้าหน้าที่", async ({ project, memberPage, memberApi }) => {
  const member = await memberApi.me();
  await project.api.ok("POST", "/api/members", { identifier: member.username ?? member.email, role: "AGENT" });
  const rule = await project.api.createRule({ keywords: ["สิทธิ์"] });

  await memberPage.goto(`/p/${project.id}/auto-reply`);
  const nav = memberPage.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "กล่องข้อความ" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "LINE OA Settings" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "ตั้งค่าโปรเจกต์" })).toHaveCount(0);
  // ดูกฎได้ แต่ไม่มีปุ่มสร้าง/แก้ไข/ลบ
  await expect(memberPage.getByText(rule.name).first()).toBeVisible();
  await expect(memberPage.getByRole("button", { name: /เพิ่มกฎ/ })).toHaveCount(0);
  await expect(memberPage.getByRole("button", { name: "เมนู", exact: true })).toHaveCount(0);

  const asMember = memberApi.forProject(project.id);
  expect((await asMember.call("POST", "/api/rules", ruleBody({ keywords: ["x"] }))).status).toBe(403);
  // เปิดหน้าตั้งค่าตรง ๆ จะถูกพากลับไปกล่องข้อความ
  await memberPage.goto(`/p/${project.id}/settings`);
  await expect(memberPage).toHaveURL(new RegExp(`/p/${project.id}/inbox`));
});

test("B8 เปลี่ยนบทบาทเป็นผู้ดูแล", async ({ page, project, memberPage, memberApi }) => {
  const member = await memberApi.me();
  await project.api.ok("POST", "/api/members", { identifier: member.username ?? member.email, role: "AGENT" });

  await page.goto(`/p/${project.id}/settings?tab=members`);
  await page.getByRole("combobox", { name: `บทบาทของ ${member.name}` }).click();
  await page.getByRole("option", { name: "ผู้ดูแล", exact: true }).click();
  await expect(page.getByText(`เปลี่ยน ${member.name} เป็นผู้ดูแลแล้ว`)).toBeVisible();

  await memberPage.goto(`/p/${project.id}/auto-reply`);
  const nav = memberPage.getByRole("navigation");
  await expect(nav.getByRole("link", { name: "ตั้งค่าโปรเจกต์" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "LINE OA Settings" })).toBeVisible();
  // รอรายการกฎโหลดเสร็จก่อน (โปรเจกต์ยังไม่มีกฎ จึงมีปุ่ม “เพิ่มกฎแรก” กลางหน้า) แล้วเช็คปุ่ม “เพิ่มกฎ” ด้านบนแบบชื่อตรงตัว
  await expect(memberPage.getByRole("button", { name: "เพิ่มกฎแรก", exact: true })).toBeVisible();
  await expect(memberPage.getByRole("button", { name: "เพิ่มกฎ", exact: true })).toBeVisible();

  const asMember = memberApi.forProject(project.id);
  expect((await asMember.call("POST", "/api/rules", ruleBody({ keywords: ["ผู้ดูแล"] }))).status).toBeLessThan(300);
  // เชื่อม LINE และลบโปรเจกต์ได้เฉพาะเจ้าของ
  expect((await asMember.call("POST", "/api/line/connect", {})).status).toBe(403);
  expect((await asMember.call("DELETE", `/api/projects/${project.id}`)).status).toBe(403);
  await memberPage.goto(`/p/${project.id}/line-settings`);
  await expect(memberPage.getByText(/เท่านั้นที่กรอกข้อมูลและกดเชื่อมต่อได้/)).toBeVisible();
});

test("B9 นำสมาชิกออก และออกจากโปรเจกต์เอง", async ({ page, project, memberPage, memberApi }) => {
  const member = await memberApi.me();
  const identifier = member.username ?? member.email;
  const asMember = memberApi.forProject(project.id);

  // 1) เจ้าของนำสมาชิกออก
  await project.api.ok("POST", "/api/members", { identifier, role: "AGENT" });
  await page.goto(`/p/${project.id}/settings?tab=members`);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: `นำ ${member.name} ออก` }).click();
  await expect(page.getByText(`นำ ${member.name} ออกแล้ว`)).toBeVisible();
  expect((await asMember.call("GET", "/api/rules")).status).toBe(404);

  // 2) เพิ่มกลับ แล้วให้สมาชิกกดออกจากโปรเจกต์เอง
  await project.api.ok("POST", "/api/members", { identifier, role: "AGENT" });
  await memberPage.goto("/projects");
  memberPage.once("dialog", (d) => void d.accept());
  await memberPage.getByRole("button", { name: `เมนูของ ${project.name}` }).click();
  await memberPage.getByRole("menuitem", { name: "ออกจากโปรเจกต์" }).click();
  await expect(memberPage.getByText(`ออกจากโปรเจกต์ “${project.name}” แล้ว`)).toBeVisible();
  await expect(memberPage.getByRole("link", { name: project.name })).toHaveCount(0);
  expect((await asMember.call("GET", "/api/rules")).status).toBe(404);
  expect((await memberPage.goto(`/p/${project.id}/inbox`))?.status()).toBe(404);
});
