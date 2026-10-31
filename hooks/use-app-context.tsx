"use client";

import { createContext, useContext } from "react";
import { can, type Permission, type Role } from "@/lib/auth/permissions";

export type AppUser = {
  id: string;
  username: string | null;
  email: string | null;
  name: string;
  role: Role;
  passwordManagedByEnv: boolean;
};
export type AppContextValue = { user: AppUser; timezone: string };

const AppContext = createContext<AppContextValue | null>(null);

export const AppContextProvider = AppContext.Provider;

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppContextProvider");
  return ctx;
}

export function useCan(permission: Permission): boolean {
  return can(useAppContext().user.role, permission);
}
