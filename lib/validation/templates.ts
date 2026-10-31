import { z } from "zod";
import { LINE_LIMITS } from "@/lib/line/limits";
import { findUnknownVariables } from "@/lib/templates/variables";
import { validateFlexContainer } from "@/lib/flex/validate";

export const textTemplateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาตั้งชื่อข้อความ").max(100, "ชื่อยาวเกิน 100 ตัวอักษร"),
  description: z.string().trim().max(500).optional().nullable(),
  content: z
    .string()
    .min(1, "กรุณากรอกข้อความ")
    .max(LINE_LIMITS.TEXT_MAX_CHARS, `ข้อความยาวเกิน ${LINE_LIMITS.TEXT_MAX_CHARS} ตัวอักษร`)
    .refine((v) => v.trim().length > 0, "ข้อความต้องไม่เป็นช่องว่างทั้งหมด")
    .superRefine((v, ctx) => {
      const unknown = findUnknownVariables(v);
      if (unknown.length) {
        ctx.addIssue({ code: "custom", message: `ไม่รู้จักตัวแปร: ${unknown.map((u) => `{{${u}}}`).join(", ")}` });
      }
    }),
});

export type TextTemplateInput = z.infer<typeof textTemplateSchema>;

export const flexContentsSchema = z.unknown().superRefine((value, ctx) => {
  const result = validateFlexContainer(value);
  for (const e of result.errors.slice(0, 50)) {
    ctx.addIssue({ code: "custom", message: `${e.path}: ${e.message}` });
  }
});

export const flexTemplateSchema = z.object({
  name: z.string().trim().min(1, "กรุณาตั้งชื่อ Template").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  altText: z
    .string()
    .trim()
    .min(1, "กรุณากรอกข้อความแจ้งเตือน (altText)")
    .max(LINE_LIMITS.ALT_TEXT_MAX_CHARS, `altText ยาวเกิน ${LINE_LIMITS.ALT_TEXT_MAX_CHARS} ตัวอักษร`),
  contents: flexContentsSchema,
});

export type FlexTemplateInput = z.infer<typeof flexTemplateSchema>;
