import "server-only";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type { LineOutgoingMessage } from "@/lib/line/types";

/**
 * LINE Messaging API Client
 * เอกสาร: https://developers.line.biz/en/reference/messaging-api/
 * Token ใช้เฉพาะใน header Authorization และไม่ถูกบันทึกลง log
 */
const apiBase = () => env().LINE_API_BASE_URL.replace(/\/+$/, "");
const dataApiBase = () => env().LINE_DATA_API_BASE_URL.replace(/\/+$/, "");
const TIMEOUT_MS = 10_000;

export class LineApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: { message?: string; property?: string }[] = [],
    public requestId: string | null = null,
    public code: "INVALID_REPLY_TOKEN" | "UNAUTHORIZED" | "RATE_LIMITED" | "NETWORK" | "API" = "API",
  ) {
    super(message);
    this.name = "LineApiError";
  }

  /** สรุปข้อผิดพลาดสำหรับบันทึก (ไม่มีข้อมูลอ่อนไหว) */
  toLog() {
    return { status: this.status, message: this.message, details: this.details, requestId: this.requestId };
  }
}

export type LineResponse<T> = { status: number; data: T; requestId: string | null; acceptedRequestId: string | null };

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  retryKey?: string;
  base?: string;
  retries?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lineFetch<T>(token: string, path: string, opts: FetchOptions = {}): Promise<LineResponse<T>> {
  if (!token) throw new LineApiError(401, "ยังไม่ได้ตั้งค่า Channel Access Token", [], null, "UNAUTHORIZED");
  const retries = opts.retries ?? 0;
  let attempt = 0;
  while (true) {
    attempt += 1;
    let res: Response;
    try {
      res = await fetch(`${opts.base ?? apiBase()}${path}`, {
        method: opts.method ?? "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(opts.retryKey ? { "X-Line-Retry-Key": opts.retryKey } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (e) {
      if (attempt <= retries) {
        await sleep(500 * attempt);
        continue;
      }
      const cause = (e as { cause?: { code?: string; message?: string } }).cause;
      const detail = cause?.code ?? cause?.message;
      throw new LineApiError(0, `ไม่สามารถเชื่อมต่อ LINE API ได้: ${(e as Error).message}${detail ? ` (${detail})` : ""}`, [], null, "NETWORK");
    }
    const requestId = res.headers.get("x-line-request-id");
    const acceptedRequestId = res.headers.get("x-line-accepted-request-id");
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 500) };
      }
    }
    // 409 + Retry Key = คำขอนี้เคยส่งสำเร็จแล้ว (ป้องกันส่งซ้ำ)
    if (res.status === 409 && opts.retryKey && acceptedRequestId) {
      return { status: 409, data: data as T, requestId, acceptedRequestId };
    }
    if (res.ok) return { status: res.status, data: data as T, requestId, acceptedRequestId };

    const body = (data ?? {}) as { message?: string; details?: { message?: string; property?: string }[] };
    const message = body.message || `LINE API ตอบกลับสถานะ ${res.status}`;
    if ((res.status >= 500 || res.status === 429) && attempt <= retries) {
      await sleep(res.status === 429 ? 1500 * attempt : 500 * attempt);
      continue;
    }
    let code: LineApiError["code"] = "API";
    if (res.status === 401) code = "UNAUTHORIZED";
    else if (res.status === 429) code = "RATE_LIMITED";
    else if (res.status === 400 && /invalid reply token/i.test(message)) code = "INVALID_REPLY_TOKEN";
    const err = new LineApiError(res.status, message, body.details ?? [], requestId, code);
    logger.warn("LINE API error", { path, ...err.toLog() });
    throw err;
  }
}

export type BotInfo = {
  userId: string;
  basicId: string;
  premiumId?: string;
  displayName: string;
  pictureUrl?: string;
  chatMode: "chat" | "bot";
  markAsReadMode: "auto" | "manual";
};

export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  language?: string;
};

export type SentMessages = { sentMessages?: { id: string; quoteToken?: string }[] };

export const lineApi = {
  getBotInfo: (token: string) => lineFetch<BotInfo>(token, "/v2/bot/info"),

  getProfile: (token: string, userId: string) =>
    lineFetch<LineProfile>(token, `/v2/bot/profile/${encodeURIComponent(userId)}`),

  reply: (token: string, replyToken: string, messages: LineOutgoingMessage[]) =>
    lineFetch<SentMessages>(token, "/v2/bot/message/reply", {
      method: "POST",
      body: { replyToken, messages },
      retries: 1,
    }),

  push: (token: string, to: string, messages: LineOutgoingMessage[], retryKey: string) =>
    lineFetch<SentMessages>(token, "/v2/bot/message/push", {
      method: "POST",
      body: { to, messages },
      retryKey,
      retries: 2,
    }),

  /** ตรวจสอบรูปแบบ Message Object กับ LINE โดยไม่ส่งข้อความจริง */
  validateReply: (token: string, messages: LineOutgoingMessage[]) =>
    lineFetch<Record<string, never>>(token, "/v2/bot/message/validate/reply", { method: "POST", body: { messages } }),

  getWebhookEndpoint: (token: string) =>
    lineFetch<{ endpoint: string; active: boolean }>(token, "/v2/bot/channel/webhook/endpoint"),

  setWebhookEndpoint: (token: string, endpoint: string) =>
    lineFetch<Record<string, never>>(token, "/v2/bot/channel/webhook/endpoint", { method: "PUT", body: { endpoint } }),

  testWebhookEndpoint: (token: string, endpoint?: string) =>
    lineFetch<{ success: boolean; timestamp: string; statusCode: number; reason: string; detail: string }>(
      token,
      "/v2/bot/channel/webhook/test",
      { method: "POST", body: endpoint ? { endpoint } : {} },
    ),

  getQuota: (token: string) => lineFetch<{ type: "none" | "limited"; value?: number }>(token, "/v2/bot/message/quota"),

  getQuotaConsumption: (token: string) =>
    lineFetch<{ totalUsage: number }>(token, "/v2/bot/message/quota/consumption"),

  /** ดาวน์โหลดเนื้อหาไฟล์ (รูปภาพ/วิดีโอ/ไฟล์) ที่ลูกค้าส่งมา */
  async getContent(token: string, messageId: string): Promise<Response> {
    let res: Response;
    try {
      res = await fetch(`${dataApiBase()}/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch (e) {
      throw new LineApiError(0, `ไม่สามารถเชื่อมต่อ LINE API ได้: ${(e as Error).message}`, [], null, "NETWORK");
    }
    if (!res.ok) {
      throw new LineApiError(res.status, `ไม่สามารถดึงไฟล์จาก LINE ได้ (สถานะ ${res.status})`, [], res.headers.get("x-line-request-id"));
    }
    return res;
  },
};

export function describeLineError(err: unknown): string {
  if (err instanceof LineApiError) {
    const details = err.details
      .map((d) => [d.property, d.message].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("; ");
    return details ? `${err.message} (${details})` : err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
