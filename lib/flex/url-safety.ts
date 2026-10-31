/**
 * ตรวจสอบ URL ที่ใช้ใน Flex Message เพื่อป้องกัน URL อันตราย
 * - action uri: อนุญาต https:, line:, tel: เท่านั้น
 * - รูปภาพ/ไอคอน/วิดีโอ: ต้องเป็น https: เท่านั้น
 * - ห้าม credentials ใน URL, ห้าม localhost / private network
 */
export type UrlCheck = { ok: true } | { ok: false; reason: string };

const ACTION_SCHEMES = new Set(["https:", "line:", "tel:"]);

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return true;
    if (/^fe[89ab][0-9a-f]:/.test(host)) return true;
    if (host.startsWith("::ffff:")) return true;
  }
  return false;
}

function checkHttps(url: URL): UrlCheck {
  if (url.username || url.password) return { ok: false, reason: "ห้ามใส่ชื่อผู้ใช้/รหัสผ่านใน URL" };
  if (!url.hostname || !url.hostname.includes(".")) return { ok: false, reason: "โดเมนไม่ถูกต้อง" };
  if (isPrivateHost(url.hostname)) return { ok: false, reason: "ไม่อนุญาต URL ภายในเครือข่าย (localhost/private IP)" };
  return { ok: true };
}

export function checkActionUri(raw: string, maxLength = 1000): UrlCheck {
  if (!raw || typeof raw !== "string") return { ok: false, reason: "ต้องระบุ URL" };
  if (raw.length > maxLength) return { ok: false, reason: `URL ยาวเกิน ${maxLength} ตัวอักษร` };
  if (/[\u0000-\u001F\u007F\s]/.test(raw)) return { ok: false, reason: "URL มีอักขระที่ไม่อนุญาต (ช่องว่าง/อักขระควบคุม)" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "รูปแบบ URL ไม่ถูกต้อง" };
  }
  const scheme = url.protocol.toLowerCase();
  if (!ACTION_SCHEMES.has(scheme)) {
    return { ok: false, reason: `ไม่อนุญาต scheme "${scheme}" (อนุญาตเฉพาะ https:, line:, tel:)` };
  }
  if (scheme === "https:") return checkHttps(url);
  if (scheme === "tel:" && !/^tel:\+?[0-9\-()#*,;]{3,30}$/i.test(raw)) {
    return { ok: false, reason: "หมายเลขโทรศัพท์ไม่ถูกต้อง" };
  }
  return { ok: true };
}

export function checkMediaUrl(raw: string, maxLength = 2000): UrlCheck {
  if (!raw || typeof raw !== "string") return { ok: false, reason: "ต้องระบุ URL รูปภาพ" };
  if (raw.length > maxLength) return { ok: false, reason: `URL ยาวเกิน ${maxLength} ตัวอักษร` };
  if (/[\u0000-\u001F\u007F\s]/.test(raw)) return { ok: false, reason: "URL มีอักขระที่ไม่อนุญาต" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "รูปแบบ URL ไม่ถูกต้อง" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "URL รูปภาพต้องขึ้นต้นด้วย https://" };
  return checkHttps(url);
}
