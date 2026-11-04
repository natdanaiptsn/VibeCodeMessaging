import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { badRequest, conflict } from "@/lib/errors";
import { randomToken } from "@/lib/crypto";
import type { IdTokenClaims } from "@/lib/auth/oauth/jwt";
import type { OAuthProvider } from "@/lib/auth/oauth/providers";
import type { AuthProvider, User } from "@/lib/generated/prisma/client";

/**
 * เข้าสู่ระบบ / สมัคร / ผูกบัญชี ด้วย Google หรือ LINE
 * - ระบุตัวตนด้วย (ผู้ให้บริการ, sub) เสมอ — ไม่เปลี่ยนแม้ผู้ใช้เปลี่ยนชื่อหรืออีเมล
 * - อีเมลที่ Google ยืนยันแล้ว ใช้จับคู่กับบัญชีเดิมที่มีอีเมลเดียวกันได้ (เช่น ผู้ดูแลสร้างบัญชีไว้ให้ก่อน)
 * - บัญชีใหม่ได้บทบาทระดับระบบเป็น AGENT (ไม่มีสิทธิ์จัดการผู้ใช้/ระบบ) และเห็นเฉพาะโปรเจกต์ของตัวเอง
 */

export type SsoProfile = {
  provider: AuthProvider;
  subject: string;
  email: string | null;
  name: string;
  picture: string | null;
};

export type SignInResult = { ok: true; user: User; created: boolean } | { ok: false; reason: "disabled" | "signup_closed" };

function httpsUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 1000) return null;
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
}

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return name || null;
}

export function profileFromClaims(provider: OAuthProvider, c: IdTokenClaims): SsoProfile {
  const verified = c.email_verified === true || c.email_verified === "true";
  const email =
    provider.trustEmail && verified && typeof c.email === "string" && c.email.length <= 254 && c.email.includes("@")
      ? c.email.trim().toLowerCase()
      : null;
  return {
    provider: provider.dbProvider,
    subject: c.sub,
    email,
    name: cleanName(c.name) ?? (email ? email.split("@")[0]! : `ผู้ใช้ ${provider.label}`),
    picture: httpsUrl(c.picture),
  };
}

/**
 * ชื่อผู้ใช้อัตโนมัติสำหรับบัญชีใหม่ (ใช้ให้เจ้าของโปรเจกต์เพิ่มเป็นสมาชิก — บัญชี LINE ไม่มีอีเมล)
 * Google: ส่วนหน้าของอีเมล, LINE: "line" + ตัวอักษรสุ่ม — ชนกันจะต่อท้ายด้วยตัวเลขสุ่ม
 */
async function uniqueUsername(profile: SsoProfile): Promise<string> {
  const local = profile.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30) ?? "";
  const base = local.length >= 3 ? local : profile.provider === "LINE" ? "line" : "user";
  for (let i = 0; i < 6; i++) {
    const suffix = i === 0 && base !== "line" && base !== "user" ? "" : `${base.endsWith(".") ? "" : "."}${randomToken(6).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5)}`;
    const candidate = `${base}${suffix}`.slice(0, 50);
    if (candidate.length >= 3 && !(await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate;
  }
  return `user.${randomToken(9).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10)}`;
}

async function touchIdentity(id: string, profile: SsoProfile) {
  await prisma.userIdentity.update({
    where: { id },
    data: { email: profile.email, displayName: profile.name, pictureUrl: profile.picture, lastUsedAt: new Date() },
  });
}

export async function signInWithProvider(profile: SsoProfile): Promise<SignInResult> {
  const identity = await prisma.userIdentity.findUnique({
    where: { provider_subject: { provider: profile.provider, subject: profile.subject } },
    include: { user: true },
  });
  if (identity) {
    if (!identity.user.isActive) return { ok: false, reason: "disabled" };
    await touchIdentity(identity.id, profile);
    return { ok: true, user: identity.user, created: false };
  }

  // อีเมลที่ยืนยันแล้วตรงกับบัญชีเดิม → ผูกบัญชีให้อัตโนมัติ
  if (profile.email) {
    const existing = await prisma.user.findUnique({ where: { email: profile.email } });
    if (existing) {
      if (!existing.isActive) return { ok: false, reason: "disabled" };
      const sameProvider = await prisma.userIdentity.findUnique({
        where: { userId_provider: { userId: existing.id, provider: profile.provider } },
      });
      if (!sameProvider) {
        await prisma.userIdentity.create({
          data: {
            userId: existing.id,
            provider: profile.provider,
            subject: profile.subject,
            email: profile.email,
            displayName: profile.name,
            pictureUrl: profile.picture,
            lastUsedAt: new Date(),
          },
        });
        return { ok: true, user: existing, created: false };
      }
    }
  }

  if (!env().AUTH_ALLOW_SIGNUP) return { ok: false, reason: "signup_closed" };

  const emailTaken = profile.email ? await prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } }) : null;
  const user = await prisma.user.create({
    data: {
      name: profile.name,
      username: await uniqueUsername(profile),
      email: emailTaken ? null : profile.email,
      role: "AGENT",
      passwordHash: null,
      avatarUrl: profile.picture,
      identities: {
        create: {
          provider: profile.provider,
          subject: profile.subject,
          email: profile.email,
          displayName: profile.name,
          pictureUrl: profile.picture,
          lastUsedAt: new Date(),
        },
      },
    },
  });
  return { ok: true, user, created: true };
}

/** ผูกบัญชี Google / LINE กับผู้ใช้ที่เข้าสู่ระบบอยู่ */
export async function linkIdentity(userId: string, profile: SsoProfile) {
  const owner = await prisma.userIdentity.findUnique({
    where: { provider_subject: { provider: profile.provider, subject: profile.subject } },
    select: { userId: true },
  });
  if (owner && owner.userId !== userId) throw conflict("บัญชีนี้ผูกกับผู้ใช้อื่นในระบบอยู่แล้ว");
  if (owner) return;
  const existing = await prisma.userIdentity.findUnique({ where: { userId_provider: { userId, provider: profile.provider } } });
  if (existing) throw conflict("ผูกบัญชีประเภทนี้ไว้แล้ว — ยกเลิกการผูกบัญชีเดิมก่อน");
  await prisma.userIdentity.create({
    data: {
      userId,
      provider: profile.provider,
      subject: profile.subject,
      email: profile.email,
      displayName: profile.name,
      pictureUrl: profile.picture,
      lastUsedAt: new Date(),
    },
  });
}

/** ยกเลิกการผูกบัญชี — ต้องเหลือวิธีเข้าสู่ระบบอย่างน้อย 1 วิธี */
export async function unlinkIdentity(userId: string, provider: AuthProvider) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, identities: { select: { id: true, provider: true } } },
  });
  const target = user?.identities.find((i) => i.provider === provider);
  if (!user || !target) throw badRequest("ยังไม่ได้ผูกบัญชีนี้");
  const remaining = user.identities.length - 1 + (user.passwordHash ? 1 : 0);
  if (remaining < 1) throw badRequest("ยกเลิกไม่ได้ เพราะจะไม่เหลือวิธีเข้าสู่ระบบ — ผูกบัญชีอื่นหรือตั้งรหัสผ่านก่อน");
  await prisma.userIdentity.delete({ where: { id: target.id } });
}
