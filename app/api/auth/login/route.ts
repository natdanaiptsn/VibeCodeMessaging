import { NextResponse } from "next/server";
import { publicRoute, readJson } from "@/lib/api/handler";
import { loginSchema } from "@/lib/validation/auth";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import {
  ENV_ADMIN_MIN_PASSWORD,
  envAdminConfig,
  envPasswordMatches,
  findEnvAdminUser,
  syncEnvAdmin,
} from "@/lib/auth/env-admin";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { ApiError, tooManyRequests, unauthorized } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import type { User } from "@/lib/generated/prisma/client";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const INVALID = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";

async function recordFailure(user: User, ip: string | null, userAgent: string | null) {
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

function assertNotLocked(user: User | null) {
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new ApiError(
      423,
      `บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่หลังเวลา ${user.lockedUntil.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })}`,
      "LOCKED",
    );
  }
}

/** เข้าสู่ระบบด้วยชื่อผู้ใช้ (หรืออีเมล) + รหัสผ่าน */
export const POST = publicRoute({ rateLimitPerMinute: 30 }, async ({ req, ip, userAgent }) => {
  const ipLimit = rateLimit(`login:ip:${ip ?? "unknown"}`, 20, 15 * 60_000);
  if (!ipLimit.allowed) throw tooManyRequests("พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่", ipLimit.retryAfterSec);

  const { username: identifier, password } = loginSchema.parse(await readJson(req, 4096));
  const idLimit = rateLimit(`login:id:${identifier}`, 10, 15 * 60_000);
  if (!idLimit.allowed) throw tooManyRequests("พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่", idLimit.retryAfterSec);

  let user: User | null;
  const envAdmin = envAdminConfig();

  if (envAdmin && identifier === envAdmin.identifier) {
    // ผู้ดูแลหลัก: ตรวจกับ ADMIN_PASSWORD ใน Environment
    if (envAdmin.password.length < ENV_ADMIN_MIN_PASSWORD) {
      logger.error(`ADMIN_PASSWORD สั้นกว่า ${ENV_ADMIN_MIN_PASSWORD} ตัวอักษร — ปฏิเสธการเข้าสู่ระบบ`);
      throw new ApiError(
        400,
        `ADMIN_PASSWORD ต้องยาวอย่างน้อย ${ENV_ADMIN_MIN_PASSWORD} ตัวอักษร กรุณาแก้ไขใน Environment Variables แล้ว deploy ใหม่`,
        "WEAK_ENV_PASSWORD",
      );
    }
    const existing = await findEnvAdminUser(envAdmin);
    assertNotLocked(existing);
    if (!envPasswordMatches(envAdmin, password)) {
      if (existing) await recordFailure(existing, ip, userAgent);
      throw unauthorized(INVALID);
    }
    user = await syncEnvAdmin(envAdmin, existing);
  } else {
    user = await prisma.user.findUnique({
      where: identifier.includes("@") ? { email: identifier } : { username: identifier },
    });
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await verifyPassword(password, null);
      assertNotLocked(user);
    }
    const valid = await verifyPassword(password, user?.isActive ? user.passwordHash : null);
    if (!user || !valid) {
      if (user) await recordFailure(user, ip, userAgent);
      throw unauthorized(INVALID);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await createSession(user.id, { ip, userAgent });
  resetRateLimit(`login:id:${identifier}`);
  await writeAudit({ userId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip, userAgent });
  return NextResponse.json({ data: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role } });
});
