/**
 * เริ่ม Background Worker สำหรับประมวลผล Webhook Event เมื่อ server เริ่มทำงาน
 * (ทำงานเฉพาะ Node.js runtime และสามารถปิดได้ด้วย QUEUE_WORKER_ENABLED=false)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
