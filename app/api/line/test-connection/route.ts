import { route } from "@/lib/api/handler";
import { getLineCredentials, markConnection, getLineAccountPublic } from "@/services/line-account.service";
import { lineApi, describeLineError } from "@/services/line-messaging.service";
import { auditFromCtx } from "@/lib/audit";

/** ทดสอบการเชื่อมต่อด้วยการเรียก Get Bot Info */
export const POST = route({ permission: "line:view", rateLimitPerMinute: 10 }, async (ctx) => {
  const creds = await getLineCredentials();
  if (!creds.channelAccessToken) {
    await markConnection(creds.accountId, "FAILED", { error: "ยังไม่ได้ตั้งค่า Channel Access Token" });
    return { ok: false, message: "ยังไม่ได้ตั้งค่า Channel Access Token", account: await getLineAccountPublic() };
  }
  try {
    const { data } = await lineApi.getBotInfo(creds.channelAccessToken);
    await markConnection(creds.accountId, "CONNECTED", {
      botUserId: data.userId,
      basicId: data.basicId,
      displayName: data.displayName,
      pictureUrl: data.pictureUrl ?? null,
    });
    await auditFromCtx(ctx)({ action: "line.test_connection", entityType: "LineAccount", summary: "เชื่อมต่อสำเร็จ" });
    return {
      ok: true,
      message: `เชื่อมต่อสำเร็จกับ ${data.displayName} (${data.basicId})`,
      bot: { displayName: data.displayName, basicId: data.basicId, pictureUrl: data.pictureUrl, chatMode: data.chatMode },
      warnings: [
        ...(creds.channelSecret ? [] : ["ยังไม่ได้ตั้งค่า Channel Secret — ระบบจะไม่สามารถตรวจสอบ Webhook Signature ได้"]),
        ...(data.chatMode === "chat" ? ["บัญชีอยู่ในโหมด Chat — แนะนำให้เปิดโหมด Bot/Webhook ใน LINE Official Account Manager"] : []),
      ],
      account: await getLineAccountPublic(),
    };
  } catch (err) {
    const message = describeLineError(err);
    await markConnection(creds.accountId, "FAILED", { error: message });
    return { ok: false, message: `เชื่อมต่อไม่สำเร็จ: ${message}`, account: await getLineAccountPublic() };
  }
});
