/** ระบบสิทธิ์ (ใช้ได้ทั้งฝั่ง Server และ Client) */
export type Role = "OWNER" | "ADMIN" | "AGENT";

const ROLE_LEVEL: Record<Role, number> = { AGENT: 1, ADMIN: 2, OWNER: 3 };

/**
 * สิทธิ์ภายในโปรเจกต์ (inbox, rules, templates, line, settings, projects:manage/delete, members) ตรวจจากบทบาทในโปรเจกต์
 * สิทธิ์ระดับระบบ (projects:create, system:settings, users:manage, audit:view) ตรวจจากบทบาทของบัญชี
 */
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
  "projects:create": "AGENT", // ทุกบัญชีสร้างโปรเจกต์ของตัวเองได้
  "projects:manage": "ADMIN", // เปลี่ยนชื่อโปรเจกต์
  "projects:delete": "OWNER",
  "members:manage": "ADMIN",
  "system:settings": "ADMIN", // ระบบ Log (ใช้ร่วมกันทุกโปรเจกต์)
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

/** บทบาทในโปรเจกต์ */
export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "เจ้าของ",
  ADMIN: "ผู้ดูแล",
  AGENT: "เจ้าหน้าที่",
};

/** บทบาทระดับระบบ (หน้า บัญชีและผู้ใช้งาน) */
export const SYSTEM_ROLE_LABELS: Record<Role, string> = {
  OWNER: "ผู้ดูแลระบบสูงสุด",
  ADMIN: "ผู้ดูแลระบบ",
  AGENT: "ผู้ใช้ทั่วไป",
};
