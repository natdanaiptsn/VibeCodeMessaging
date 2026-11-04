import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { uuidSchema } from "@/lib/validation/common";

/** ใช้ใน Server Components — cache ต่อ request */
export const getCurrentSession = cache(getSession);

/** ต้องเข้าสู่ระบบ (permission = สิทธิ์ระดับระบบ) */
export async function requirePageUser(permission?: Permission) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (permission && !can(session.user.role, permission)) redirect("/projects");
  return session.user;
}

const getProjectMembership = cache(async (projectId: string, userId: string) =>
  prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { role: true, project: { select: { id: true, name: true, isDefault: true, displayName: true, pictureUrl: true } } },
  }),
);

/**
 * หน้าภายในโปรเจกต์: ต้องเป็นสมาชิก (ไม่ใช่สมาชิก = 404) และมีสิทธิ์ตามบทบาทในโปรเจกต์นี้
 */
export async function requireProjectPage(params: Promise<{ projectId: string }>, permission?: Permission) {
  const user = await requirePageUser();
  const { projectId } = await params;
  if (!uuidSchema.safeParse(projectId).success) notFound();
  const membership = await getProjectMembership(projectId, user.id);
  if (!membership) notFound();
  if (permission && !can(membership.role, permission)) redirect(`/p/${projectId}/inbox`);
  return { user, project: { ...membership.project, role: membership.role } };
}
