/**
 * สร้าง/รีเซ็ตผู้ดูแลระบบจาก Command Line
 * ใช้งาน: npm run admin:create -- --email admin@example.com --name "Admin" --role OWNER
 * รหัสผ่านอ่านจาก --password หรือ ADMIN_PASSWORD หรือถามแบบซ่อนตัวอักษร
 */
import "dotenv/config";
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "OWNER" },
    password: { type: "string" },
    reset: { type: "boolean", default: false },
  },
});

async function askHidden(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => {
    if (!muted) out.output.write(s);
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function main() {
  const email = (values.email ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = values.name ?? process.env.ADMIN_NAME ?? "ผู้ดูแลระบบ";
  const role = (values.role ?? "OWNER").toUpperCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("กรุณาระบุ --email ที่ถูกต้อง");
  if (!["OWNER", "ADMIN", "AGENT"].includes(role)) throw new Error("--role ต้องเป็น OWNER, ADMIN หรือ AGENT");
  const password = values.password ?? process.env.ADMIN_PASSWORD ?? (await askHidden("รหัสผ่าน: "));
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข");
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 12);
    if (existing) {
      if (!values.reset) throw new Error(`มีผู้ใช้ ${email} อยู่แล้ว (ใช้ --reset เพื่อรีเซ็ตรหัสผ่าน)`);
      await prisma.user.update({
        where: { email },
        data: { passwordHash, role: role as "OWNER", isActive: true, failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() },
      });
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      console.log(`✓ รีเซ็ตรหัสผ่านของ ${email} แล้ว`);
    } else {
      await prisma.user.create({ data: { email, name, role: role as "OWNER", passwordHash } });
      console.log(`✓ สร้างผู้ใช้ ${email} (${role}) แล้ว`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`✗ ${(e as Error).message}`);
  process.exit(1);
});
