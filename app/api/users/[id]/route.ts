import { route, readJson } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { updateUserSchema } from "@/lib/validation/auth";
import { idParamsSchema } from "@/lib/validation/common";
import { hashPassword } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { badRequest, notFound } from "@/lib/errors";
import { auditFromCtx } from "@/lib/audit";
import { isEnvAdminUser } from "@/lib/auth/env-admin";

const ENV_MANAGED = "บัญชีนี้เป็นผู้ดูแลหลักที่ตั้งค่าผ่าน Environment Variables (ADMIN_USERNAME / ADMIN_PASSWORD) จึงแก้ไขสิทธิ์ สถานะ รหัสผ่าน หรือลบจากหน้านี้ไม่ได้";

async function assertNotLastOwner(userId: string) {
  const owners = await prisma.user.count({ where: { role: "OWNER", isActive: true, id: { not: userId } } });
  if (owners === 0) throw badRequest("ต้องมีเจ้าของระบบ (OWNER) ที่ใช้งานได้อย่างน้อย 1 คน");
}

export const PATCH = route<{ id: string }>({ permission: "users:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  const input = updateUserSchema.parse(await readJson(ctx.req, 4096));
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("ไม่พบผู้ใช้");
  if (isEnvAdminUser(user) && (input.role || input.isActive !== undefined || input.password)) throw badRequest(ENV_MANAGED);
  if (user.role === "OWNER" && ((input.role && input.role !== "OWNER") || input.isActive === false)) {
    await assertNotLastOwner(id);
  }
  if (id === ctx.session.user.id && input.isActive === false) throw badRequest("ไม่สามารถปิดการใช้งานบัญชีของตนเองได้");
  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.role ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive, ...(input.isActive ? { lockedUntil: null, failedLoginCount: 0 } : {}) } : {}),
      ...(input.password ? { passwordHash: await hashPassword(input.password), passwordChangedAt: new Date() } : {}),
    },
    select: { id: true, username: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true, lockedUntil: true, createdAt: true },
  });
  if (input.password || input.isActive === false || input.role) await revokeUserSessions(id, id === ctx.session.user.id ? ctx.session.sessionId : undefined);
  await auditFromCtx(ctx)({
    action: "user.update",
    entityType: "User",
    entityId: id,
    summary: `แก้ไขผู้ใช้ ${updated.username ?? updated.email}`,
    metadata: { name: input.name, role: input.role, isActive: input.isActive, passwordChanged: Boolean(input.password) },
  });
  return updated;
});

export const DELETE = route<{ id: string }>({ permission: "users:manage" }, async (ctx) => {
  const { id } = idParamsSchema.parse(ctx.params);
  if (id === ctx.session.user.id) throw badRequest("ไม่สามารถลบบัญชีของตนเองได้");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("ไม่พบผู้ใช้");
  if (isEnvAdminUser(user)) throw badRequest(ENV_MANAGED);
  if (user.role === "OWNER") await assertNotLastOwner(id);
  await prisma.user.delete({ where: { id } });
  await auditFromCtx(ctx)({ action: "user.delete", entityType: "User", entityId: id, summary: `ลบผู้ใช้ ${user.username ?? user.email}` });
  return { ok: true };
});
