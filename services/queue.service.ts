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

export async function drainQueue(): Promise<number> {
  if (state.running) {
    state.again = true;
    return 0;
  }
  state.running = true;
  let processed = 0;
  try {
    do {
      state.again = false;
      while (true) {
        const batch = await claimEvents();
        if (batch.length === 0) break;
        await processBatch(batch);
        processed += batch.length;
      }
    } while (state.again);
  } catch (err) {
    logger.error("Queue drain failed", err);
  } finally {
    state.running = false;
  }
  return processed;
}

/** เริ่มประมวลผลทันที (ไม่ block) */
export function kickQueue() {
  void drainQueue();
}

async function tick() {
  const now = Date.now();
  try {
    if (now - state.lastRecover > 30_000) {
      state.lastRecover = now;
      await recoverStaleEvents();
    }
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
