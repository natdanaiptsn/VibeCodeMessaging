/** ระบบสิทธิ์ (ใช้ได้ทั้งฝั่ง Server และ Client) */
export type Role = "OWNER" | "ADMIN" | "AGENT";

const ROLE_LEVEL: Record<Role, number> = { AGENT: 1, ADMIN: 2, OWNER: 3 };

export const PERMISSIONS = {
  "inbox:view": "AGENT",
  "inbox:send": "AGENT",
  "customers:view": "AGENT",
  "customers:edit": "AGENT",
  "rules:view": "AGENT",
  "rules:manage": "ADMIN",
  "templates:view": "AGENT",
  "templates:manage": "ADMIN",
  "flex:manage": "ADMIN",
  "media:upload": "ADMIN",
  "settings:view": "ADMIN",
  "settings:manage": "ADMIN",
  "projects:manage": "ADMIN", // สร้าง / เปลี่ยนชื่อโปรเจกต์
  "projects:delete": "OWNER",
  "line:view": "ADMIN",
  "line:manage": "OWNER",
  "users:manage": "OWNER",
  "audit:view": "OWNER",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(role: Role, minimum: Role): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[minimum];
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return hasRole(role, PERMISSIONS[permission]);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "เจ้าของระบบ",
  ADMIN: "ผู้ดูแล",
  AGENT: "เจ้าหน้าที่",
};
