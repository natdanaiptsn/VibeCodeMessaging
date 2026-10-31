import { route, readJson } from "@/lib/api/handler";
import { changePasswordSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { badRequest } from "@/lib/errors";
import { auditFromCtx } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/errors";

export const POST = route({ rateLimitPerMinute: 10 }, async (ctx) => {
  const rl = rateLimit(`chpw:${ctx.session.user.id}`, 5, 15 * 60_000);
  if (!rl.allowed) throw tooManyRequests(undefined, rl.retryAfterSec);
  if (ctx.session.user.passwordManagedByEnv) {
    throw badRequest("รหัสผ่านของบัญชีนี้ตั้งจาก ADMIN_PASSWORD ใน Environment Variables — แก้ไขที่ Vercel แล้ว Redeploy");
  }
  const input = changePasswordSchema.parse(await readJson(ctx.req, 4096));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: ctx.session.user.id } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw badRequest("รหัสผ่านปัจจุบันไม่ถูกต้อง", [{ path: "currentPassword", message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" }]);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword), passwordChangedAt: new Date() },
  });
  // ออกจากระบบทุกอุปกรณ์ ยกเว้นอุปกรณ์ปัจจุบัน
  await revokeUserSessions(user.id, ctx.session.sessionId);
  await auditFromCtx(ctx)({ action: "auth.change_password", entityType: "User", entityId: user.id, summary: "เปลี่ยนรหัสผ่าน" });
  return { ok: true };
});
