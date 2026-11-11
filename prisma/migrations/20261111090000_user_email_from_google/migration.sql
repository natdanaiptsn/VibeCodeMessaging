-- บัญชีที่สมัครด้วย LINE หรือชื่อผู้ใช้ แล้วผูก Google ทีหลัง: ใช้อีเมลที่ Google ยืนยันแล้วเป็นอีเมลของบัญชี
-- เพื่อให้เพิ่มเป็นสมาชิกโปรเจกต์ด้วยอีเมลได้ (เฉพาะบัญชีที่ยังไม่มีอีเมล, อีเมลนั้นยังไม่มีบัญชีอื่นใช้ และไม่ได้ผูกไว้หลายบัญชี)
UPDATE "User" AS u
SET "email" = lower(i."email"), "updatedAt" = CURRENT_TIMESTAMP
FROM "UserIdentity" AS i
WHERE i."userId" = u."id"
  AND i."provider" = 'GOOGLE'
  AND i."email" IS NOT NULL
  AND u."email" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "User" AS o WHERE lower(o."email") = lower(i."email"))
  AND (SELECT COUNT(*) FROM "UserIdentity" AS j WHERE lower(j."email") = lower(i."email")) = 1;
