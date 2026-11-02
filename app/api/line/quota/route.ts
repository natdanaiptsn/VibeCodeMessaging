import { projectRoute } from "@/lib/api/handler";
import { getLineCredentials } from "@/services/line-account.service";
import { lineApi, describeLineError } from "@/services/line-messaging.service";

/** โควตาข้อความ Push ของเดือนนี้ */
export const GET = projectRoute({ permission: "line:view", rateLimitPerMinute: 20 }, async ({ project }) => {
  const creds = await getLineCredentials(project.id);
  if (!creds.channelAccessToken) return { available: false, error: creds.tokenError ?? "ยังไม่ได้ตั้งค่า" };
  try {
    const [quota, usage] = await Promise.all([
      lineApi.getQuota(creds.channelAccessToken),
      lineApi.getQuotaConsumption(creds.channelAccessToken),
    ]);
    return { available: true, type: quota.data.type, limit: quota.data.value ?? null, used: usage.data.totalUsage };
  } catch (err) {
    return { available: false, error: describeLineError(err) };
  }
});
