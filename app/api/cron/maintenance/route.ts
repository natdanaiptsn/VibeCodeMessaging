import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { runScheduledJobs } from "@/services/queue.service";

/**
 * งานดูแลระบบตามรอบเวลา: กู้ Event ค้าง → ประมวลผลคิว (รวม retry) → ลบข้อมูลตามระยะเวลาเก็บ
 * - Vercel Cron เรียกตาม vercel.json พร้อม header Authorization: Bearer <CRON_SECRET>
 * - บริการ Cron ภายนอก (เช่น cron-job.org) เรียกถี่กว่านี้ได้ด้วย header เดียวกัน
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ message: "CRON_SECRET is not configured" }, { status: 503 });
  }
  const rl = rateLimit(`cron:${getClientIp(req) ?? "anon"}`, 30, 60_000);
  if (!rl.allowed) return NextResponse.json({ message: "Too many requests" }, { status: 429 });

  const auth = req.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    logger.warn("Rejected cron request with invalid secret");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledJobs();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("Scheduled jobs failed", err);
    return NextResponse.json({ ok: false, message: "Scheduled jobs failed" }, { status: 500 });
  }
}
