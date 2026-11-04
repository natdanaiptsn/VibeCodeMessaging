import { z } from "zod";
import { route } from "@/lib/api/handler";
import { auditFromCtx } from "@/lib/audit";
import { unlinkIdentity } from "@/services/sso.service";
import { PROVIDER_LABELS } from "@/lib/auth/oauth/providers";

const paramsSchema = z.object({ provider: z.enum(["google", "line"]) });

/** ยกเลิกการผูกบัญชี Google / LINE */
export const DELETE = route<{ provider: string }>({ rateLimitPerMinute: 10 }, async (ctx) => {
  const { provider } = paramsSchema.parse(ctx.params);
  await unlinkIdentity(ctx.session.user.id, provider === "google" ? "GOOGLE" : "LINE");
  await auditFromCtx(ctx)({
    action: "auth.unlink_identity",
    entityType: "User",
    entityId: ctx.session.user.id,
    summary: `ยกเลิกการผูกบัญชี ${PROVIDER_LABELS[provider]}`,
  });
  return { ok: true };
});
