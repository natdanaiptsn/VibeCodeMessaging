import { route } from "@/lib/api/handler";
import { idParamsSchema } from "@/lib/validation/common";
import { badRequest } from "@/lib/errors";
import { getSettings } from "@/services/settings.service";
import { getLineCredentials } from "@/services/line-account.service";
import { retryReplyLog } from "@/services/reply.service";
import { auditFromCtx } from "@/lib/audit";

export const POST = route<{ id: string }>({ permission: "logs:retry", rateLimitPerMinute: 20 }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const [settings, creds] = await Promise.all([getSettings(), getLineCredentials()]);
  if (!creds.channelAccessToken) throw badRequest("ยังไม่ได้ตั้งค่า Channel Access Token");
  const log = await retryReplyLog(id, { userId: ctx.session.user.id, token: creds.channelAccessToken, settings });
  await auditFromCtx(ctx)({ action: "reply_log.retry", entityType: "ReplyLog", entityId: id, summary: `ส่งซ้ำ — ${log.status}`, metadata: { newLogId: log.id } });
  return log;
});
