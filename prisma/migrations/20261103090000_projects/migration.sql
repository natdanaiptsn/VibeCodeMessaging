-- โปรเจกต์: 1 โปรเจกต์เชื่อมต่อ LINE OA ได้ 1 บัญชี
-- ใช้ตาราง "LineAccount" เดิมเป็นตารางโปรเจกต์ — ลูกค้า ข้อความ และ Event เดิมจึงอยู่ในโปรเจกต์แรกโดยอัตโนมัติ
-- กฎ / Text Message / Flex Message / การตั้งค่าเดิม ถูกย้ายเข้าโปรเจกต์หลัก (isDefault)

-- 1) ข้อมูลโปรเจกต์
ALTER TABLE "LineAccount" ADD COLUMN "description" TEXT,
ADD COLUMN "settings" JSONB,
ALTER COLUMN "isDefault" SET DEFAULT false;

-- 2) ต้องมีโปรเจกต์หลักอย่างน้อย 1 โปรเจกต์ (และมีได้เพียง 1)
INSERT INTO "LineAccount" ("id", "name", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'โปรเจกต์แรก', true, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "LineAccount");

UPDATE "LineAccount" SET "isDefault" = ("id" = (
  SELECT "id" FROM "LineAccount" ORDER BY ("isDefault" AND "isActive") DESC, "createdAt" ASC LIMIT 1
));

-- ตั้งชื่อโปรเจกต์หลักตามชื่อ LINE OA ที่เชื่อมไว้ (ถ้ามี)
UPDATE "LineAccount" SET "name" = "displayName"
WHERE "isDefault" = true AND "displayName" IS NOT NULL AND "displayName" <> '' AND "name" = 'LINE OA หลัก';

-- 3) การตั้งค่าทั่วไป / Default Reply กลายเป็นของโปรเจกต์ (ระบบ Log ยังเป็นการตั้งค่ารวม)
UPDATE "LineAccount" SET "settings" = (
  SELECT jsonb_object_agg("key", "value") FROM "SystemSetting" WHERE "key" IN ('general', 'defaultReply')
)
WHERE "isDefault" = true;
DELETE FROM "SystemSetting" WHERE "key" IN ('general', 'defaultReply');

-- 4) กฎ / Template เป็นของโปรเจกต์
ALTER TABLE "AuditLog" ADD COLUMN "projectId" UUID;
ALTER TABLE "FlexTemplate" ADD COLUMN "projectId" UUID;
ALTER TABLE "ReplyRule" ADD COLUMN "projectId" UUID;
ALTER TABLE "ReplyTemplate" ADD COLUMN "projectId" UUID;

UPDATE "FlexTemplate" SET "projectId" = (SELECT "id" FROM "LineAccount" WHERE "isDefault" = true LIMIT 1);
UPDATE "ReplyRule" SET "projectId" = (SELECT "id" FROM "LineAccount" WHERE "isDefault" = true LIMIT 1);
UPDATE "ReplyTemplate" SET "projectId" = (SELECT "id" FROM "LineAccount" WHERE "isDefault" = true LIMIT 1);

ALTER TABLE "FlexTemplate" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ReplyRule" ALTER COLUMN "projectId" SET NOT NULL;
ALTER TABLE "ReplyTemplate" ALTER COLUMN "projectId" SET NOT NULL;

-- 5) Index ใหม่ (นำหน้าด้วย projectId)
DROP INDEX "FlexTemplate_name_idx";
DROP INDEX "FlexTemplate_updatedAt_idx";
DROP INDEX "ReplyRule_isActive_triggerType_priority_idx";
DROP INDEX "ReplyTemplate_name_idx";
DROP INDEX "ReplyTemplate_updatedAt_idx";

CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt" DESC);
CREATE INDEX "FlexTemplate_projectId_name_idx" ON "FlexTemplate"("projectId", "name");
CREATE INDEX "FlexTemplate_projectId_updatedAt_idx" ON "FlexTemplate"("projectId", "updatedAt");
CREATE INDEX "ReplyRule_projectId_isActive_triggerType_priority_idx" ON "ReplyRule"("projectId", "isActive", "triggerType", "priority" DESC);
CREATE INDEX "ReplyTemplate_projectId_name_idx" ON "ReplyTemplate"("projectId", "name");
CREATE INDEX "ReplyTemplate_projectId_updatedAt_idx" ON "ReplyTemplate"("projectId", "updatedAt");

-- 6) Foreign keys
ALTER TABLE "ReplyTemplate" ADD CONSTRAINT "ReplyTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LineAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlexTemplate" ADD CONSTRAINT "FlexTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LineAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReplyRule" ADD CONSTRAINT "ReplyRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LineAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "LineAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
