import { z } from "zod";

export const loginSchema = z.object({
  // ชื่อผู้ใช้ หรืออีเมล
  username: z.string().trim().toLowerCase().min(1, "กรุณากรอกชื่อผู้ใช้").max(200),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200),
});

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,50}$/, "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z, 0-9, จุด, ขีดล่าง, ขีดกลาง ความยาว 3-50 ตัว");

export const passwordPolicy = z
  .string()
  .min(10, "รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร")
  .max(128, "รหัสผ่านยาวเกินไป")
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน").max(200),
    newPassword: passwordPolicy,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
    path: ["newPassword"],
  });

export const roleSchema = z.enum(["OWNER", "ADMIN", "AGENT"]);

export const createUserSchema = z
  .object({
    username: z.preprocess((v) => (v === "" ? undefined : v), usernameSchema.optional()),
    email: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200).optional()),
    name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
    role: roleSchema,
    password: passwordPolicy,
  })
  .refine((d) => d.username || d.email, { message: "กรุณากรอกชื่อผู้ใช้หรืออีเมลอย่างน้อยหนึ่งอย่าง", path: ["username"] });

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  password: passwordPolicy.optional(),
});
