import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { Api } from "./api";
import { ACCOUNTS, uniqueName } from "./env";
import { TestChat } from "./test-chat";

export type TempProject = { id: string; name: string; api: Api };

type Fixtures = {
  /** API ของบัญชีทดสอบหลัก (ล็อกอินอยู่แล้วจาก auth.setup.ts) */
  api: Api;
  /** โปรเจกต์ใหม่ชื่อ [E2E] ... สร้างก่อนแต่ละเทสต์ และลบทิ้งหลังจบ (ไม่เชื่อม LINE จึงไม่กระทบลูกค้าจริง) */
  project: TempProject;
  /** สร้างโปรเจกต์ทดสอบเพิ่ม (ลบทิ้งให้อัตโนมัติหลังจบเทสต์) */
  newProject: (label?: string) => Promise<TempProject>;
  /** แชททดสอบบนหน้าของบัญชีหลัก */
  chat: TestChat;
  /** เบราว์เซอร์ของบัญชีทดสอบที่สอง (สำหรับ B5–B9) */
  memberContext: BrowserContext;
  memberPage: Page;
  memberApi: Api;
};

export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => {
    await use(new Api(page.request));
  },

  newProject: async ({ api }, use) => {
    const created: TempProject[] = [];
    await use(async (label = "โปรเจกต์") => {
      const p = await api.ok<{ id: string; name: string }>("POST", "/api/projects", { name: uniqueName(label) });
      const project = { id: p.id, name: p.name, api: api.forProject(p.id) };
      created.push(project);
      return project;
    });
    // ลบทิ้งเสมอ แม้เทสต์ไม่ผ่าน (ถ้าเทสต์ลบไปแล้วจะได้ 404 ซึ่งไม่เป็นไร)
    for (const p of created) await api.call("DELETE", `/api/projects/${p.id}`);
  },

  project: async ({ newProject }, use) => {
    await use(await newProject());
  },

  chat: async ({ page }, use) => {
    await use(new TestChat(page));
  },

  memberContext: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: ACCOUNTS.member.state });
    await use(context);
    await context.close();
  },

  memberPage: async ({ memberContext }, use) => {
    await use(await memberContext.newPage());
  },

  memberApi: async ({ memberPage }, use) => {
    await use(new Api(memberPage.request));
  },
});

export { expect };
