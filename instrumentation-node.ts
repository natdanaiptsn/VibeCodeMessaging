import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isServerless } from "@/lib/runtime";
import { startQueueWorker } from "@/services/queue.service";

try {
  const e = env();
  if (isServerless()) {
    // บน Vercel: ประมวลผลทันทีผ่าน after() ใน Webhook และงานดูแลระบบผ่าน /api/cron/maintenance
    logger.info("Serverless runtime detected — background queue worker disabled");
  } else if (e.QUEUE_WORKER_ENABLED) {
    startQueueWorker(e.QUEUE_POLL_INTERVAL_MS);
  }
} catch (err) {
  logger.error("Queue worker was not started", err);
}
