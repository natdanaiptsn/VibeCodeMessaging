import { z } from "zod";

export const lineCredentialsSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  channelId: z
    .string()
    .trim()
    .regex(/^\d{5,20}$/, "Channel ID ต้องเป็นตัวเลข")
    .optional()
    .or(z.literal("")),
  channelSecret: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{32}$/, "Channel Secret ต้องเป็นเลขฐาน 16 จำนวน 32 ตัวอักษร")
    .optional()
    .or(z.literal("")),
  channelAccessToken: z
    .string()
    .trim()
    .min(20, "Channel Access Token สั้นเกินไป")
    .max(1000, "Channel Access Token ยาวเกินไป")
    .regex(/^[A-Za-z0-9+/=._-]+$/, "Channel Access Token มีอักขระที่ไม่ถูกต้อง")
    .optional()
    .or(z.literal("")),
});

export const webhookEndpointSchema = z.object({
  endpoint: z
    .url("URL ไม่ถูกต้อง")
    .max(500)
    .refine((v) => v.startsWith("https://"), "Webhook URL ต้องเป็น HTTPS"),
});

export const sendMessageSchema = z
  .object({
    type: z.enum(["text", "textTemplate", "flexTemplate"]),
    text: z.string().max(5000).optional(),
    templateId: z.uuid().optional(),
    clientRequestId: z.uuid("clientRequestId ไม่ถูกต้อง"),
  })
  .superRefine((d, ctx) => {
    if (d.type === "text" && !d.text?.trim()) {
      ctx.addIssue({ code: "custom", path: ["text"], message: "กรุณาพิมพ์ข้อความ" });
    }
    if (d.type !== "text" && !d.templateId) {
      ctx.addIssue({ code: "custom", path: ["templateId"], message: "กรุณาเลือก Template" });
    }
  });
