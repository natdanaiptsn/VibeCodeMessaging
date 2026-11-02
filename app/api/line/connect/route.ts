import { route, readJson } from "@/lib/api/handler";
import { lineCredentialsSchema } from "@/lib/validation/line";
import {
  getLineAccountPublic,
  getLineCredentials,
  markConnection,
  saveLineCredentials,
  webhookUrl,
} from "@/services/line-account.service";
import { lineApi, describeLineError } from "@/services/line-messaging.service";
import { auditFromCtx } from "@/lib/audit";

export const maxDuration = 60;

type StepStatus = "success" | "failed" | "warning" | "skipped";
type Step = { key: string; label: string; status: StepStatus; message: string; hint?: string };

/**
 * เชื่อมต่อ LINE OA ในคลิกเดียว:
 * บันทึก Credentials → ขอ Access token → ตรวจบัญชี LINE OA → ตั้ง Webhook URL → ให้ LINE ทดสอบส่ง Webhook → ตรวจว่าเปิด Webhook แล้ว
 */
export const POST = route({ permission: "line:manage", rateLimitPerMinute: 10 }, async (ctx) => {
  const input = lineCredentialsSchema.parse(await readJson(ctx.req, 8192));
  const steps: Step[] = [];
  const finish = async (extra: Record<string, unknown> = {}) => {
    const ok = steps.every((s) => s.status === "success" || s.status === "warning" || s.status === "skipped");
    await auditFromCtx(ctx)({
      action: "line.connect",
      entityType: "LineAccount",
      summary: `เชื่อมต่อ LINE OA — ${ok ? "สำเร็จ" : "ไม่สำเร็จ"}`,
      metadata: { steps: steps.map((s) => ({ key: s.key, status: s.status })) },
    });
    return { ok, steps, account: await getLineAccountPublic(), ...extra };
  };

  // 1) บันทึกค่าที่กรอก (เข้ารหัสก่อนเก็บ)
  const provided = Boolean(input.channelId || input.channelSecret || input.channelAccessToken);
  if (provided) {
    await saveLineCredentials({
      channelId: input.channelId || undefined,
      channelSecret: input.channelSecret || undefined,
      channelAccessToken: input.channelAccessToken || undefined,
    });
    steps.push({ key: "save", label: "บันทึกข้อมูล", status: "success", message: "บันทึก Channel ID / Channel secret แล้ว (เข้ารหัสก่อนจัดเก็บ)" });
  }

  // 2) Access token
  const creds = await getLineCredentials();
  if (!creds.channelSecret) {
    steps.push({ key: "token", label: "ขอสิทธิ์เข้าใช้ LINE", status: "failed", message: "ยังไม่ได้กรอก Channel secret", hint: "กรอก Channel secret ในขั้นตอนที่ 2" });
    return finish();
  }
  if (!creds.channelAccessToken) {
    await markConnection(creds.accountId, "FAILED", { error: creds.tokenError });
    steps.push({
      key: "token",
      label: "ขอสิทธิ์เข้าใช้ LINE",
      status: "failed",
      message: creds.tokenError ?? "ขอ Access token ไม่สำเร็จ",
      hint: "ตรวจว่า Channel ID และ Channel secret คัดลอกมาครบ ไม่มีช่องว่าง และมาจาก LINE OA บัญชีเดียวกัน",
    });
    return finish();
  }
  steps.push({
    key: "token",
    label: "ขอสิทธิ์เข้าใช้ LINE",
    status: "success",
    message: creds.tokenSource === "stateless" ? "ได้รับ Access token จาก LINE อัตโนมัติแล้ว" : "ใช้ Channel access token ที่กรอกไว้",
  });
  const token = creds.channelAccessToken;

  // 3) ตรวจบัญชี LINE OA
  try {
    const { data } = await lineApi.getBotInfo(token);
    await markConnection(creds.accountId, "CONNECTED", {
      botUserId: data.userId,
      basicId: data.basicId,
      displayName: data.displayName,
      pictureUrl: data.pictureUrl ?? null,
    });
    steps.push({ key: "bot", label: "ตรวจสอบบัญชี LINE OA", status: "success", message: `เชื่อมต่อกับ “${data.displayName}” (${data.basicId}) แล้ว` });
  } catch (err) {
    const message = describeLineError(err);
    await markConnection(creds.accountId, "FAILED", { error: message });
    steps.push({
      key: "bot",
      label: "ตรวจสอบบัญชี LINE OA",
      status: "failed",
      message,
      hint: "ถ้ากรอก Channel access token เอง ให้ตรวจว่ายังไม่หมดอายุ หรือลบ token ออกเพื่อให้ระบบขอให้อัตโนมัติ",
    });
    return finish();
  }

  // 4) ตั้ง Webhook URL ที่ LINE
  const url = webhookUrl();
  if (!url || !url.startsWith("https://")) {
    steps.push({
      key: "webhook-url",
      label: "ตั้งค่า Webhook URL",
      status: "failed",
      message: "ระบบยังไม่มี URL แบบ HTTPS ให้ LINE ส่งข้อความมา",
      hint: "ตั้งค่า APP_URL เป็นโดเมน https:// ของระบบ (บน Vercel ระบบใช้โดเมน .vercel.app ให้อัตโนมัติ)",
    });
    return finish();
  }
  try {
    await lineApi.setWebhookEndpoint(token, url);
    steps.push({ key: "webhook-url", label: "ตั้งค่า Webhook URL", status: "success", message: `ตั้ง Webhook URL เป็น ${url} แล้ว` });
  } catch (err) {
    steps.push({ key: "webhook-url", label: "ตั้งค่า Webhook URL", status: "failed", message: describeLineError(err) });
    return finish();
  }

  // 5) ให้ LINE ทดสอบส่ง Webhook มาที่ระบบ (ยืนยันว่า Channel secret ถูกต้อง)
  try {
    const { data } = await lineApi.testWebhookEndpoint(token);
    steps.push(
      data.success
        ? { key: "webhook-test", label: "ทดสอบรับข้อความจาก LINE", status: "success", message: "LINE ส่งข้อความทดสอบมาถึงระบบสำเร็จ" }
        : {
            key: "webhook-test",
            label: "ทดสอบรับข้อความจาก LINE",
            status: "failed",
            message: `LINE ส่งข้อความทดสอบไม่สำเร็จ (${data.statusCode} ${data.reason})`,
            hint:
              data.statusCode === 401
                ? "Channel secret ไม่ตรงกับ LINE OA นี้ — คัดลอก Channel secret ใหม่แล้วลองอีกครั้ง"
                : "ตรวจว่าระบบเปิดใช้งานได้จากอินเทอร์เน็ต และ URL ถูกต้อง",
          },
    );
  } catch (err) {
    steps.push({ key: "webhook-test", label: "ทดสอบรับข้อความจาก LINE", status: "warning", message: `ทดสอบไม่ได้: ${describeLineError(err)}` });
  }

  // 6) ตรวจว่าเปิด "ใช้ Webhook" แล้วหรือยัง (ต้องเปิดเองใน LINE OA Manager)
  let webhookActive: boolean | null = null;
  try {
    const { data } = await lineApi.getWebhookEndpoint(token);
    webhookActive = data.active;
    steps.push(
      data.active
        ? { key: "webhook-active", label: "เปิดใช้งาน Webhook", status: "success", message: "Webhook เปิดใช้งานอยู่แล้ว" }
        : {
            key: "webhook-active",
            label: "เปิดใช้งาน Webhook",
            status: "warning",
            message: "Webhook ยังปิดอยู่ — LINE จะยังไม่ส่งข้อความลูกค้ามาที่ระบบ",
            hint: "ทำตามขั้นตอนที่ 4 เพื่อเปิด Webhook ใน LINE Official Account Manager",
          },
    );
  } catch (err) {
    steps.push({ key: "webhook-active", label: "เปิดใช้งาน Webhook", status: "warning", message: `ตรวจสอบไม่ได้: ${describeLineError(err)}` });
  }

  return finish({ webhookActive });
});
