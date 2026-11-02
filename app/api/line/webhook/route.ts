import { projectRoute, readJson } from "@/lib/api/handler";
import { badRequest } from "@/lib/errors";
import { webhookEndpointSchema } from "@/lib/validation/line";
import { getLineCredentials, legacyWebhookUrl, requireAccessToken, webhookUrl } from "@/services/line-account.service";
import { lineApi, describeLineError } from "@/services/line-messaging.service";
import { auditFromCtx } from "@/lib/audit";

/** อ่าน Webhook URL ที่ตั้งไว้ใน LINE Platform */
export const GET = projectRoute({ permission: "line:view", rateLimitPerMinute: 20 }, async ({ project }) => {
  const creds = await getLineCredentials(project.id);
  const expected = webhookUrl(project.id);
  // โปรเจกต์หลักยังรับข้อความจาก URL เดิมได้ จึงถือว่าตรงกันด้วย
  const accepted = [expected, project.isDefault ? legacyWebhookUrl() : null].filter(Boolean);
  if (!creds.channelAccessToken) return { expected, configured: null, active: false, error: creds.tokenError ?? "ยังไม่ได้ตั้งค่า" };
  try {
    const { data } = await lineApi.getWebhookEndpoint(creds.channelAccessToken);
    return { expected, configured: data.endpoint, active: data.active, matches: accepted.includes(data.endpoint), error: null };
  } catch (err) {
    return { expected, configured: null, active: false, error: describeLineError(err) };
  }
});

/** ตั้งค่า Webhook URL ไปยัง LINE Platform */
export const PUT = projectRoute({ permission: "line:manage", rateLimitPerMinute: 10 }, async (ctx) => {
  const { endpoint } = webhookEndpointSchema.parse(await readJson(ctx.req, 4096));
  const creds = await getLineCredentials(ctx.project.id);
  const token = requireAccessToken(creds);
  try {
    await lineApi.setWebhookEndpoint(token, endpoint);
  } catch (err) {
    throw badRequest(`ตั้งค่า Webhook URL ไม่สำเร็จ: ${describeLineError(err)}`);
  }
  await auditFromCtx(ctx)({ action: "line.webhook_set", entityType: "Project", summary: `ตั้งค่า Webhook URL: ${endpoint}` });
  return { ok: true, endpoint };
});
