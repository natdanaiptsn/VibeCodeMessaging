import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/auto-reply/normalize";
import { invalidateRuleCache } from "@/services/auto-reply-engine.service";

/** กฎสำหรับทดสอบการเชื่อมต่อ: ลูกค้าพิมพ์ "test" หรือ "ทดสอบ" แล้วได้รับคำตอบ */
export const TEST_RULE_NAME = "ทดสอบระบบ (พิมพ์ test)";
export const TEST_TEMPLATE_NAME = "ข้อความทดสอบระบบ";
export const TEST_KEYWORDS = ["test", "ทดสอบ"];
export const TEST_REPLY =
  "✅ ระบบตอบกลับอัตโนมัติทำงานแล้ว!\nสวัสดีคุณ {{displayName}}\nได้รับข้อความของคุณเมื่อ {{datetime}}";

export async function getTestRuleStatus() {
  const rule = await prisma.replyRule.findFirst({
    where: { name: TEST_RULE_NAME },
    select: { id: true, isActive: true },
  });
  return rule;
}

/** สร้างกฎทดสอบ (หรือเปิดใช้งาน/ซ่อมกฎเดิม) — เรียกซ้ำได้โดยไม่สร้างซ้ำ */
export async function ensureTestRule(userId: string): Promise<{ created: boolean; ruleId: string }> {
  const template =
    (await prisma.replyTemplate.findFirst({ where: { name: TEST_TEMPLATE_NAME } })) ??
    (await prisma.replyTemplate.create({
      data: { name: TEST_TEMPLATE_NAME, content: TEST_REPLY, description: "ใช้กับกฎทดสอบระบบ", createdById: userId },
    }));
  const keywords = TEST_KEYWORDS.map((k) => ({ keyword: k, normalizedKeyword: normalizeText(k) }));
  const existing = await prisma.replyRule.findFirst({ where: { name: TEST_RULE_NAME }, select: { id: true } });

  const ruleData = {
    isActive: true,
    priority: 1000, // สูงสุด เพื่อให้ตอบด้วยกฎนี้เสมอเมื่อพิมพ์ test
    triggerType: "TEXT" as const,
    matchType: "EXACT" as const,
    keywordLogic: "ANY" as const,
    caseSensitive: false,
    replyType: "TEXT" as const,
    textTemplateId: template.id,
    flexTemplateId: null,
    updatedById: userId,
  };

  let ruleId: string;
  if (existing) {
    await prisma.$transaction([
      prisma.replyKeyword.deleteMany({ where: { ruleId: existing.id } }),
      prisma.replyRule.update({ where: { id: existing.id }, data: { ...ruleData, keywords: { create: keywords } } }),
    ]);
    ruleId = existing.id;
  } else {
    const rule = await prisma.replyRule.create({
      data: {
        ...ruleData,
        name: TEST_RULE_NAME,
        description: "สร้างจากหน้า LINE OA Settings เพื่อทดสอบการเชื่อมต่อ — ลบหรือปิดได้เมื่อทดสอบเสร็จ",
        createdById: userId,
        keywords: { create: keywords },
      },
      select: { id: true },
    });
    ruleId = rule.id;
  }
  invalidateRuleCache();
  return { created: !existing, ruleId };
}
