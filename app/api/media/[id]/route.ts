import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validation/common";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

/** เสิร์ฟรูปภาพสาธารณะ (LINE ต้องดึงรูปผ่าน HTTPS ได้โดยไม่ต้องเข้าสู่ระบบ) */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const parsed = uuidSchema.safeParse((await ctx.params).id);
  if (!parsed.success) return NextResponse.json({ message: "Not found" }, { status: 404 });
  const rl = rateLimit(`media:${getClientIp(req) ?? "anon"}`, 600, 60_000);
  if (!rl.allowed) return NextResponse.json({ message: "Too many requests" }, { status: 429 });
  const asset = await prisma.mediaAsset.findUnique({ where: { id: parsed.data } });
  if (!asset) return NextResponse.json({ message: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(asset.sizeBytes),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      ETag: `"${asset.sha256}"`,
    },
  });
}
