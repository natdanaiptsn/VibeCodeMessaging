import { NextResponse } from "next/server";
import { publicRoute, readJson } from "@/lib/api/handler";
import { loginSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { ApiError, tooManyRequests, unauthorized } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export const POST = publicRoute({ rateLimitPerMinute: 30 }, async ({ req, ip, userAgent }) => {
  const ipLimit = rateLimit(`login:ip:${ip ?? "unknown"}`, 20, 15 * 60_000);
  if (!ipLimit.allowed) throw tooManyRequests("พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่", ipLimit.retryAfterSec);

  const { email, password } = loginSchema.parse(await readJson(req, 4096));
  const emailLimit = rateLimit(`login:email:${email}`, 10, 15 * 60_000);
  if (!emailLimit.allowed) throw tooManyRequests("พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่", emailLimit.retryAfterSec);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await verifyPassword(password, null);
    throw new ApiError(
      423,
      `บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่หลังเวลา ${user.lockedUntil.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })}`, "LOCKED");
  }
  const valid = await verifyPassword(password, user?.isActive ? user.passwordHash : null);
  if (!user || !valid) {
    if (user) {
      const failed = user.failedLoginCount + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await writeAudit({ userId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id, ip, userAgent });
    }
    throw unauthorized("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, { ip, userAgent });
  resetRateLimit(`login:email:${email}`);
  await writeAudit({ userId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip, userAgent });
  return NextResponse.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
