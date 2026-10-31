import { z } from "zod";
import { checkRegexSafety } from "@/lib/auto-reply/regex-safety";

export const TRIGGERS = ["TEXT", "POSTBACK", "FOLLOW", "IMAGE", "STICKER", "LOCATION"] as const;
export const MATCH_TYPES = ["EXACT", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "REGEX"] as const;
export const KEYWORD_TRIGGERS = new Set(["TEXT", "POSTBACK"]);

export const ruleInputSchema = z
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
    replyType: z.enum(["TEXT", "FLEX"]),
    textTemplateId: z.uuid().optional().nullable(),
    flexTemplateId: z.uuid().optional().nullable(),
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
    if (d.replyType === "TEXT" && !d.textTemplateId) {
      ctx.addIssue({ code: "custom", path: ["textTemplateId"], message: "กรุณาเลือกข้อความตอบกลับ" });
    }
    if (d.replyType === "FLEX" && !d.flexTemplateId) {
      ctx.addIssue({ code: "custom", path: ["flexTemplateId"], message: "กรุณาเลือก Flex Message" });
    }
  });

export type RuleInput = z.infer<typeof ruleInputSchema>;

export const ruleTestSchema = z.object({
  text: z.string().max(5000),
  triggerType: z.enum(TRIGGERS).default("TEXT"),
});
