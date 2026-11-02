import { NextResponse, type NextRequest } from "next/server";
import { uuidSchema } from "@/lib/validation/common";
import { handleLineWebhook } from "@/lib/line/webhook-handler";

/** LINE Webhook ของแต่ละโปรเจกต์: POST /api/webhook/line/{projectId} */
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  const parsed = uuidSchema.safeParse((await ctx.params).projectId);
  if (!parsed.success) return NextResponse.json({ message: "Project not found" }, { status: 404 });
  return handleLineWebhook(req, parsed.data);
}
