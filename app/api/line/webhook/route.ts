import { route, readJson } from "@/lib/api/handler";
import { badRequest } from "@/lib/errors";
import { webhookEndpointSchema } from "@/lib/validation/line";
import { getLineCredentials, webhookUrl } from "@/services/line-account.service";
import { lineApi, describeLineError } from "@/services/line-messaging.service";
import { auditFromCtx } from "@/lib/audit";

/** อ่าน Webhook URL ที่ตั้งไว้ใน LINE Platform */
export const GET = route({ permission: "line:view", rateLimitPerMinute: 20 }, async () => {
  const creds = await getLineCredentials();
  const expected = webhookUrl();
  if (!creds.channelAccessToken) return { expected, configured: null, active: false, error: "ยังไม่ได้ตั้งค่า Channel Access Token" };
  try {
    const { data } = await lineApi.getWebhookEndpoint(creds.channelAccessToken);
    return { expected, configured: data.endpoint, active: data.active, matches: data.endpoint === expected, error: null };
  } catch (err) {
    return { expected, configured: null, active: false, error: describeLineError(err) };
  }
});

/** ตั้งค่า Webhook URL ไปยัง LINE Platform */
export const PUT = route({ permission: "line:manage", rateLimitPerMinute: 10 }, async (ctx) => {
  const { endpoint } = webhookEndpointSchema.parse(await readJson(ctx.req, 4096));
  const creds = await getLineCredentials();
  if (!creds.channelAccessToken) throw badRequest("ยังไม่ได้ตั้งค่า Channel Access Token");
  try {
    await lineApi.setWebhookEndpoint(creds.channelAccessToken, endpoint);
  } catch (err) {
    throw badRequest(`ตั้งค่า Webhook URL ไม่สำเร็จ: ${describeLineError(err)}`);
  }
  await auditFromCtx(ctx)({ action: "line.webhook_set", entityType: "LineAccount", summary: `ตั้งค่า Webhook URL: ${endpoint}` });
  return { ok: true, endpoint };
});
