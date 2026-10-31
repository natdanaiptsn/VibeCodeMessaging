import { route, readJson } from "@/lib/api/handler";
import { prisma } from "@/lib/prisma";
import { createUserSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { conflict } from "@/lib/errors";
import { auditFromCtx } from "@/lib/audit";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  lockedUntil: true,
  createdAt: true,
} as const;

export const GET = route({ permission: "users:manage" }, async () =>
  prisma.user.findMany({ orderBy: { createdAt: "asc" }, select: userSelect }),
);

export const POST = route({ permission: "users:manage", rateLimitPerMinute: 20 }, async (ctx) => {
  const input = createUserSchema.parse(await readJson(ctx.req, 4096));
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw conflict("อีเมลนี้ถูกใช้งานแล้ว");
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password) },
    select: userSelect,
  });
  await auditFromCtx(ctx)({ action: "user.create", entityType: "User", entityId: user.id, summary: `เพิ่มผู้ใช้ ${user.email} (${user.role})` });
  return user;
});
