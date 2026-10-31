import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // ไม่บังคับตอน prisma generate (เช่น ขณะ npm install / docker build) แต่จำเป็นสำหรับ migrate/seed
    url: process.env.DATABASE_URL ?? "",
  },
});
