import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200),
});

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

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("อีเมลไม่ถูกต้อง").max(200),
  name: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  role: roleSchema,
  password: passwordPolicy,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
  isActive: z.boolean().optional(),
  password: passwordPolicy.optional(),
});
