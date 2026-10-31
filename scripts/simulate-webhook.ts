/**
 * ส่ง Webhook จำลอง (ลงลายเซ็นด้วย Channel Secret) ไปยังระบบ — สำหรับทดสอบในเครื่อง
 * ใช้งาน: npx tsx scripts/simulate-webhook.ts --text "ราคา" [--url http://localhost:3000] [--user Uxxxx] [--type text|follow|postback|sticker]
 * ต้องกำหนด LINE_CHANNEL_SECRET (หรือ --secret) ให้ตรงกับค่าที่ระบบใช้
 * หมายเหตุ: Reply Token จำลองจะถูก LINE ปฏิเสธ (Invalid reply token) — ใช้ตรวจสอบการรับ/บันทึก/จับคู่กฎ
 */
import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    secret: { type: "string" },
    user: { type: "string", default: "U00000000000000000000000000000000" },
    type: { type: "string", default: "text" },
    text: { type: "string", default: "สวัสดี" },
    data: { type: "string", default: "action=coupon" },
  },
});

const secret = values.secret ?? process.env.LINE_CHANNEL_SECRET;
if (!secret) {
  console.error("กรุณากำหนด --secret หรือ LINE_CHANNEL_SECRET");
  process.exit(1);
}

const base = {
  mode: "active",
  timestamp: Date.now(),
  source: { type: "user", userId: values.user },
  webhookEventId: randomUUID().replace(/-/g, "").toUpperCase().slice(0, 26),
  deliveryContext: { isRedelivery: false },
  replyToken: randomUUID().replace(/-/g, ""),
};

const event =
  values.type === "follow"
    ? { ...base, type: "follow", follow: { isUnblocked: false } }
    : values.type === "postback"
      ? { ...base, type: "postback", postback: { data: values.data } }
      : values.type === "sticker"
        ? { ...base, type: "message", message: { id: String(Date.now()), type: "sticker", packageId: "446", stickerId: "1988" } }
        : { ...base, type: "message", message: { id: String(Date.now()), type: "text", text: values.text, quoteToken: "q" } };

const body = JSON.stringify({ destination: "Usimulator", events: [event] });
const signature = createHmac("sha256", secret).update(body).digest("base64");

const res = await fetch(`${values.url!.replace(/\/$/, "")}/api/webhook/line`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Line-Signature": signature },
  body,
});
console.log(res.status, await res.text());
