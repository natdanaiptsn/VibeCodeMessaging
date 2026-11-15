import { expect, type APIRequestContext } from "@playwright/test";
import { BASE_ORIGIN, uniqueName } from "./env";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiResult<T = unknown> = { status: number; data: T; message: string | null };

/**
 * เรียก API ของระบบด้วย cookie ของบัญชีที่ล็อกอินอยู่ (ใช้เตรียมข้อมูลให้เทสต์ — เร็วและแน่นอนกว่ากดหน้าเว็บ)
 * - ใส่ Origin ให้ทุกคำขอ เพราะระบบกัน CSRF
 * - ใส่ x-project-id เมื่อเรียก API ของโปรเจกต์
 */
export class Api {
  constructor(
    readonly request: APIRequestContext,
    readonly projectId?: string,
  ) {}

  forProject(projectId: string) {
    return new Api(this.request, projectId);
  }

  async call<T = unknown>(method: Method, path: string, body?: unknown): Promise<ApiResult<T>> {
    // ระบบจำกัดจำนวนคำขอ (เช่น สร้างโปรเจกต์ได้ 20 ครั้ง/นาที) — ถ้าโดนจำกัด ให้รอตามที่ระบบบอกแล้วลองใหม่
    for (let attempt = 0; ; attempt++) {
      const res = await this.request.fetch(path, {
        method,
        headers: { Origin: BASE_ORIGIN, ...(this.projectId ? { "x-project-id": this.projectId } : {}) },
        data: body === undefined ? undefined : body,
        failOnStatusCode: false,
      });
      const json = (await res.json().catch(() => null)) as {
        data?: T;
        error?: { message?: string; details?: { retryAfter?: number } };
      } | null;
      if (res.status() === 429 && attempt < 6) {
        const waitSec = Math.min(Math.max(json?.error?.details?.retryAfter ?? 10, 1), 60);
        await new Promise((r) => setTimeout(r, waitSec * 1000 + 250));
        continue;
      }
      return { status: res.status(), data: json?.data as T, message: json?.error?.message ?? null };
    }
  }

  /** เรียกแล้วต้องสำเร็จ (2xx) — ไม่สำเร็จจะหยุดเทสต์พร้อมข้อความจากระบบ */
  async ok<T = unknown>(method: Method, path: string, body?: unknown): Promise<T> {
    const r = await this.call<T>(method, path, body);
    expect(r.status, `${method} ${path} → ${r.status} ${r.message ?? ""}`).toBeLessThan(300);
    return r.data;
  }

  get<T = unknown>(path: string) {
    return this.ok<T>("GET", path);
  }

  me() {
    return this.get<{ id: string; name: string; username: string | null; email: string | null; role: string }>("/api/auth/me");
  }

  // ─── ตัวช่วยสร้างข้อมูลในโปรเจกต์ ───

  async createRule(rule: Partial<RuleBody> & { messages?: RuleBody["messages"] }) {
    const body = ruleBody(rule);
    const created = await this.ok<{ id: string; name: string }>("POST", "/api/rules", body);
    return { ...created, body };
  }

  updateRule(id: string, body: RuleBody) {
    return this.ok("PUT", `/api/rules/${id}`, body);
  }

  createTextTemplate(content: string, name = uniqueName("ข้อความ")) {
    return this.ok<{ id: string; name: string }>("POST", "/api/text-templates", { name, content });
  }

  createFlexTemplate(contents: unknown, name = uniqueName("Flex")) {
    return this.ok<{ id: string; name: string }>("POST", "/api/flex-templates", { name, altText: "ข้อความจาก E2E", contents });
  }

  /** เปลี่ยนการตั้งค่าของโปรเจกต์ (ส่งเฉพาะส่วนที่ต้องการเปลี่ยน) */
  async updateSettings(patch: { general?: Record<string, unknown>; defaultReply?: Record<string, unknown> }) {
    const current = await this.get<{ general: Record<string, unknown>; defaultReply: Record<string, unknown> }>("/api/settings");
    return this.ok("PUT", "/api/settings", {
      ...(patch.general ? { general: { ...current.general, ...patch.general } } : {}),
      ...(patch.defaultReply ? { defaultReply: { ...current.defaultReply, ...patch.defaultReply } } : {}),
    });
  }
}

export type RuleBody = {
  name: string;
  isActive: boolean;
  priority: number;
  triggerType: "TEXT" | "POSTBACK" | "FOLLOW" | "IMAGE" | "STICKER" | "LOCATION";
  matchType: "EXACT" | "CONTAINS" | "STARTS_WITH" | "ENDS_WITH" | "REGEX";
  keywords: string[];
  messages: ({ type: "TEXT"; text?: string; textTemplateId?: string } | { type: "FLEX"; flexTemplateId: string })[];
};

export function ruleBody(rule: Partial<RuleBody>): RuleBody {
  return {
    name: uniqueName("กฎ"),
    isActive: true,
    priority: 0,
    triggerType: "TEXT",
    matchType: "CONTAINS",
    keywords: [],
    messages: [{ type: "TEXT", text: "ตอบกลับจาก E2E" }],
    ...rule,
  };
}

/** Flex แบบง่ายที่สุด (ใช้ทดสอบกฎหลายข้อความ) */
export function simpleBubble(text: string) {
  return { type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "text", text }] } };
}

/** Flex ที่มีปุ่ม Postback (เหมือนแบบ “โปรโมชัน”) */
export function postbackBubble(label: string, data: string) {
  return {
    type: "bubble",
    body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "โปรโมชันพิเศษ" }] },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [{ type: "button", style: "primary", action: { type: "postback", label, data, displayText: label } }],
    },
  };
}
