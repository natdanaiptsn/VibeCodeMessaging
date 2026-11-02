import { projectRoute } from "@/lib/api/handler";
import { auditFromCtx } from "@/lib/audit";
import { getSettings } from "@/services/settings.service";
import {
  ensureTestRules,
  getTestRuleStatus,
  TEST_FLEX_ALT_TEXT,
  TEST_FLEX_CONTENTS,
  TEST_FLEX_KEYWORDS,
  TEST_FLEX_RULE_NAME,
  TEST_KEYWORDS,
  TEST_REPLY,
  TEST_RULE_NAME,
} from "@/services/test-rule.service";

async function status(projectId: string) {
  const [rules, settings] = await Promise.all([getTestRuleStatus(projectId), getSettings(projectId)]);
  return {
    rules,
    text: { ruleName: TEST_RULE_NAME, keywords: TEST_KEYWORDS, reply: TEST_REPLY },
    flex: { ruleName: TEST_FLEX_RULE_NAME, keywords: TEST_FLEX_KEYWORDS, altText: TEST_FLEX_ALT_TEXT, contents: TEST_FLEX_CONTENTS },
    autoReplyEnabled: settings.general.autoReplyEnabled,
  };
}

/** สถานะกฎทดสอบ (ใช้ในขั้นตอนที่ 5 ของหน้า LINE OA Settings) */
export const GET = projectRoute({ permission: "line:view" }, async ({ project }) => status(project.id));

/** สร้าง/เปิดใช้งานกฎทดสอบ “test” (Text) และ “TestFlex” (Flex Message) */
export const POST = projectRoute({ permission: "rules:manage", rateLimitPerMinute: 10 }, async (ctx) => {
  const result = await ensureTestRules(ctx.project.id, ctx.session.user.id);
  const audit = auditFromCtx(ctx);
  for (const [r, name] of [
    [result.text, TEST_RULE_NAME],
    [result.flex, TEST_FLEX_RULE_NAME],
  ] as const) {
    await audit({
      action: r.created ? "rule.create" : "rule.update",
      entityType: "ReplyRule",
      entityId: r.ruleId,
      summary: `${r.created ? "สร้าง" : "เปิดใช้งาน"}กฎ "${name}" จากหน้า LINE OA Settings`,
    });
  }
  return { created: result.text.created || result.flex.created, ...(await status(ctx.project.id)) };
});
