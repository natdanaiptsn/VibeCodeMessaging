import "server-only";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { safeEqual, sha256Hex } from "@/lib/crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logger } from "@/lib/logger";
import type { User } from "@/lib/generated/prisma/client";

/**
 * ผู้ดูแลหลักที่กำหนดผ่าน Environment Variables
 * - ล็อกอินด้วย ADMIN_USERNAME (หรือ ADMIN_EMAIL ถ้าไม่ได้ตั้ง username) + ADMIN_PASSWORD
 * - เปลี่ยนรหัสผ่านได้โดยแก้ ADMIN_PASSWORD แล้ว deploy ใหม่ (session เดิมจะถูกยกเลิก)
 */
export const ENV_ADMIN_MIN_PASSWORD = 8;
export const USERNAME_RE = /^[a-z0-9._-]{3,50}$/;

export type EnvAdmin = { identifier: string; byUsername: boolean; password: string; email: string | null; name: string };

export function envAdminConfig(): EnvAdmin | null {
  const e = env();
  const username = e.ADMIN_USERNAME?.trim().toLowerCase() || null;
  const email = e.ADMIN_EMAIL?.trim().toLowerCase() || null;
  const password = e.ADMIN_PASSWORD;
  if (!password || (!username && !email)) return null;
  if (username && !USERNAME_RE.test(username)) {
    logger.error("ADMIN_USERNAME ไม่ถูกต้อง (ใช้ a-z 0-9 . _ - ความยาว 3-50 ตัว)");
    return null;
  }
  return {
    identifier: username ?? email!,
    byUsername: Boolean(username),
    password,
    email,
    name: e.ADMIN_NAME?.trim() || "ผู้ดูแลระบบ",
  };
}

/** ผู้ใช้คนนี้คือผู้ดูแลหลักจาก Environment หรือไม่ (รหัสผ่านจัดการผ่าน ADMIN_PASSWORD) */
export function isEnvAdminUser(user: { username: string | null; email: string | null }): boolean {
  const cfg = envAdminConfig();
  if (!cfg) return false;
  return cfg.byUsername ? user.username === cfg.identifier : user.email === cfg.identifier;
}

export function envPasswordMatches(cfg: EnvAdmin, password: string): boolean {
  // เปรียบเทียบ hash แบบ constant-time (ความยาวเท่ากันเสมอ)
  return safeEqual(sha256Hex(password), sha256Hex(cfg.password));
}

export async function findEnvAdminUser(cfg: EnvAdmin): Promise<User | null> {
  if (cfg.byUsername) {
    const byUsername = await prisma.user.findUnique({ where: { username: cfg.identifier } });
    if (byUsername) return byUsername;
  }
  return cfg.email ? prisma.user.findUnique({ where: { email: cfg.email } }) : null;
}

/** สร้าง/อัปเดตบัญชีผู้ดูแลหลักให้ตรงกับค่าใน Environment (เรียกหลังตรวจรหัสผ่านถูกต้องแล้ว) */
export async function syncEnvAdmin(cfg: EnvAdmin, existing: User | null): Promise<User> {
  if (!existing) {
    return prisma.user.create({
      data: {
        username: cfg.byUsername ? cfg.identifier : null,
        email: cfg.email,
        name: cfg.name,
        role: "OWNER",
        passwordHash: await hashPassword(cfg.password),
        passwordChangedAt: new Date(),
      },
    });
  }
  const passwordChanged = !(await verifyPassword(cfg.password, existing.passwordHash));
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...(cfg.byUsername && existing.username !== cfg.identifier ? { username: cfg.identifier } : {}),
      role: "OWNER",
      isActive: true,
      ...(passwordChanged ? { passwordHash: await hashPassword(cfg.password), passwordChangedAt: new Date() } : {}),
    },
  });
  // รหัสผ่านใน Environment เปลี่ยน → ยกเลิก session เดิมทั้งหมด
  if (passwordChanged) await prisma.session.deleteMany({ where: { userId: user.id } });
  return user;
}

const verifiedHashes = new Map<string, boolean>();

/**
 * ตรวจว่ารหัสผ่านใน Environment ยังตรงกับ hash ที่บันทึกไว้หรือไม่ (cache ผลต่อ instance)
 * ถ้าไม่ตรง แปลว่า ADMIN_PASSWORD ถูกเปลี่ยน → ยกเลิก session เดิมทั้งหมดทันที
 */
export async function envAdminSessionStillValid(userId: string, passwordHash: string): Promise<boolean> {
  const cfg = envAdminConfig();
  if (!cfg) return true;
  const key = `${userId}:${passwordHash}`;
  let ok = verifiedHashes.get(key);
  if (ok === undefined) {
    ok = await verifyPassword(cfg.password, passwordHash);
    if (verifiedHashes.size > 100) verifiedHashes.clear();
    verifiedHashes.set(key, ok);
  }
  if (!ok) {
    await prisma.session.deleteMany({ where: { userId } });
    logger.info("ADMIN_PASSWORD changed — revoked existing admin sessions");
  }
  return ok;
}
