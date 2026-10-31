/** ตรวจสอบสภาพแวดล้อมที่รันอยู่ */

/** รันบน Vercel (Serverless) — ไม่มี process ที่รันค้างไว้ จึงใช้ Background Worker แบบวนลูปไม่ได้ */
export function isServerless(): boolean {
  return process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}
