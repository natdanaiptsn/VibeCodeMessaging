import "server-only";

/**
 * Rate limiter แบบ fixed-window ในหน่วยความจำ
 * เหมาะกับการ deploy แบบ instance เดียว (ถ้าหลาย instance ให้ใช้ reverse proxy rate limit ร่วมด้วย)
 */
type Bucket = { count: number; resetAt: number };

const globalStore = globalThis as unknown as { __rateLimitStore?: Map<string, Bucket>; __rateLimitSweep?: number };
const store = (globalStore.__rateLimitStore ??= new Map<string, Bucket>());

function sweep(now: number) {
  if ((globalStore.__rateLimitSweep ?? 0) > now) return;
  globalStore.__rateLimitSweep = now + 60_000;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  let bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }
  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}
