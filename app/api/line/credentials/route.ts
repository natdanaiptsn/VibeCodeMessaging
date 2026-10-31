import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { lineCredentialsSchema } from "@/lib/validation/line";
import { clearLineCredentials, getLineAccountPublic, saveLineCredentials } from "@/services/line-account.service";
import { auditFromCtx } from "@/lib/audit";

/** บันทึก LINE Credentials (เข้ารหัส AES-256-GCM ก่อนเก็บ — ไม่ส่งค่ากลับไปยัง Frontend) */
export const PUT = route({ permission: "line:manage", rateLimitPerMinute: 20 }, async (ctx) => {
  const input = lineCredentialsSchema.parse(await readJson(ctx.req, 8192));
  await saveLineCredentials({
    name: input.name,
    channelId: input.channelId,
    channelSecret: input.channelSecret || undefined,
    channelAccessToken: input.channelAccessToken || undefined,
  });
  await auditFromCtx(ctx)({
    action: "line.credentials_update",
    entityType: "LineAccount",
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
  return getLineAccountPublic();
});

const deleteSchema = z.object({ which: z.enum(["secret", "token", "all"]).default("all") });

export const DELETE = route({ permission: "line:manage" }, async (ctx) => {
  const { which } = deleteSchema.parse({ which: ctx.req.nextUrl.searchParams.get("which") ?? undefined });
  await clearLineCredentials(which);
  await auditFromCtx(ctx)({ action: "line.credentials_clear", entityType: "LineAccount", summary: `ลบ LINE Credentials (${which})` });
  return getLineAccountPublic();
});
