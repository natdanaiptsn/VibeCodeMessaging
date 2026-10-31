/**
 * Build script สำหรับ Vercel (ตั้งไว้ใน vercel.json → buildCommand)
 * - prisma generate ทุกครั้ง
 * - prisma migrate deploy + seed เฉพาะ Production deployment
 *   (Preview deployment จะไม่แก้ schema ของฐานข้อมูล Production)
 * - next build
 */
import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

const isProduction = process.env.VERCEL_ENV === "production";
const hasDatabase = Boolean(process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || process.env.DATABASE_URL);

run("npx prisma generate");

if (isProduction && hasDatabase && process.env.SKIP_DB_MIGRATE !== "true") {
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
} else if (isProduction && !hasDatabase) {
  console.warn("⚠️  ไม่พบ DATABASE_URL — ข้าม migration (ระบบจะยังใช้งานไม่ได้จนกว่าจะตั้งค่าฐานข้อมูล)");
} else {
  console.log(`ℹ️  VERCEL_ENV=${process.env.VERCEL_ENV ?? "-"} — ข้าม migration/seed (ทำเฉพาะ Production)`);
}

run("npx next build");
