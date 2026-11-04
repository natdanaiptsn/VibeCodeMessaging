-- กฎตอบกลับตอบได้หลายข้อความ (สูงสุด 5 ข้อความต่อการตอบกลับ ตามข้อจำกัดของ LINE)
-- ข้อความตอบกลับเดิมของทุกกฎถูกย้ายเป็นข้อความแรก (position 0) ของกฎนั้น

-- 1) ตารางข้อความของกฎ
CREATE TYPE "ReplyMessageType" AS ENUM ('TEXT', 'FLEX');

CREATE TABLE "ReplyRuleMessage" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "ReplyMessageType" NOT NULL,
    "text" TEXT,
    "textTemplateId" UUID,
    "flexTemplateId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ReplyRuleMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReplyRuleMessage_textTemplateId_idx" ON "ReplyRuleMessage"("textTemplateId");
CREATE INDEX "ReplyRuleMessage_flexTemplateId_idx" ON "ReplyRuleMessage"("flexTemplateId");
CREATE UNIQUE INDEX "ReplyRuleMessage_ruleId_position_key" ON "ReplyRuleMessage"("ruleId", "position");

ALTER TABLE "ReplyRuleMessage" ADD CONSTRAINT "ReplyRuleMessage_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ReplyRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplyRuleMessage" ADD CONSTRAINT "ReplyRuleMessage_textTemplateId_fkey" FOREIGN KEY ("textTemplateId") REFERENCES "ReplyTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReplyRuleMessage" ADD CONSTRAINT "ReplyRuleMessage_flexTemplateId_fkey" FOREIGN KEY ("flexTemplateId") REFERENCES "FlexTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) ย้ายข้อความตอบกลับเดิม
INSERT INTO "ReplyRuleMessage" ("id", "ruleId", "position", "type", "textTemplateId", "flexTemplateId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  r."id",
  0,
  (CASE WHEN r."replyType" = 'FLEX' THEN 'FLEX' ELSE 'TEXT' END)::"ReplyMessageType",
  CASE WHEN r."replyType" = 'FLEX' THEN NULL ELSE r."textTemplateId" END,
  CASE WHEN r."replyType" = 'FLEX' THEN r."flexTemplateId" ELSE NULL END,
  now(),
  now()
FROM "ReplyRule" r
WHERE (r."replyType" = 'FLEX' AND r."flexTemplateId" IS NOT NULL)
   OR (r."replyType" <> 'FLEX' AND r."textTemplateId" IS NOT NULL);

-- 3) ลบคอลัมน์เดิมของกฎ (ข้อมูลย้ายไปแล้ว)
ALTER TABLE "ReplyRule" DROP CONSTRAINT "ReplyRule_flexTemplateId_fkey";
ALTER TABLE "ReplyRule" DROP CONSTRAINT "ReplyRule_textTemplateId_fkey";
DROP INDEX "ReplyRule_flexTemplateId_idx";
DROP INDEX "ReplyRule_textTemplateId_idx";
ALTER TABLE "ReplyRule" DROP COLUMN "flexTemplateId",
DROP COLUMN "textTemplateId";
