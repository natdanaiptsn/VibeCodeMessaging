import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/permissions";

/** ใช้ใน Server Components — cache ต่อ request */
export const getCurrentSession = cache(getSession);

export async function requirePageUser(permission?: Permission) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (permission && !can(session.user.role, permission)) redirect("/dashboard?denied=1");
  return session.user;
}
