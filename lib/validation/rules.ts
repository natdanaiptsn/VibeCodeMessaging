import { z } from "zod";
import { checkRegexSafety } from "@/lib/auto-reply/regex-safety";

export const TRIGGERS = ["TEXT", "POSTBACK", "FOLLOW", "IMAGE", "STICKER", "LOCATION"] as const;
export const MATCH_TYPES = ["EXACT", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "REGEX"] as const;
export const KEYWORD_TRIGGERS = new Set(["TEXT", "POSTBACK"]);

/** LINE ตอบกลับได้สูงสุด 5 ข้อความต่อ 1 ครั้ง */
export const MAX_RULE_MESSAGES = 5;
export const MAX_INLINE_TEXT = 5000;

/**
 * ข้อความตอบกลับ 1 ข้อความของกฎ
 * - TEXT: พิมพ์เอง (text) หรือเลือก Text Template (textTemplateId) อย่างใดอย่างหนึ่ง
 * - FLEX: เลือก Flex Template
 */
export const ruleMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TEXT"),
    text: z.string().max(MAX_INLINE_TEXT, `ข้อความยาวเกิน ${MAX_INLINE_TEXT} ตัวอักษร`).optional().nullable(),
    textTemplateId: z.uuid().optional().nullable(),
  }),
  z.object({
    type: z.literal("FLEX"),
    flexTemplateId: z.uuid({ message: "กรุณาเลือก Flex Message" }),
  }),
]);

export type RuleMessageInput = z.infer<typeof ruleMessageSchema>;

/** รองรับรูปแบบเดิม (replyType + textTemplateId/flexTemplateId = 1 ข้อความ) */
function legacyToMessages(raw: unknown) {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  if (r.messages !== undefined || r.replyType === undefined) return raw;
  const messages =
    r.replyType === "FLEX"
      ? [{ type: "FLEX", flexTemplateId: r.flexTemplateId }]
      : [{ type: "TEXT", textTemplateId: r.textTemplateId }];
  return { ...r, messages };
}

const ruleObjectSchema = z
  .object({
    name: z.string().trim().min(1, "กรุณาตั้งชื่อกฎ").max(100, "ชื่อกฎยาวเกิน 100 ตัวอักษร"),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().default(true),
    priority: z.coerce.number().int().min(-1000).max(1000).default(0),
    triggerType: z.enum(TRIGGERS).default("TEXT"),
    matchType: z.enum(MATCH_TYPES).default("CONTAINS"),
    keywordLogic: z.enum(["ANY", "ALL"]).default("ANY"),
    caseSensitive: z.boolean().default(false),
    keywords: z
      .array(z.string().trim().min(1, "Keyword ต้องไม่เป็นค่าว่าง").max(200, "Keyword ยาวเกิน 200 ตัวอักษร"))
      .max(50, "กำหนด Keyword ได้ไม่เกิน 50 รายการ")
      .default([]),
    messages: z
      .array(ruleMessageSchema)
      .min(1, "เพิ่มข้อความตอบกลับอย่างน้อย 1 ข้อความ")
      .max(MAX_RULE_MESSAGES, `ตอบกลับได้สูงสุด ${MAX_RULE_MESSAGES} ข้อความต่อครั้ง (ข้อจำกัดของ LINE)`),
  })
  .superRefine((d, ctx) => {
    if (KEYWORD_TRIGGERS.has(d.triggerType) && d.keywords.length === 0) {
      ctx.addIssue({ code: "custom", path: ["keywords"], message: "กรุณาเพิ่ม Keyword อย่างน้อย 1 รายการ" });
    }
    if (d.matchType === "REGEX" && KEYWORD_TRIGGERS.has(d.triggerType)) {
      d.keywords.forEach((k, i) => {
        const r = checkRegexSafety(k);
        if (!r.ok) ctx.addIssue({ code: "custom", path: ["keywords", i], message: r.reason });
      });
    }
    d.messages.forEach((m, i) => {
      if (m.type !== "TEXT") return;
      const hasText = Boolean(m.text?.trim());
      if (!hasText && !m.textTemplateId) {
        ctx.addIssue({ code: "custom", path: ["messages", i, "text"], message: "พิมพ์ข้อความ หรือเลือก Text Template" });
      }
      if (hasText && m.textTemplateId) {
        ctx.addIssue({ code: "custom", path: ["messages", i, "text"], message: "เลือกได้อย่างใดอย่างหนึ่ง: พิมพ์เอง หรือใช้ Template" });
      }
    });
  });

export const ruleInputSchema = z.preprocess(legacyToMessages, ruleObjectSchema);

export type RuleInput = z.infer<typeof ruleObjectSchema>;

/** สรุปชนิดของข้อความทั้งหมดในกฎ */
export function summarizeReplyType(messages: { type: "TEXT" | "FLEX" }[]): "TEXT" | "FLEX" | "MIXED" {
  const types = new Set(messages.map((m) => m.type));
  return types.size > 1 ? "MIXED" : types.has("FLEX") ? "FLEX" : "TEXT";
}

export const ruleTestSchema = z.object({
  text: z.string().max(5000),
  triggerType: z.enum(TRIGGERS).default("TEXT"),
});
