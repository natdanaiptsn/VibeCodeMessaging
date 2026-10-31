import { route } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { ApiError, badRequest } from "@/lib/errors";
import { sha256Hex } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { auditFromCtx } from "@/lib/audit";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — ต่ำกว่าขีดจำกัด request body 4.5 MB ของ Vercel Functions
const ALLOWED: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", magic: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
};

function mediaUrl(id: string) {
  return `${appUrl() ?? ""}/api/media/${id}`;
}

export const GET = route({ permission: "templates:view" }, async () => {
  const items = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  return items.map((m) => ({ ...m, url: mediaUrl(m.id) }));
});

/** อัปโหลดรูปภาพสำหรับ Flex Message (JPEG/PNG ไม่เกิน 4 MB, ตรวจสอบ magic bytes) */
export const POST = route({ permission: "media:upload", allowMultipart: true, rateLimitPerMinute: 20 }, async (ctx) => {
  const length = Number(ctx.req.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES + 256 * 1024) throw new ApiError(413, "ไฟล์มีขนาดใหญ่เกิน 4 MB", "PAYLOAD_TOO_LARGE");
  const form = await ctx.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("กรุณาเลือกไฟล์");
  if (file.size > MAX_BYTES) throw new ApiError(413, "ไฟล์มีขนาดใหญ่เกิน 4 MB", "PAYLOAD_TOO_LARGE");
  const type = ALLOWED[file.type];
  if (!type) throw new ApiError(415, "รองรับเฉพาะไฟล์ JPEG และ PNG", "UNSUPPORTED_MEDIA_TYPE");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!type.magic(buffer)) throw new ApiError(415, "เนื้อหาไฟล์ไม่ตรงกับประเภทไฟล์", "UNSUPPORTED_MEDIA_TYPE");
  const sha256 = sha256Hex(buffer);
  const safeName = (file.name || `image.${type.ext}`).replace(/[^\w.\-ก-๙]/g, "_").slice(0, 120);
  const existing = await prisma.mediaAsset.findUnique({ where: { sha256 }, select: { id: true } });
  const asset =
    existing ??
    (await prisma.mediaAsset.create({
      data: { fileName: safeName, mimeType: file.type, sizeBytes: buffer.length, sha256, data: buffer, uploadedById: ctx.session.user.id },
      select: { id: true },
    }));
  if (!existing) await auditFromCtx(ctx)({ action: "media.upload", entityType: "MediaAsset", entityId: asset.id, summary: safeName });
  return { id: asset.id, url: mediaUrl(asset.id), warning: appUrl()?.startsWith("https://") ? null : "APP_URL ไม่ใช่ HTTPS — LINE จะไม่สามารถแสดงรูปนี้ได้" };
});
