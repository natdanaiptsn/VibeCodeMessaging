import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // ไม่บังคับตอน prisma generate (เช่น ขณะ npm install / docker build) แต่จำเป็นสำหรับ migrate
    // Migration ควรใช้ connection แบบ direct (ไม่ผ่าน pooler) — Neon/Vercel ตั้งชื่อว่า DATABASE_URL_UNPOOLED
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
