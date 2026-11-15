import { expect, type Page } from "@playwright/test";

/** ข้อความสรุปผลใต้คำตอบของบอท (บอกว่าตรงกฎไหน / ใช้ Default Reply / ไม่ตอบ) */
const RESULT_NOTE = /ตรงกับกฎ|ไม่มีกฎที่ตรง|ช่วงพัก \(cooldown\)|สร้างข้อความตอบกลับไม่สำเร็จ|ระบบตอบกลับอัตโนมัติถูกปิด|ไม่มีการตอบกลับ/;

export const NO_MATCH_NOTE = "ไม่มีกฎที่ตรงกับข้อความนี้";
export const DEFAULT_REPLY_NOTE = "ไม่มีกฎที่ตรง จึงตอบด้วยข้อความตอบกลับเริ่มต้น";

type Simulated = "image" | "sticker" | "location" | "follow";
const SIMULATE_BUTTON: Record<Simulated, string> = {
  image: "ส่งรูปภาพ (จำลอง)",
  sticker: "ส่งสติกเกอร์ (จำลอง)",
  location: "ส่งตำแหน่งที่ตั้ง (จำลอง)",
  follow: "จำลองลูกค้าเพิ่มเพื่อน",
};

export type ReplyExpectation = {
  /** ต้องเห็นข้อความเหล่านี้ */
  contains?: string[];
  /** ต้องไม่เห็นข้อความเหล่านี้ */
  absent?: string[];
  /** ต้องเห็นตามลำดับนี้ (เช่น กฎหลายข้อความ / Priority) */
  inOrder?: string[];
};

export function expectInOrder(text: string, parts: string[]) {
  let from = -1;
  for (const part of parts) {
    const at = text.indexOf(part, from + 1);
    expect(at, `ควรเห็น “${part}” ต่อจากข้อความก่อนหน้า\n--- ในแชท ---\n${text}`).toBeGreaterThan(from);
    from = at;
  }
}

/**
 * แชททดสอบ (ปุ่มลอยมุมขวาล่างในทุกหน้าของโปรเจกต์)
 * ใช้กฎชุดเดียวกับ LINE จริง แต่ไม่ส่งข้อความถึง LINE ไม่บันทึกข้อมูล และไม่เสียโควตา — จึงปลอดภัยกับเว็บจริง
 */
export class TestChat {
  constructor(readonly page: Page) {}

  get panel() {
    return this.page.getByRole("region", { name: "แชททดสอบ" });
  }

  async open() {
    if (!(await this.panel.isVisible())) await this.page.getByRole("button", { name: "เปิดแชททดสอบ" }).click();
    await expect(this.panel).toBeVisible();
  }

  async close() {
    if (await this.panel.isVisible()) await this.panel.getByRole("button", { name: "ปิดแชททดสอบ" }).click();
    await expect(this.panel).toBeHidden();
  }

  async clear() {
    await this.open();
    await this.panel.getByRole("button", { name: "ล้างแชท" }).click();
  }

  /** ล้างแชท แล้วพิมพ์ข้อความเหมือนลูกค้า รอจนบอทตอบ (หรือบอกว่าไม่ตอบ) */
  async send(text: string) {
    await this.clear();
    await this.panel.getByLabel("ข้อความทดสอบ").fill(text);
    await this.panel.getByRole("button", { name: "ส่ง", exact: true }).click();
    await this.waitForResult();
  }

  /** ล้างแชท แล้วจำลองลูกค้าส่งรูป / สติกเกอร์ / ตำแหน่ง หรือเพิ่มเพื่อน */
  async simulate(kind: Simulated) {
    await this.clear();
    await this.panel.getByRole("button", { name: SIMULATE_BUTTON[kind] }).click();
    await this.waitForResult();
  }

  async waitForResult(count = 1) {
    await expect(this.panel.getByText(RESULT_NOTE)).toHaveCount(count, { timeout: 10_000 });
  }

  text() {
    return this.panel.innerText();
  }

  /**
   * ส่งข้อความแล้วตรวจคำตอบ — ถ้ายังไม่ตรงจะลองส่งใหม่จนครบเวลา
   * (เว็บจริงบน Vercel มีหลายเครื่อง และแต่ละเครื่องจำกฎ/การตั้งค่าไว้ 5 วินาที หลังแก้กฎจึงอาจเห็นของเดิมชั่วครู่)
   */
  async expectReply(input: string | { simulate: Simulated }, want: ReplyExpectation, timeout = 25_000) {
    await expect(async () => {
      if (typeof input === "string") await this.send(input);
      else await this.simulate(input.simulate);
      const text = await this.text();
      for (const s of want.contains ?? []) expect(text, `ควรเห็น “${s}”`).toContain(s);
      for (const s of want.absent ?? []) expect(text, `ไม่ควรเห็น “${s}”`).not.toContain(s);
      if (want.inOrder) expectInOrder(text, want.inOrder);
    }).toPass({ timeout, intervals: [1_000, 2_000, 3_000] });
  }
}
