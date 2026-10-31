import { z } from "zod";
import { route, readJson } from "@/lib/api/handler";
import { validateFlexMessage } from "@/lib/flex/validate";
import { renderFlexVariables } from "@/lib/flex/render";
import { sampleTemplateValues } from "@/lib/templates/variables";
import { getLineCredentials } from "@/services/line-account.service";
import { lineApi, LineApiError } from "@/services/line-messaging.service";

const schema = z.object({
  altText: z.string().max(1000),
  contents: z.unknown(),
  remote: z.boolean().default(false),
});

/** ตรวจสอบ Flex Message ในระบบ และ (ถ้าเลือก) ตรวจสอบกับ LINE API โดยไม่ส่งข้อความจริง */
export const POST = route({ permission: "flex:manage", rateLimitPerMinute: 30 }, async ({ req }) => {
  const input = schema.parse(await readJson(req, 256 * 1024));
  const local = validateFlexMessage(input.altText, input.contents);
  let remote: { checked: boolean; ok: boolean; message?: string; details?: unknown } = { checked: false, ok: false };
  if (input.remote && local.valid) {
    const creds = await getLineCredentials();
    if (!creds.channelAccessToken) {
      remote = { checked: false, ok: false, message: "ยังไม่ได้ตั้งค่า Channel Access Token จึงตรวจสอบกับ LINE ไม่ได้" };
    } else {
      const values = sampleTemplateValues();
      const contents = renderFlexVariables(input.contents, values) as Record<string, unknown>;
      try {
        await lineApi.validateReply(creds.channelAccessToken, [{ type: "flex", altText: input.altText, contents }]);
        remote = { checked: true, ok: true, message: "LINE API ยืนยันว่า Flex Message ถูกต้อง" };
      } catch (err) {
        remote =
          err instanceof LineApiError
            ? { checked: true, ok: false, message: err.message, details: err.details }
            : { checked: false, ok: false, message: (err as Error).message };
      }
    }
  }
  return { local, remote };
});
