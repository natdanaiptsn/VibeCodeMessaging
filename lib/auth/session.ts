import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { randomToken, sha256Hex } from "@/lib/crypto";
import type { Role } from "@/lib/auth/permissions";
import { envAdminSessionStillValid, isEnvAdminUser } from "@/lib/auth/env-admin";

export const SESSION_COOKIE = "lineoa_session";
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type SessionUser = {
  id: string;
  username: string | null;
  email: string | null;
  name: string;
  role: Role;
  /** รหัสผ่านตั้งจาก ADMIN_PASSWORD ใน Environment (เปลี่ยนผ่านหน้าเว็บไม่ได้) */
  passwordManagedByEnv: boolean;
};

export type AuthSession = {
  sessionId: string;
  user: SessionUser;
  expiresAt: Date;
};

function ttlMs() {
  return env().SESSION_TTL_HOURS * 60 * 60 * 1000;
}

function cookieSecure(): boolean {
  const mode = env().COOKIE_SECURE;
  if (mode === "true") return true;
  if (mode === "false") return false;
  const url = env().APP_URL;
  if (url) return url.startsWith("https://");
  return env().NODE_ENV === "production";
}

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + ttlMs());
  await prisma.session.create({
    data: {
      tokenHash: sha256Hex(token),
      userId,
      expiresAt,
      ipAddress: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
    },
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** อ่าน session จาก cookie และตรวจสอบกับฐานข้อมูล */
export async function getSession(): Promise<AuthSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  return getSessionByToken(token);
}

export async function getSessionByToken(token: string): Promise<AuthSession | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: { select: { id: true, username: true, email: true, name: true, role: true, isActive: true, passwordHash: true } } },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // sliding expiration — ต่ออายุเมื่อใช้งาน (อัปเดตไม่เกินทุก 5 นาที)
  if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    const expiresAt = new Date(now + ttlMs());
    await prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date(now), expiresAt } })
      .catch(() => undefined);
    session.expiresAt = expiresAt;
  }
  const { isActive: _isActive, passwordHash, ...rest } = session.user;
  const passwordManagedByEnv = isEnvAdminUser(rest);
  // ผู้ดูแลหลัก: ถ้า ADMIN_PASSWORD ถูกเปลี่ยนหลังจากเข้าสู่ระบบ ให้ session นี้หมดอายุทันที
  if (passwordManagedByEnv && !(await envAdminSessionStillValid(rest.id, passwordHash))) return null;
  const user: SessionUser = { ...rest, passwordManagedByEnv };
  return { sessionId: session.id, user, expiresAt: session.expiresAt };
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** ยกเลิก session ทั้งหมดของผู้ใช้ (ยกเว้น session ปัจจุบันถ้าระบุ) */
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}
