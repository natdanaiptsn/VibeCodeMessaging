/** ฟังก์ชันจัดรูปแบบการแสดงผล (ภาษาไทย) */
const DEFAULT_TZ = "Asia/Bangkok";

export function formatDateTime(value: string | Date | null | undefined, timeZone = DEFAULT_TZ): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone }).format(d);
}

export function formatDate(value: string | Date | null | undefined, timeZone = DEFAULT_TZ): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone }).format(d);
}

export function formatTime(value: string | Date | null | undefined, timeZone = DEFAULT_TZ): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(d);
}

export function formatRelative(value: string | Date | null | undefined, timeZone = DEFAULT_TZ): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "เมื่อสักครู่";
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return formatDate(d, timeZone);
}

export function formatNumber(n: number | null | undefined): string {
  return new Intl.NumberFormat("th-TH").format(n ?? 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** วันที่วันนี้ในรูปแบบ YYYY-MM-DD ตาม timezone */
export function todayString(timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
