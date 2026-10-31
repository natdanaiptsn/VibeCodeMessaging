/** Flex Message ตัวอย่างสำหรับเริ่มต้น (ใช้ใน Builder และ Seed) */
const IMG = "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png";

export type FlexPreset = { key: string; name: string; description: string; altText: string; contents: Record<string, unknown> };

export const FLEX_PRESETS: FlexPreset[] = [
  {
    key: "register",
    name: "สมัครสมาชิก",
    description: "การ์ดเชิญชวนสมัครสมาชิกพร้อมปุ่มลิงก์",
    altText: "สมัครสมาชิกกับเรา รับสิทธิพิเศษมากมาย",
    contents: {
      type: "bubble",
      size: "mega",
      hero: { type: "image", url: IMG, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "สมัครสมาชิก", weight: "bold", size: "xl", color: "#111111" },
          { type: "text", text: "สวัสดีคุณ {{displayName}} สมัครสมาชิกวันนี้ รับส่วนลด 10% สำหรับการสั่งซื้อครั้งแรก", wrap: true, size: "sm", color: "#666666" },
          {
            type: "box",
            layout: "baseline",
            spacing: "sm",
            margin: "md",
            contents: [
              { type: "text", text: "สิทธิพิเศษ", size: "sm", color: "#aaaaaa", flex: 2 },
              { type: "text", text: "สะสมแต้มทุกการซื้อ", size: "sm", color: "#111111", flex: 5, wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#06C755", height: "sm", action: { type: "uri", label: "สมัครสมาชิก", uri: "https://example.com/register" } },
          { type: "button", style: "link", height: "sm", action: { type: "message", label: "สอบถามเพิ่มเติม", text: "ติดต่อเจ้าหน้าที่" } },
        ],
      },
    },
  },
  {
    key: "contact",
    name: "ติดต่อเรา",
    description: "ข้อมูลติดต่อพร้อมปุ่มโทรและแผนที่",
    altText: "ช่องทางการติดต่อ",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#06C755",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "ติดต่อเรา", color: "#FFFFFF", weight: "bold", size: "lg" },
          { type: "text", text: "ยินดีให้บริการทุกวัน 09:00 - 18:00", color: "#E9F9EF", size: "xs" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "md",
            contents: [
              { type: "text", text: "โทร", size: "sm", color: "#888888", flex: 1 },
              { type: "text", text: "02-123-4567", size: "sm", color: "#111111", flex: 3 },
            ],
          },
          {
            type: "box",
            layout: "horizontal",
            spacing: "md",
            contents: [
              { type: "text", text: "อีเมล", size: "sm", color: "#888888", flex: 1 },
              { type: "text", text: "support@example.com", size: "sm", color: "#111111", flex: 3, wrap: true },
            ],
          },
          { type: "separator", margin: "md" },
          { type: "text", text: "ขอบคุณที่ติดต่อเรา คุณ {{displayName}}", size: "xs", color: "#888888", wrap: true, margin: "md" },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#06C755", height: "sm", action: { type: "uri", label: "โทรหาเรา", uri: "tel:021234567" } },
          { type: "button", style: "secondary", height: "sm", action: { type: "uri", label: "แผนที่", uri: "https://maps.google.com" } },
        ],
      },
    },
  },
  {
    key: "promotion",
    name: "โปรโมชัน",
    description: "การ์ดโปรโมชันพร้อม Postback",
    altText: "โปรโมชันพิเศษสำหรับคุณ",
    contents: {
      type: "bubble",
      hero: { type: "image", url: IMG, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: "ลด 20% ทั้งร้าน", weight: "bold", size: "xxl", color: "#E34948" },
          { type: "text", text: "เฉพาะสมาชิก LINE วันนี้ - สิ้นเดือน", size: "sm", color: "#666666", wrap: true },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "button", style: "primary", color: "#E34948", action: { type: "postback", label: "รับคูปอง", data: "action=coupon&id=PROMO20", displayText: "รับคูปอง" } },
        ],
      },
    },
  },
  {
    key: "carousel",
    name: "Carousel สินค้า",
    description: "หลายการ์ดเลื่อนดูได้",
    altText: "สินค้าแนะนำ",
    contents: {
      type: "carousel",
      contents: [1, 2, 3].map((i) => ({
        type: "bubble",
        size: "micro",
        hero: { type: "image", url: IMG, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          paddingAll: "13px",
          contents: [
            { type: "text", text: `สินค้า ${i}`, weight: "bold", size: "sm" },
            { type: "text", text: `฿${(i * 199).toLocaleString("en-US")}`, size: "sm", color: "#06C755", weight: "bold" },
          ],
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "button", style: "link", height: "sm", action: { type: "message", label: "สนใจ", text: `สนใจสินค้า ${i}` } }],
        },
      })),
    },
  },
];
