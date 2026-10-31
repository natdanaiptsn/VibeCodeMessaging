import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processWebhookEvent } from "@/services/webhook-event-processor.service";
import { runMaintenance } from "@/services/maintenance.service";

/**
 * Queue บน PostgreSQL (ไม่ต้องใช้ Redis)
 * - Webhook บันทึก Event เป็น PENDING แล้วตอบ 200 ทันที
 * - Worker claim งานด้วย FOR UPDATE SKIP LOCKED (รันหลาย instance ได้อย่างปลอดภัย)
 * - Event ของลูกค้าคนเดียวกันประมวลผลตามลำดับ ส่วนต่างลูกค้าประมวลผลพร้อมกันได้
 */
const BATCH_SIZE = 10;
const STALE_LOCK_MS = 2 * 60 * 1000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;

type QueueState = {
  running: boolean;
  again: boolean;
  timer: NodeJS.Timeout | null;
  lastRecover: number;
  lastMaintenance: number;
};

const g = globalThis as unknown as { __lineQueue?: QueueState };
const state: QueueState = (g.__lineQueue ??= {
  running: false,
  again: false,
  timer: null,
  lastRecover: 0,
  lastMaintenance: 0,
});

export async function claimEvents(limit = BATCH_SIZE): Promise<{ id: string; sourceUserId: string | null }[]> {
  return prisma.$queryRaw<{ id: string; sourceUserId: string | null }[]>`
    UPDATE "WebhookEvent"
       SET "status" = 'PROCESSING', "lockedAt" = now(), "attempts" = "attempts" + 1, "updatedAt" = now()
     WHERE "id" IN (
       SELECT "id" FROM "WebhookEvent"
        WHERE "status" = 'PENDING' AND "availableAt" <= now()
        ORDER BY "eventTimestamp" ASC, "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING "id"::text AS "id", "sourceUserId"`;
}

/** คืนงานที่ค้างสถานะ PROCESSING นานเกินไป (เช่น process ล่มระหว่างทำงาน) */
export async function recoverStaleEvents(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS);
  const res = await prisma.webhookEvent.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: cutoff } },
    data: { status: "PENDING", lockedAt: null },
  });
  if (res.count) logger.warn("Recovered stale webhook events", { count: res.count });
  return res.count;
}

async function processBatch(batch: { id: string; sourceUserId: string | null }[]) {
  const groups = new Map<string, string[]>();
  for (const item of batch) {
    const key = item.sourceUserId ?? item.id;
    groups.set(key, [...(groups.get(key) ?? []), item.id]);
  }
  await Promise.all(
    [...groups.values()].map(async (ids) => {
      for (const id of ids) await processWebhookEvent(id);
    }),
  );
}

export type DrainOptions = {
  /**
   * รอประมวลผล Event ที่ถูกตั้งเวลาลองใหม่ (retry backoff) ภายในช่วงเวลานี้ด้วย
   * ใช้บน Serverless (เช่น Vercel) ที่ไม่มี Background Worker คอยวนตรวจคิว
   */
  waitForRetriesMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function maybeRecoverStale() {
  const now = Date.now();
  if (now - state.lastRecover < 30_000) return;
  state.lastRecover = now;
  await recoverStaleEvents();
}

async function nextRetryDelayMs(): Promise<number | null> {
  const next = await prisma.webhookEvent.findFirst({
    where: { status: "PENDING" },
    orderBy: { availableAt: "asc" },
    select: { availableAt: true },
  });
  return next ? Math.max(0, next.availableAt.getTime() - Date.now()) : null;
}

/**
 * ประมวลผล Event ในคิวจนหมด (ถ้ามีการเรียกซ้อนใน instance เดียวกัน รอบที่ทำงานอยู่จะวนรับงานใหม่ให้)
 * คืนค่า Promise ที่ resolve เมื่อเสร็จ — บน Serverless ต้อง await ภายใน after() เพื่อไม่ให้ถูกหยุดกลางคัน
 */
export async function drainQueue(opts: DrainOptions = {}): Promise<number> {
  if (state.running) {
    state.again = true;
    return 0;
  }
  state.running = true;
  let processed = 0;
  const deadline = Date.now() + (opts.waitForRetriesMs ?? 0);
  try {
    await maybeRecoverStale();
    while (true) {
      do {
        state.again = false;
        while (true) {
          const batch = await claimEvents();
          if (batch.length === 0) break;
          await processBatch(batch);
          processed += batch.length;
        }
      } while (state.again);
      if (!opts.waitForRetriesMs) break;
      const delay = await nextRetryDelayMs();
      if (delay === null || Date.now() + delay > deadline) break;
      await sleep(delay + 100);
    }
  } catch (err) {
    logger.error("Queue drain failed", err);
  } finally {
    state.running = false;
  }
  return processed;
}

/** เริ่มประมวลผลทันที (ไม่ block) — ใช้เมื่อมี process ที่รันค้างไว้ (Node server / Docker) */
export function kickQueue() {
  void drainQueue();
}

/** งานดูแลระบบสำหรับเรียกจาก Cron (กู้งานค้าง → ประมวลผลคิว → ลบข้อมูลตามระยะเวลาเก็บ) */
export async function runScheduledJobs() {
  const recovered = await recoverStaleEvents();
  state.lastRecover = Date.now();
  const processed = await drainQueue();
  const maintenance = await runMaintenance();
  return { recovered, processed, maintenance };
}

async function tick() {
  const now = Date.now();
  try {
    await drainQueue();
    if (now - state.lastMaintenance > MAINTENANCE_INTERVAL_MS) {
      state.lastMaintenance = now;
      await runMaintenance();
    }
  } catch (err) {
    logger.error("Queue tick failed", err);
  }
}

export function startQueueWorker(intervalMs: number) {
  if (state.timer) return;
  logger.info("Starting webhook queue worker", { intervalMs });
  state.lastMaintenance = Date.now() - MAINTENANCE_INTERVAL_MS + 60_000; // รัน maintenance ครั้งแรกหลังเริ่ม 1 นาที
  state.timer = setInterval(() => void tick(), intervalMs);
  state.timer.unref?.();
  void tick();
}

export async function queueStats() {
  const grouped = await prisma.webhookEvent.groupBy({ by: ["status"], _count: { _all: true } });
  const out: Record<string, number> = { PENDING: 0, PROCESSING: 0, PROCESSED: 0, FAILED: 0, SKIPPED: 0 };
  for (const g of grouped) out[g.status] = g._count._all;
  return out;
}
