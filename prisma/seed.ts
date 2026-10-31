/**
 * Seed ข้อมูลเริ่มต้นและข้อมูลตัวอย่าง
 * - ผู้ดูแลระบบ: อ่านจาก ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME (ไม่ hardcode รหัสผ่าน)
 * - Template / Flex / กฎตอบกลับตัวอย่าง
 * - ข้อมูลลูกค้าและข้อความจำลอง (เฉพาะเมื่อ SEED_DEMO_DATA=true)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";
import { FLEX_PRESETS } from "../lib/flex/presets";
import { normalizeText } from "../lib/auto-reply/normalize";
import { DEFAULT_SETTINGS } from "../lib/validation/settings";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "ผู้ดูแลระบบ";
  if (!email || !password) {
    console.warn("⚠️  ข้ามการสร้างผู้ดูแล: ไม่ได้กำหนด ADMIN_EMAIL / ADMIN_PASSWORD (สร้างภายหลังด้วย npm run admin:create)");
    return;
  }
  if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new Error("ADMIN_PASSWORD ต้องมีอย่างน้อย 10 ตัวอักษร และมีทั้งตัวอักษรและตัวเลข");
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ ผู้ดูแล ${email} มีอยู่แล้ว (ไม่เปลี่ยนรหัสผ่าน)`);
    return;
  }
  await prisma.user.create({ data: { email, name, role: "OWNER", passwordHash: await bcrypt.hash(password, 12) } });
  console.log(`✓ สร้างผู้ดูแล ${email} (OWNER)`);
}

async function ensureTextTemplate(name: string, content: string, description?: string) {
  const found = await prisma.replyTemplate.findFirst({ where: { name } });
  if (found) return found;
  return prisma.replyTemplate.create({ data: { name, content, description } });
}

async function ensureFlexTemplate(key: string) {
  const preset = FLEX_PRESETS.find((p) => p.key === key)!;
  const found = await prisma.flexTemplate.findFirst({ where: { name: preset.name } });
  if (found) return found;
  return prisma.flexTemplate.create({
    data: {
      name: preset.name,
      description: preset.description,
      altText: preset.altText,
      containerType: (preset.contents as { type: string }).type,
      contents: preset.contents as Prisma.InputJsonValue,
    },
  });
}

type RuleSeed = {
  name: string;
  description?: string;
  priority: number;
  triggerType: "TEXT" | "POSTBACK" | "FOLLOW" | "IMAGE" | "STICKER" | "LOCATION";
  matchType?: "EXACT" | "CONTAINS" | "STARTS_WITH" | "ENDS_WITH" | "REGEX";
  keywordLogic?: "ANY" | "ALL";
  keywords?: string[];
  replyType: "TEXT" | "FLEX";
  textTemplateId?: string;
  flexTemplateId?: string;
};

async function ensureRule(r: RuleSeed) {
  const found = await prisma.replyRule.findFirst({ where: { name: r.name } });
  if (found) return found;
  const matchType = r.matchType ?? "CONTAINS";
  return prisma.replyRule.create({
    data: {
      name: r.name,
      description: r.description,
      priority: r.priority,
      triggerType: r.triggerType,
      matchType,
      keywordLogic: r.keywordLogic ?? "ANY",
      replyType: r.replyType,
      textTemplateId: r.textTemplateId ?? null,
      flexTemplateId: r.flexTemplateId ?? null,
      keywords: {
        create: (r.keywords ?? []).map((k) => ({ keyword: k, normalizedKeyword: matchType === "REGEX" ? k : normalizeText(k) })),
      },
    },
  });
}

async function seedContent() {
  const welcome = await ensureTextTemplate(
    "ข้อความต้อนรับ",
    "สวัสดีคุณ {{displayName}} 🎉\nขอบคุณที่เพิ่มเราเป็นเพื่อน\nพิมพ์ \"ราคา\" เพื่อดูราคา หรือ \"ติดต่อ\" เพื่อติดต่อเจ้าหน้าที่",
    "ส่งเมื่อมีผู้เพิ่มเพื่อน",
  );
  const price = await ensureTextTemplate(
    "แจ้งราคา",
    "สวัสดีคุณ {{displayName}}\nแพ็กเกจของเรา:\n• Basic 299 บาท/เดือน\n• Pro 599 บาท/เดือน\n(ข้อมูล ณ วันที่ {{date}})",
  );
  const fallback = await ensureTextTemplate(
    "Default Reply",
    "สวัสดีคุณ {{displayName}}\nเราได้รับข้อมูลของคุณเรียบร้อยแล้ว ขอบคุณที่ติดต่อเรา\nเจ้าหน้าที่จะติดต่อกลับโดยเร็วที่สุด",
    "ส่งเมื่อไม่พบ Keyword",
  );
  const imageThanks = await ensureTextTemplate("ขอบคุณสำหรับรูปภาพ", "ขอบคุณสำหรับรูปภาพค่ะ คุณ {{displayName}} เจ้าหน้าที่จะตรวจสอบและติดต่อกลับ");
  const coupon = await ensureTextTemplate("รับคูปอง", "คูปองส่วนลดของคุณคือ PROMO20 🎁\nใช้ได้ถึงสิ้นเดือนนี้");

  const register = await ensureFlexTemplate("register");
  const contact = await ensureFlexTemplate("contact");
  await ensureFlexTemplate("promotion");

  await ensureRule({ name: "สมัครสมาชิก", priority: 30, triggerType: "TEXT", matchType: "CONTAINS", keywords: ["สมัครสมาชิก", "สมัคร"], replyType: "FLEX", flexTemplateId: register.id });
  await ensureRule({ name: "สอบถามราคา", priority: 20, triggerType: "TEXT", matchType: "EXACT", keywords: ["ราคา"], replyType: "TEXT", textTemplateId: price.id });
  await ensureRule({ name: "ติดต่อเจ้าหน้าที่", priority: 10, triggerType: "TEXT", matchType: "CONTAINS", keywords: ["ติดต่อ"], replyType: "FLEX", flexTemplateId: contact.id });
  await ensureRule({ name: "ต้อนรับเพื่อนใหม่", priority: 0, triggerType: "FOLLOW", replyType: "TEXT", textTemplateId: welcome.id });
  await ensureRule({ name: "ตอบกลับเมื่อส่งรูป", priority: 0, triggerType: "IMAGE", replyType: "TEXT", textTemplateId: imageThanks.id });
  await ensureRule({ name: "Postback รับคูปอง", priority: 0, triggerType: "POSTBACK", matchType: "CONTAINS", keywords: ["action=coupon"], replyType: "TEXT", textTemplateId: coupon.id });

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const v = key === "defaultReply" ? { ...value, enabled: true, textTemplateId: fallback.id, cooldownMinutes: 0 } : value;
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value: v as Prisma.InputJsonValue }, update: {} });
  }
  console.log("✓ สร้าง Template, Flex Message, กฎตอบกลับ และการตั้งค่าเริ่มต้น");
}

async function ensureLineAccount() {
  const existing = await prisma.lineAccount.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  return prisma.lineAccount.create({ data: { name: "LINE OA หลัก", isDefault: true } });
}

async function seedDemo(accountId: string) {
  if (process.env.SEED_DEMO_DATA !== "true") return;
  const already = await prisma.customer.count({ where: { lineUserId: { startsWith: "Udemo" } } });
  if (already > 0) return console.log("✓ มีข้อมูลตัวอย่างอยู่แล้ว");
  const names = ["สมชาย ใจดี", "สุดา รักสวย", "John Smith", "มานี มีนา", "ปิติ ยินดี"];
  const texts = ["ราคา", "สนใจสมัครสมาชิกครับ", "ติดต่อเจ้าหน้าที่หน่อย", "สวัสดีค่ะ", "ขอบคุณครับ"];
  const rule = await prisma.replyRule.findFirst({ where: { name: "สอบถามราคา" } });
  const now = Date.now();
  for (const [i, name] of names.entries()) {
    const customer = await prisma.customer.create({
      data: {
        lineAccountId: accountId,
        lineUserId: `Udemo${String(i).padStart(28, "0")}`,
        displayName: name,
        followedAt: new Date(now - (20 - i) * 86400000),
        profileSyncedAt: new Date(),
      },
    });
    for (let d = 0; d < 14; d++) {
      if ((d + i) % 3 === 0) continue;
      const ts = new Date(now - d * 86400000 - i * 3600000);
      const text = texts[(d + i) % texts.length]!;
      const msg = await prisma.message.create({
        data: { lineAccountId: accountId, customerId: customer.id, direction: "INBOUND", type: "TEXT", text, status: "REPLIED", timestamp: ts },
      });
      const ok = (d + i) % 7 !== 0;
      await prisma.replyLog.create({
        data: {
          lineAccountId: accountId,
          customerId: customer.id,
          sourceMessageId: msg.id,
          ruleId: text === "ราคา" ? rule?.id : null,
          ruleName: text === "ราคา" ? "สอบถามราคา" : "Default Reply",
          source: text === "ราคา" ? "RULE" : "DEFAULT",
          method: "REPLY",
          replyType: "TEXT",
          status: ok ? "SUCCESS" : "FAILED",
          errorMessage: ok ? null : "Invalid reply token (ข้อมูลตัวอย่าง)",
          requestMessages: [{ type: "text", text: "ข้อความตัวอย่าง" }],
          createdAt: new Date(ts.getTime() + 800),
          completedAt: new Date(ts.getTime() + 900),
        },
      });
      if (!ok) await prisma.message.update({ where: { id: msg.id }, data: { status: "FAILED" } });
    }
    const last = await prisma.message.findFirst({ where: { customerId: customer.id }, orderBy: { timestamp: "desc" } });
    await prisma.customer.update({
      where: { id: customer.id },
      data: { lastMessageAt: last?.timestamp, lastMessageText: last?.text, lastMessageType: "TEXT", messageCount: await prisma.message.count({ where: { customerId: customer.id } }) },
    });
  }
  console.log("✓ สร้างข้อมูลลูกค้าและข้อความตัวอย่าง (SEED_DEMO_DATA=true)");
}

async function main() {
  await seedAdmin();
  const account = await ensureLineAccount();
  await seedContent();
  await seedDemo(account.id);
}

main()
  .catch((e) => {
    console.error("Seed ล้มเหลว:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
