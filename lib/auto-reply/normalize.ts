/** ปรับข้อความให้อยู่ในรูปแบบมาตรฐานก่อนจับคู่ Keyword */
export function normalizeText(input: string, caseSensitive = false): string {
  let s = input
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!caseSensitive) s = s.toLowerCase();
  return s;
}
