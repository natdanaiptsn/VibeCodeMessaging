import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(1, "กรุณากรอกชื่อโปรเจกต์")
  .max(80, "ชื่อโปรเจกต์ยาวเกิน 80 ตัวอักษร")
  .regex(/^[^\u0000-\u001f\u007f]+$/, "ชื่อโปรเจกต์มีอักขระที่ไม่รองรับ");

const description = z.string().trim().max(300, "คำอธิบายยาวเกิน 300 ตัวอักษร").optional().nullable();

export const projectCreateSchema = z.object({ name, description });
export const projectUpdateSchema = z
  .object({ name: name.optional(), description })
  .refine((d) => d.name !== undefined || d.description !== undefined, "ไม่มีข้อมูลที่ต้องการแก้ไข");

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

const memberRole = z.enum(["OWNER", "ADMIN", "AGENT"]);

export const memberAddSchema = z.object({
  identifier: z.string().trim().min(3, "กรอกอีเมลหรือชื่อผู้ใช้").max(254),
  role: memberRole.default("AGENT"),
});
export const memberUpdateSchema = z.object({ role: memberRole });
