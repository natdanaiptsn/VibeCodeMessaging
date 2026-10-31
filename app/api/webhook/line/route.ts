import { NextResponse, after, type NextRequest } from "next/server";
import { ingestWebhook } from "@/services/line-webhook.service";
import { kickQueue } from "@/services/queue.service";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { logger } from "@/lib/logger";
import { LINE_LIMITS } from "@/lib/line/limits";

/**
 * LINE Webhook Endpoint: POST /api/webhook/line
 * - ตรวจสอบ X-Line-Signature ด้วย raw body
 * - บันทึก Event ลงคิวแล้วตอบ 200 ทันที จากนั้นประมวลผลใน background
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? "unknown";
  const rl = rateLimit(`webhook:${ip}`, 2000, 60_000);
  if (!rl.allowed) return NextResponse.json({ message: "Too many requests" }, { status: 429 });

  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > LINE_LIMITS.WEBHOOK_BODY_MAX_BYTES) {
    return NextResponse.json({ message: "Payload too large" }, { status: 413 });
  }

  try {
    const rawBody = await req.text();
    const result = await ingestWebhook(rawBody, req.headers.get("x-line-signature"));
    if (!result.ok) {
      if (result.status === 401) {
        const bad = rateLimit(`webhook-bad-sig:${ip}`, 30, 60_000);
        if (!bad.allowed) return NextResponse.json({ message: "Too many requests" }, { status: 429 });
      }
      return NextResponse.json({ message: result.message }, { status: result.status });
    }
    if (result.inserted > 0) after(() => kickQueue());
    return NextResponse.json({ ok: true, received: result.received, accepted: result.inserted });
  } catch (err) {
    logger.error("Webhook ingest failed", err);
    // ตอบ 500 เพื่อให้ LINE ส่งซ้ำ (เมื่อเปิด Webhook redelivery)
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
