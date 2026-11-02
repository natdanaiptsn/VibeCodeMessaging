import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/auto-reply/normalize";
import { validateFlexMessage } from "@/lib/flex/validate";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";
import type { Prisma } from "@/lib/generated/prisma/client";
import { TEST_FLEX_ALT_TEXT, TEST_FLEX_CONTENTS } from "@/lib/flex/presets";

export { TEST_FLEX_ALT_TEXT, TEST_FLEX_CONTENTS };

/**
 * กฎสำหรับทดสอบการเชื่อมต่อ (สร้างจากขั้นตอนที่ 5 ของหน้า LINE OA Settings)
 * - พิมพ์ "test" / "ทดสอบ"        → ตอบด้วย Text Message
 * - พิมพ์ "TestFlex" / "test flex" → ตอบด้วย Flex Message ชื่อ "TestFlex"
 */
export const TEST_RULE_NAME = "ทดสอบระบบ (พิมพ์ test)";
export const TEST_TEMPLATE_NAME = "ข้อความทดสอบระบบ";
export const TEST_KEYWORDS = ["test", "ทดสอบ"];
export const TEST_REPLY =
  "✅ ระบบตอบกลับอัตโนมัติทำงานแล้ว!\nสวัสดีคุณ {{displayName}}\nได้รับข้อความของคุณเมื่อ {{datetime}}";

export const TEST_FLEX_RULE_NAME = "ทดสอบ Flex (พิมพ์ TestFlex)";
export const TEST_FLEX_TEMPLATE_NAME = "TestFlex";
export const TEST_FLEX_KEYWORDS = ["testflex", "test flex"];
export type TestRuleKey = "text" | "flex";
type RuleStatus = { id: string; isActive: boolean } | null;

export async function getTestRuleStatus(projectId: string): Promise<Record<TestRuleKey, RuleStatus>> {
  const rules = await prisma.replyRule.findMany({
    where: { projectId, name: { in: [TEST_RULE_NAME, TEST_FLEX_RULE_NAME] } },
    select: { id: true, name: true, isActive: true },
  });
  const pick = (name: string) => {
    const r = rules.find((x) => x.name === name);
    return r ? { id: r.id, isActive: r.isActive } : null;
  };
  return { text: pick(TEST_RULE_NAME), flex: pick(TEST_FLEX_RULE_NAME) };
}

async function upsertRule(params: {
  projectId: string;
  userId: string;
  name: string;
  description: string;
  keywords: string[];
  replyType: "TEXT" | "FLEX";
  textTemplateId: string | null;
  flexTemplateId: string | null;
}): Promise<{ created: boolean; ruleId: string }> {
  const keywords = params.keywords.map((k) => ({ keyword: k, normalizedKeyword: normalizeText(k) }));
  const data = {
    isActive: true,
    priority: 1000, // สูงสุด เพื่อให้ตอบด้วยกฎทดสอบเสมอ
    triggerType: "TEXT" as const,
    matchType: "EXACT" as const,
    keywordLogic: "ANY" as const,
    caseSensitive: false,
    replyType: params.replyType,
    textTemplateId: params.textTemplateId,
    flexTemplateId: params.flexTemplateId,
    updatedById: params.userId,
  };
  const existing = await prisma.replyRule.findFirst({ where: { projectId: params.projectId, name: params.name }, select: { id: true } });
  if (existing) {
    await prisma.$transaction([
      prisma.replyKeyword.deleteMany({ where: { ruleId: existing.id } }),
      prisma.replyRule.update({ where: { id: existing.id }, data: { ...data, keywords: { create: keywords } } }),
    ]);
    return { created: false, ruleId: existing.id };
  }
  const rule = await prisma.replyRule.create({
    data: { ...data, projectId: params.projectId, name: params.name, description: params.description, createdById: params.userId, keywords: { create: keywords } },
    select: { id: true },
  });
  return { created: true, ruleId: rule.id };
}

/** สร้างกฎทดสอบทั้ง 2 แบบ (หรือเปิดใช้งาน/ซ่อมกฎเดิม) — เรียกซ้ำได้โดยไม่สร้างซ้ำ */
export async function ensureTestRules(projectId: string, userId: string) {
  const textTemplate =
    (await prisma.replyTemplate.findFirst({ where: { projectId, name: TEST_TEMPLATE_NAME } })) ??
    (await prisma.replyTemplate.create({
      data: { projectId, name: TEST_TEMPLATE_NAME, content: TEST_REPLY, description: "ใช้กับกฎทดสอบระบบ", createdById: userId },
    }));

  // ใช้ Flex "TestFlex" เดิมถ้ายังถูกต้อง ไม่เช่นนั้นสร้าง/แก้ให้เป็นแบบมาตรฐาน
  const existingFlex = await prisma.flexTemplate.findFirst({ where: { projectId, name: TEST_FLEX_TEMPLATE_NAME } });
  const flexValid = existingFlex ? validateFlexMessage(existingFlex.altText, existingFlex.contents).valid : false;
  const flexTemplate =
    existingFlex && flexValid
      ? existingFlex
      : existingFlex
        ? await prisma.flexTemplate.update({
            where: { id: existingFlex.id },
            data: { altText: TEST_FLEX_ALT_TEXT, containerType: "bubble", contents: TEST_FLEX_CONTENTS as Prisma.InputJsonValue },
          })
        : await prisma.flexTemplate.create({
            data: {
              projectId,
              name: TEST_FLEX_TEMPLATE_NAME,
              description: "Flex Message สำหรับทดสอบระบบ (ตอบเมื่อพิมพ์ TestFlex)",
              altText: TEST_FLEX_ALT_TEXT,
              containerType: "bubble",
              contents: TEST_FLEX_CONTENTS as Prisma.InputJsonValue,
              createdById: userId,
            },
          });

  const text = await upsertRule({
    projectId,
    userId,
    name: TEST_RULE_NAME,
    description: "สร้างจากหน้า LINE OA Settings เพื่อทดสอบการเชื่อมต่อ — ลบหรือปิดได้เมื่อทดสอบเสร็จ",
    keywords: TEST_KEYWORDS,
    replyType: "TEXT",
    textTemplateId: textTemplate.id,
    flexTemplateId: null,
  });
  const flex = await upsertRule({
    projectId,
    userId,
    name: TEST_FLEX_RULE_NAME,
    description: "สร้างจากหน้า LINE OA Settings เพื่อทดสอบการตอบกลับด้วย Flex Message — ลบหรือปิดได้เมื่อทดสอบเสร็จ",
    keywords: TEST_FLEX_KEYWORDS,
    replyType: "FLEX",
    textTemplateId: null,
    flexTemplateId: flexTemplate.id,
  });
  invalidateRuleCache(projectId);
  return { text, flex };
}
