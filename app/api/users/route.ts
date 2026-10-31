import { route, readJson } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { createUserSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { conflict } from "@/lib/errors";
import { auditFromCtx } from "@/lib/audit";
import { isEnvAdminUser } from "@/lib/auth/env-admin";

const userSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} as const;

export const GET = route({ permission: "users:manage" }, async () => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: userSelect });
  return users.map((u) => ({ ...u, managedByEnv: isEnvAdminUser(u) }));
});

export const POST = route({ permission: "users:manage", rateLimitPerMinute: 20 }, async (ctx) => {
  const input = createUserSchema.parse(await readJson(ctx.req, 4096));
  if (input.email && (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }))) {
    throw conflict("อีเมลนี้ถูกใช้งานแล้ว");
  }
  if (input.username && (await prisma.user.findUnique({ where: { username: input.username }, select: { id: true } }))) {
    throw conflict("ชื่อผู้ใช้นี้ถูกใช้งานแล้ว");
  }
  const user = await prisma.user.create({
    data: {
      username: input.username ?? null,
      email: input.email ?? null,
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    },
    select: userSelect,
  });
  await auditFromCtx(ctx)({
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    summary: `เพิ่มผู้ใช้ ${user.username ?? user.email} (${user.role})`,
  });
  return user;
});
