import fs from "node:fs";
import { test as teardown, request } from "@playwright/test";
import { Api } from "./support/api";
import { ACCOUNTS, BASE_URL, E2E_PREFIX } from "./support/env";

/**
 * เก็บกวาดหลังรันเสร็จ: ลบโปรเจกต์ [E2E] ที่อาจค้างอยู่ (เช่น กดหยุดกลางคัน)
 * ลบเฉพาะโปรเจกต์ที่ชื่อขึ้นต้นด้วย [E2E] และบัญชีทดสอบเป็นเจ้าของเท่านั้น
 */
teardown("ลบโปรเจกต์ [E2E] ที่ค้างอยู่", async () => {
  for (const account of Object.values(ACCOUNTS)) {
    if (!fs.existsSync(account.state)) continue;
    const ctx = await request.newContext({ baseURL: BASE_URL, storageState: account.state });
    try {
      const api = new Api(ctx);
      // เก็บกวาดเฉพาะบัญชีทดสอบ (ไม่ทำกับบัญชีผู้ดูแลหลัก)
      const me = await api.call<{ role: string }>("GET", "/api/auth/me");
      if (me.status !== 200 || me.data.role === "OWNER") continue;
      const r = await api.call<{ id: string; name: string; role: string }[]>("GET", "/api/projects");
      if (r.status !== 200) continue;
      for (const p of r.data) {
        if (p.role === "OWNER" && p.name.startsWith(E2E_PREFIX)) await api.call("DELETE", `/api/projects/${p.id}`);
      }
    } finally {
      await ctx.dispose();
    }
  }
});
