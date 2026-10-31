/** ชนิดข้อมูล Webhook Event ของ LINE (เฉพาะที่ระบบใช้งาน) */
export type LineSource =
  | { type: "user"; userId: string }
  | { type: "group"; groupId: string; userId?: string }
  | { type: "room"; roomId: string; userId?: string };

export type LineDeliveryContext = { isRedelivery: boolean };

type BaseEvent = {
  type: string;
  mode: "active" | "standby";
  timestamp: number;
  source?: LineSource;
  webhookEventId: string;
  deliveryContext: LineDeliveryContext;
  replyToken?: string;
};

export type LineTextMessage = {
  id: string;
  type: "text";
  text: string;
  quoteToken?: string;
  emojis?: unknown[];
  mention?: unknown;
};
export type LineImageMessage = {
  id: string;
  type: "image";
  contentProvider: { type: "line" | "external"; originalContentUrl?: string; previewImageUrl?: string };
  imageSet?: { id: string; index: number; total: number };
  quoteToken?: string;
};
export type LineStickerMessage = {
  id: string;
  type: "sticker";
  packageId: string;
  stickerId: string;
  stickerResourceType?: string;
  keywords?: string[];
  text?: string;
  quoteToken?: string;
};
export type LineLocationMessage = {
  id: string;
  type: "location";
  title?: string;
  address?: string;
  latitude: number;
  longitude: number;
};
export type LineMediaMessage = {
  id: string;
  type: "video" | "audio" | "file";
  duration?: number;
  fileName?: string;
  fileSize?: number;
  contentProvider?: { type: "line" | "external" };
};

export type LineMessageContent =
  | LineTextMessage
  | LineImageMessage
  | LineStickerMessage
  | LineLocationMessage
  | LineMediaMessage
  | { id: string; type: string; [key: string]: unknown };

export type LineMessageEvent = BaseEvent & { type: "message"; message: LineMessageContent };
export type LinePostbackEvent = BaseEvent & {
  type: "postback";
  postback: { data: string; params?: Record<string, unknown> };
};
export type LineFollowEvent = BaseEvent & { type: "follow"; follow?: { isUnblocked: boolean } };
export type LineUnfollowEvent = BaseEvent & { type: "unfollow" };
export type LineOtherEvent = BaseEvent & { [key: string]: unknown };

export type LineWebhookEvent =
  | LineMessageEvent
  | LinePostbackEvent
  | LineFollowEvent
  | LineUnfollowEvent
  | LineOtherEvent;

export type LineWebhookBody = { destination: string; events: LineWebhookEvent[] };

/** Message Object สำหรับส่งออก */
export type LineOutgoingText = { type: "text"; text: string };
export type LineOutgoingFlex = { type: "flex"; altText: string; contents: Record<string, unknown> };
export type LineOutgoingMessage = LineOutgoingText | LineOutgoingFlex;
