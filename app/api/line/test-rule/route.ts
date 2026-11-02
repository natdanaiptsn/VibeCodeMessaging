import { route } from "@/lib/api/handler";
import { auditFromCtx } from "@/lib/audit";
import { getSettings } from "@/services/settings.service";
import {
  ensureTestRule,
  getTestRuleStatus,
  TEST_KEYWORDS,
  TEST_REPLY,
  TEST_RULE_NAME,
} from "@/services/test-rule.service";

async function status() {
  const [rule, settings] = await Promise.all([getTestRuleStatus(), getSettings()]);
  return {
    rule,
    ruleName: TEST_RULE_NAME,
    keywords: TEST_KEYWORDS,
    reply: TEST_REPLY,
    autoReplyEnabled: settings.general.autoReplyEnabled,
  };
}

/** สถานะกฎทดสอบ (ใช้ในขั้นตอนที่ 5 ของหน้า LINE OA Settings) */
export const GET = route({ permission: "line:view" }, async () => status());

/** สร้าง/เปิดใช้งานกฎทดสอบ “พิมพ์ test แล้วได้รับคำตอบ” */
export const POST = route({ permission: "rules:manage", rateLimitPerMinute: 10 }, async (ctx) => {
  const result = await ensureTestRule(ctx.session.user.id);
  await auditFromCtx(ctx)({
    action: result.created ? "rule.create" : "rule.update",
    entityType: "ReplyRule",
    entityId: result.ruleId,
    summary: `${result.created ? "สร้าง" : "เปิดใช้งาน"}กฎ "${TEST_RULE_NAME}" จากหน้า LINE OA Settings`,
  });
  return { ...result, ...(await status()) };
});
