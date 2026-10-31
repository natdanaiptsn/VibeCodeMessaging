/** ป้ายกำกับภาษาไทยสำหรับค่า enum */
export const MESSAGE_TYPE_LABELS: Record<string, string> = {
  TEXT: "ข้อความ",
  IMAGE: "รูปภาพ",
  VIDEO: "วิดีโอ",
  AUDIO: "เสียง",
  FILE: "ไฟล์",
  STICKER: "สติกเกอร์",
  LOCATION: "ตำแหน่ง",
  POSTBACK: "Postback",
  FOLLOW: "เพิ่มเพื่อน",
  UNFOLLOW: "เลิกติดตาม",
  FLEX: "Flex Message",
  OTHER: "อื่น ๆ",
};

export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  PENDING: "รอประมวลผล",
  PROCESSING: "กำลังประมวลผล",
  REPLIED: "ตอบกลับแล้ว",
  NO_REPLY: "ไม่มีการตอบกลับ",
  SENT: "ส่งแล้ว",
  FAILED: "ไม่สำเร็จ",
};

export const REPLY_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SUCCESS: "Success",
  FAILED: "Failed",
};

export const REPLY_SOURCE_LABELS: Record<string, string> = {
  RULE: "กฎตอบกลับ",
  DEFAULT: "Default Reply",
  ADMIN: "ส่งโดยแอดมิน",
  RETRY: "ส่งซ้ำ",
};

export const REPLY_TYPE_LABELS: Record<string, string> = {
  TEXT: "Text Message",
  FLEX: "Flex Message",
  MIXED: "Text + Flex",
};

export const TRIGGER_LABELS: Record<string, string> = {
  TEXT: "ข้อความตัวอักษร",
  POSTBACK: "Postback",
  FOLLOW: "เพิ่มเพื่อน / ปลดบล็อก",
  IMAGE: "ส่งรูปภาพ",
  STICKER: "ส่งสติกเกอร์",
  LOCATION: "ส่งตำแหน่ง",
};

export const MATCH_TYPE_LABELS: Record<string, string> = {
  EXACT: "ตรงทั้งหมด (Exact Match)",
  CONTAINS: "มีคำนี้อยู่ (Contains)",
  STARTS_WITH: "ขึ้นต้นด้วย (Starts With)",
  ENDS_WITH: "ลงท้ายด้วย (Ends With)",
  REGEX: "Regular Expression",
};

export const MATCH_TYPE_SHORT: Record<string, string> = {
  EXACT: "Exact",
  CONTAINS: "Contains",
  STARTS_WITH: "Starts With",
  ENDS_WITH: "Ends With",
  REGEX: "Regex",
};
