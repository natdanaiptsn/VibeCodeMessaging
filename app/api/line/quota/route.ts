import { route } from "@/lib/api/handler";
import { getLineCredentials } from "@/services/line-account.service";
import { lineApi, describeLineError } from "@/services/line-messaging.service";

/** โควตาข้อความ Push ของเดือนนี้ */
export const GET = route({ permission: "line:view", rateLimitPerMinute: 20 }, async () => {
  const creds = await getLineCredentials();
  if (!creds.channelAccessToken) return { available: false, error: "ยังไม่ได้ตั้งค่า Channel Access Token" };
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
