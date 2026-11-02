import { projectRoute, readJson } from "@/lib/api/handler";
import { ruleTestSchema } from "@/lib/validation/rules";
import { getSettings } from "@/services/settings.service";
import { resolveAutoReply } from "@/services/auto-reply-engine.service";

/** ทดสอบว่าข้อความจะตรงกับกฎใด และจะตอบกลับอะไร (ไม่ส่งข้อความจริง) */
export const POST = projectRoute({ permission: "rules:view", rateLimitPerMinute: 60 }, async ({ req, session, project }) => {
  const input = ruleTestSchema.parse(await readJson(req));
  const settings = await getSettings(project.id);
  const result = await resolveAutoReply(
    {
      projectId: project.id,
      trigger: input.triggerType,
      text: input.text,
      customer: { id: "00000000-0000-0000-0000-000000000000", displayName: session.user.name, lineUserId: "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
    },
    { ...settings, general: { ...settings.general, autoReplyEnabled: true } },
  );
  return { ...result, autoReplyEnabled: settings.general.autoReplyEnabled, multiRuleMode: settings.general.multiRuleMode };
});
