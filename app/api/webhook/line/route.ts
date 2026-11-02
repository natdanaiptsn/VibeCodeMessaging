import type { NextRequest } from "next/server";
import { handleLineWebhook } from "@/lib/line/webhook-handler";

/**
 * LINE Webhook URL เดิม: POST /api/webhook/line
 * ใช้ได้กับโปรเจกต์หลัก (และโปรเจกต์ที่ LINE OA ตรงกับ destination) — โปรเจกต์ใหม่ใช้ /api/webhook/line/{projectId}
 */
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleLineWebhook(req, null);
}
