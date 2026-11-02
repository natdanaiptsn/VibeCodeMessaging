import { projectRoute } from "@/lib/api/handler";
import { getLineCredentials, requireAccessToken } from "@/services/line-account.service";
import { lineApi, describeLineError } from "@/services/line-messaging.service";

/** ให้ LINE Platform ทดสอบส่ง Webhook มายัง URL ที่ตั้งค่าไว้ */
export const POST = projectRoute({ permission: "line:view", rateLimitPerMinute: 10 }, async ({ project }) => {
  const creds = await getLineCredentials(project.id);
  const token = requireAccessToken(creds);
  try {
    const { data } = await lineApi.testWebhookEndpoint(token);
    return {
      ok: data.success,
      statusCode: data.statusCode,
      reason: data.reason,
      detail: data.detail,
      message: data.success ? "LINE ส่ง Webhook ทดสอบสำเร็จ" : `ทดสอบไม่สำเร็จ: ${data.reason} ${data.detail ?? ""}`,
    };
  } catch (err) {
    return { ok: false, message: `ทดสอบไม่สำเร็จ: ${describeLineError(err)}` };
  }
});
