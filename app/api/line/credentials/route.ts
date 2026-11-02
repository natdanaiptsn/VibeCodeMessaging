import { z } from "zod";
import { projectRoute, readJson } from "@/lib/api/handler";
import { lineCredentialsSchema } from "@/lib/validation/line";
import { clearLineCredentials, getLineAccountPublic, saveLineCredentials } from "@/services/line-account.service";
import { auditFromCtx } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** บันทึก LINE Credentials (เข้ารหัส AES-256-GCM ก่อนเก็บ — ไม่ส่งค่ากลับไปยัง Frontend) */
export const PUT = projectRoute({ permission: "line:manage", rateLimitPerMinute: 20 }, async (ctx) => {
  const input = lineCredentialsSchema.parse(await readJson(ctx.req, 8192));
  if (input.name) await prisma.project.update({ where: { id: ctx.project.id }, data: { name: input.name } });
  await saveLineCredentials(ctx.project.id, {
    channelId: input.channelId,
    channelSecret: input.channelSecret || undefined,
    channelAccessToken: input.channelAccessToken || undefined,
  });
  await auditFromCtx(ctx)({
    action: "line.credentials_update",
    entityType: "Project",
    summary: "อัปเดต LINE Credentials",
    metadata: {
      changed: {
        name: Boolean(input.name),
        channelId: input.channelId !== undefined,
        channelSecret: Boolean(input.channelSecret),
        channelAccessToken: Boolean(input.channelAccessToken),
      },
    },
  });
  return getLineAccountPublic(ctx.project.id);
});

const deleteSchema = z.object({ which: z.enum(["secret", "token", "all"]).default("all") });

export const DELETE = projectRoute({ permission: "line:manage" }, async (ctx) => {
  const { which } = deleteSchema.parse({ which: ctx.req.nextUrl.searchParams.get("which") ?? undefined });
  await clearLineCredentials(ctx.project.id, which);
  await auditFromCtx(ctx)({ action: "line.credentials_clear", entityType: "Project", summary: `ลบ LINE Credentials (${which})` });
  return getLineAccountPublic(ctx.project.id);
});
