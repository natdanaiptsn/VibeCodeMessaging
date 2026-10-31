import { publicRoute } from "@/lib/api/handler";
import { destroyCurrentSession, getSession } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

export const POST = publicRoute({}, async ({ ip, userAgent }) => {
  const session = await getSession();
  await destroyCurrentSession();
  if (session) {
    await writeAudit({ userId: session.user.id, action: "auth.logout", entityType: "User", entityId: session.user.id, ip, userAgent });
  }
  return { ok: true };
});
