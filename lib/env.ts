import "server-only";
import { z } from "zod";

/**
 * ตรวจสอบ Environment Variables ฝั่ง Server
 * ใช้ lazy validation เพื่อไม่ให้ `next build` ล้มเหลวเมื่อยังไม่ได้ตั้งค่า
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "ต้องกำหนด DATABASE_URL"),
  ENCRYPTION_KEY: z
    .string()
    .min(1, "ต้องกำหนด ENCRYPTION_KEY (สร้างด้วย: openssl rand -base64 32)"),
  APP_URL: z.url().optional(),
  LINE_CHANNEL_SECRET: z.string().optional(),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional(),
  LINE_CHANNEL_ID: z.string().optional(),
  // สำหรับทดสอบกับ Mock Server / Staging เท่านั้น (ค่าเริ่มต้นคือ LINE API จริง)
  LINE_API_BASE_URL: z.url().default("https://api.line.me"),
  LINE_DATA_API_BASE_URL: z.url().default("https://api-data.line.me"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),
  QUEUE_WORKER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // รหัสสำหรับเรียก /api/cron/maintenance (Vercel Cron ส่งเป็น Authorization: Bearer <CRON_SECRET>)
  CRON_SECRET: z.string().min(16, "CRON_SECRET ต้องยาวอย่างน้อย 16 ตัวอักษร").optional(),
  QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().min(500).max(60000).default(3000),
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  COOKIE_SECURE: z.enum(["true", "false", "auto"]).default("auto"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Environment variables ไม่ถูกต้อง:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** URL สาธารณะของระบบ (ใช้สร้าง Webhook URL และ URL รูปภาพ) */
export function appUrl(): string | null {
  const url = env().APP_URL;
  if (url) return url.replace(/\/+$/, "");
  // Vercel: ใช้โดเมน Production ของโปรเจกต์อัตโนมัติ หากไม่ได้กำหนด APP_URL
  const vercelDomain = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercelDomain ? `https://${vercelDomain.replace(/\/+$/, "")}` : null;
}
