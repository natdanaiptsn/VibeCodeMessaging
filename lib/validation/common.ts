import { z } from "zod";

export const uuidSchema = z.uuid({ message: "รหัสอ้างอิงไม่ถูกต้อง" });
export const idParamsSchema = z.object({ id: uuidSchema });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD")
  .optional();

export const searchSchema = z.string().trim().max(200).optional();

export function emptyToUndefined(v: unknown) {
  return v === "" || v === null ? undefined : v;
}
