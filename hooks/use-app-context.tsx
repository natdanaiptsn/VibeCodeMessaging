"use client";

import { createContext, useCallback, useContext } from "react";
import { can, type Permission, type Role } from "@/lib/auth/permissions";

export type AppUser = {
  id: string;
  username: string | null;
  email: string | null;
  name: string;
  role: Role;
  passwordManagedByEnv: boolean;
};

/** โปรเจกต์ที่กำลังเปิดอยู่ (ไม่มีข้อมูลลับ) */
export type AppProject = {
  id: string;
  name: string;
  isDefault: boolean;
  displayName: string | null;
  pictureUrl: string | null;
  /** บทบาทของผู้ใช้ในโปรเจกต์นี้ */
  role: Role;
};

export type AppContextValue = { user: AppUser; timezone: string; project: AppProject | null };

const AppContext = createContext<AppContextValue | null>(null);

export const AppContextProvider = AppContext.Provider;

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppContextProvider");
  return ctx;
}

/** บทบาทที่ใช้ตรวจสิทธิ์: ภายในโปรเจกต์ใช้บทบาทในโปรเจกต์ นอกโปรเจกต์ใช้บทบาทของบัญชี */
export function useRole(): Role {
  const { user, project } = useAppContext();
  return project?.role ?? user.role;
}

export function useCan(permission: Permission): boolean {
  return can(useRole(), permission);
}

/** โปรเจกต์ปัจจุบัน (ใช้ได้เฉพาะหน้าภายใน /p/{projectId}/...) */
export function useProject(): AppProject {
  const { project } = useAppContext();
  if (!project) throw new Error("useProject must be used inside a project page");
  return project;
}

/** สร้างลิงก์ภายในโปรเจกต์ปัจจุบัน เช่น projectPath("/inbox") → /p/{id}/inbox */
export function useProjectPath(): (path: string) => string {
  const { project } = useAppContext();
  const id = project?.id;
  return useCallback((path: string) => (id ? `/p/${id}${path}` : path), [id]);
}
