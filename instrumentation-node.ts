import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { startQueueWorker } from "@/services/queue.service";

try {
  const e = env();
  if (e.QUEUE_WORKER_ENABLED) startQueueWorker(e.QUEUE_POLL_INTERVAL_MS);
} catch (err) {
  logger.error("Queue worker was not started", err);
}
