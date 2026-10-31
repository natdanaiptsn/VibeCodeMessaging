import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { idParamsSchema } from "@/lib/validation/common";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import { getLineCredentials } from "@/services/line-account.service";
import { lineApi } from "@/services/line-messaging.service";

const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const MAX_BYTES = 25 * 1024 * 1024;

/** ดึงไฟล์ที่ลูกค้าส่งมา (รูปภาพ/วิดีโอ/เสียง/ไฟล์) ผ่าน LINE Content API — ต้องเข้าสู่ระบบ */
export const GET = route<{ id: string }>({ permission: "inbox:view", rateLimitPerMinute: 120 }, async ({ params }) => {
  const { id } = idParamsSchema.parse(params);
  const message = await prisma.message.findUnique({ where: { id } });
  if (!message || message.direction !== "INBOUND" || !message.lineMessageId) throw notFound("ไม่พบไฟล์");
  if (!["IMAGE", "VIDEO", "AUDIO", "FILE"].includes(message.type)) throw badRequest("ข้อความนี้ไม่มีไฟล์แนบ");
  const provider = (message.payload as { contentProvider?: { type?: string; originalContentUrl?: string } } | null)?.contentProvider;
  if (provider?.type === "external") throw badRequest("ไฟล์นี้อยู่บนเซิร์ฟเวอร์ภายนอก");

  const creds = await getLineCredentials();
  if (!creds.channelAccessToken) throw badRequest("ยังไม่ได้ตั้งค่า Channel Access Token");
  const res = await lineApi.getContent(creds.channelAccessToken, message.lineMessageId);
  const length = Number(res.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) throw new ApiError(413, "ไฟล์มีขนาดใหญ่เกิน 25 MB", "PAYLOAD_TOO_LARGE");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES) throw new ApiError(413, "ไฟล์มีขนาดใหญ่เกิน 25 MB", "PAYLOAD_TOO_LARGE");

  const contentType = (res.headers.get("content-type") ?? "application/octet-stream").split(";")[0]!.trim().toLowerCase();
  const inline = message.type === "IMAGE" && INLINE_TYPES.has(contentType);
  const fileName = (message.payload as { fileName?: string } | null)?.fileName?.replace(/[^\w.\-ก-๙ ]/g, "_") || `line-${message.lineMessageId}`;
  return new Response(buffer, {
    headers: {
      "Content-Type": inline ? contentType : "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": inline ? "inline" : `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
