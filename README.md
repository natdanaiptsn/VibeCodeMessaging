# LINE OA Auto Reply Manager

ระบบจัดการ **LINE Official Account** แบบ Web Application สำหรับรับข้อความจากลูกค้าผ่าน LINE Webhook และ **ตอบกลับอัตโนมัติด้วย Text Message หรือ Flex Message** โดยใช้ **Keyword Matching และ Rule-based Automation** (ไม่ใช้ AI, ไม่ใช้ Botnoi หรือแพลตฟอร์ม Chatbot สำเร็จรูป) พร้อมหน้า Dashboard สำหรับจัดการทุกอย่างในที่เดียว

---

## สารบัญ

1. [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
2. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
3. [Technology Stack](#technology-stack)
4. [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
5. [การติดตั้ง (Development)](#การติดตั้ง-development)
6. [Environment Variables](#environment-variables)
7. [วิธีตั้งค่า LINE Developers](#วิธีตั้งค่า-line-developers)
8. [วิธีตั้งค่า Webhook](#วิธีตั้งค่า-webhook)
9. [คู่มือการใช้งาน](#คู่มือการใช้งาน)
10. [วิธี Deploy (Production)](#วิธี-deploy-production)
11. [วิธี Backup / Restore Database](#วิธี-backup--restore-database)
12. [ความปลอดภัย](#ความปลอดภัย)
13. [การทดสอบ](#การทดสอบ)
14. [การแก้ไขปัญหาที่พบบ่อย](#การแก้ไขปัญหาที่พบบ่อย)
15. [ข้อจำกัดและหมายเหตุ](#ข้อจำกัดและหมายเหตุ)

---

## ฟีเจอร์หลัก

| เมนู | ความสามารถ |
|---|---|
| **Dashboard** | ข้อความที่ได้รับวันนี้, ตอบกลับสำเร็จ/ไม่สำเร็จ, ลูกค้าทั้งหมด, กฎที่เปิดใช้งาน, กราฟสถิติรายวัน 14 วัน (มีมุมมองตาราง), ข้อความล่าสุด, สถานะการเชื่อมต่อ LINE OA และคิวประมวลผล |
| **กล่องข้อความ (Inbox)** | รายการแชท, ค้นหาลูกค้า/ข้อความ, กรองตามวันที่และประเภทข้อความ, ประวัติข้อความรายคน (รูปภาพ/สติกเกอร์/ตำแหน่ง/Postback/Flex), สถานะการตอบกลับ, **ส่งข้อความโดย Admin** (ข้อความ, Text Template, Flex Message) พร้อมกันส่งซ้ำ, อัปเดตอัตโนมัติทุก 5 วินาที |
| **ลูกค้า** | รายชื่อลูกค้า, สถานะติดตาม/บล็อก, สถิติ, โน้ตภายใน, ดึงโปรไฟล์จาก LINE |
| **ระบบตอบกลับอัตโนมัติ** | เพิ่ม/แก้ไข/ลบ/เปิด-ปิด/ทำสำเนากฎ, Keyword หลายคำ (AND/OR), Exact / Contains / Starts With / Ends With / Regular Expression (ป้องกัน ReDoS), Priority, ทริกเกอร์ตามเหตุการณ์ (ข้อความ, Postback, เพิ่มเพื่อน, รูปภาพ, สติกเกอร์, ตำแหน่ง), เครื่องมือทดสอบข้อความ |
| **Text Message** | สร้าง/แก้ไข/ลบข้อความ, Preview แบบแชท LINE, บันทึกเป็น Template ใหม่, ตัวแปร Dynamic `{{displayName}} {{userId}} {{date}} {{time}} {{datetime}}` |
| **Flex Message Builder** | Visual Builder 3 ส่วน (Component Panel / Editor Canvas / Live Preview), Drag & Drop, Bubble และ Carousel, Box / Text / Image / Button / Separator / Spacer, กำหนดสี ขนาดตัวอักษร ระยะห่าง Alignment Background (รวม Gradient) Border Action URL และ Postback, Duplicate / ลบ / Undo-Redo, อัปโหลดรูป, เทมเพลตเริ่มต้น, บันทึก/โหลด Template, นำเข้า/Export JSON, Validate ตาม LINE Spec และตรวจสอบกับ LINE API จริง |
| **ประวัติการตอบกลับ** | วันเวลา, ลูกค้า, ข้อความต้นทาง, กฎที่ใช้, รูปแบบ, ผลการส่ง (Pending/Processing/Success/Failed), Error, LINE API Response ที่จำเป็น, ค้นหา/กรอง, ส่งซ้ำด้วย Push API |
| **LINE OA Settings** | Channel ID / Secret / Access Token (เข้ารหัส), Webhook URL, ตั้งค่า Webhook ไปยัง LINE, ทดสอบการเชื่อมต่อ, ทดสอบ Webhook, โควตาข้อความ |
| **ตั้งค่าระบบ** | เปิด/ปิด Auto Reply, พฤติกรรมเมื่อพบหลายกฎ, Push fallback, Timezone (ค่าเริ่มต้น Asia/Bangkok), Default Reply (+cooldown), ระบบ Log และระยะเวลาเก็บข้อมูล, เปลี่ยนรหัสผ่าน, จัดการผู้ใช้และสิทธิ์, Audit Log |

---

## สถาปัตยกรรมระบบ

```mermaid
flowchart LR
  U[ลูกค้า LINE] -->|ส่งข้อความ| LP[LINE Platform]
  LP -->|POST /api/webhook/line<br/>X-Line-Signature| WH[Webhook Route]
  WH -->|1. ตรวจลายเซ็น raw body<br/>2. กัน Event ซ้ำ webhookEventId<br/>3. บันทึกคิว| DB[(PostgreSQL)]
  WH -->|ตอบ 200 ทันที| LP
  WH -.->|after: kick| Q[Queue Worker<br/>FOR UPDATE SKIP LOCKED]
  Q --> P[Event Processor]
  P -->|ลูกค้า / ข้อความ| DB
  P --> E[Auto Reply Engine<br/>Keyword + Rules]
  E --> R[Reply Service]
  R -->|Reply API / Push API + Retry Key| LP
  R -->|ReplyLog / ข้อความขาออก| DB
  A[Admin Dashboard<br/>Next.js App Router] -->|Route Handlers + Zod| DB
```

### ลำดับการประมวลผลข้อความ

1. **รับ Event** ที่ `POST /api/webhook/line` (จำกัดขนาด 1 MB)
2. **ตรวจสอบ Signature** — HMAC-SHA256 ของ *raw body* ด้วย Channel Secret เปรียบเทียบแบบ constant-time; ไม่ผ่าน = 401 และไม่บันทึกอะไร
3. **ตรวจสอบ Event ซ้ำ** — `webhookEventId` เป็น unique (`INSERT ... ON CONFLICT DO NOTHING`) รองรับ Webhook Redelivery
4. บันทึก Event ลงตาราง `WebhookEvent` (เข้ารหัส Reply Token, ตัด replyToken ออกจาก payload) แล้ว **ตอบ HTTP 200 ทันที**
5. **Background Worker** (เริ่มผ่าน `instrumentation.ts`) claim งานด้วย `FOR UPDATE SKIP LOCKED` — รันหลาย instance ได้, Event ของลูกค้าคนเดียวกันประมวลผลตามลำดับ, มี retry + backoff และกู้คืนงานค้าง
6. ดึง **LINE User ID** → บันทึก/อัปเดตลูกค้า (ดึง Display Name จาก LINE เมื่อทำได้)
7. **บันทึกข้อความ** (ประเภท, เนื้อหา, Message ID, เวลา, สถานะ)
8. ส่งเข้าสู่ **Auto Reply Engine** → ประมวลผลกฎตาม Priority
9. **ส่งข้อความกลับ** ด้วย Reply API (ถ้า Reply Token หมดอายุและเปิด Push fallback จะใช้ Push API + `X-Line-Retry-Key`)
10. **บันทึกผลการส่ง** ใน `ReplyLog` และลบ Reply Token ทิ้งทันที

### กติกาของ Auto Reply Engine

- โหลดกฎที่ **เปิดใช้งาน** ของเหตุการณ์นั้น เรียงตาม **Priority มาก → น้อย** แล้ววันที่สร้าง (เก่า → ใหม่)
- โหมด **FIRST_MATCH** (ค่าเริ่มต้น): ใช้กฎ Priority สูงสุดที่ตรงเพียงกฎเดียว
- โหมด **ALL_MATCHES**: ส่งทุกกฎที่ตรง รวมกันได้ไม่เกิน *จำนวนข้อความสูงสุด* (≤ 5 ตามข้อจำกัด LINE)
- ไม่พบกฎ → ใช้ **Default Reply** (ถ้าเปิด) สำหรับข้อความตัวอักษร และ (เลือกได้) รูปภาพ/สติกเกอร์/ตำแหน่ง พร้อม cooldown ต่อผู้ใช้
- 1 Webhook Event มี `ReplyLog` ได้เพียงรายการเดียว (unique) → **ไม่ตอบซ้ำจาก Event เดียวกัน**
- การจับคู่: normalize ข้อความ (NFC, ลบ zero-width, ยุบช่องว่าง, ตัวพิมพ์เล็ก ยกเว้นเลือก Case sensitive)

---

## Technology Stack

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix UI), Lucide Icons, TanStack Query, Recharts, dnd-kit, Sonner |
| Backend | Next.js Route Handlers (Node.js runtime), LINE Messaging API, LINE Webhook, Queue บน PostgreSQL |
| Database | PostgreSQL 16, Prisma ORM 7 (`@prisma/adapter-pg`), pg_trgm สำหรับค้นหาข้อความ |
| Validation | Zod 4 + ตัวตรวจสอบ Flex Message ตาม LINE Spec |
| Authentication | ระบบ Session ในฐานข้อมูล (cookie httpOnly + SameSite), bcrypt, บทบาท OWNER / ADMIN / AGENT |
| Testing | Vitest (unit), ทดสอบ End-to-End กับ Mock LINE API |
| Deploy | Docker (multi-stage, standalone, non-root), docker compose, Caddy (HTTPS อัตโนมัติ) |

---

## โครงสร้างโปรเจกต์

```
app/
  (dashboard)/            หน้า Dashboard ทั้งหมด (ต้องเข้าสู่ระบบ)
    dashboard/ inbox/ customers/ auto-reply/ text-messages/
    flex-builder/ reply-logs/ line-settings/ settings/
  login/                  หน้าเข้าสู่ระบบ
  api/
    webhook/line/         ★ LINE Webhook Endpoint
    auth/ dashboard/ conversations/ customers/ messages/ rules/
    text-templates/ flex-templates/ media/ reply-logs/ line/
    settings/ users/ audit-logs/ health/
components/
  ui/                     shadcn/ui components
  layout/ common/         Sidebar, สถานะ Loading/Empty/Error ฯลฯ
  dashboard/ inbox/ customers/ auto-reply/ text-messages/
  flex/                   Flex Message Preview renderer
  flex-builder/           Visual Flex Message Builder (model, canvas, inspector)
  reply-logs/ line-settings/ settings/
lib/
  api/handler.ts          Route wrapper: Auth, สิทธิ์, CSRF, Rate limit, Error handling
  auth/                   Session, Password, Permissions
  auto-reply/             Matcher, Regex safety (ReDoS), Sandboxed regex
  flex/                   Flex types, validator, URL safety, presets, render variables
  line/                   Webhook types, signature, limits
  templates/variables.ts  ตัวแปร Dynamic
  validation/             Zod schemas
  crypto.ts env.ts prisma.ts rate-limit.ts audit.ts logger.ts
services/
  line-webhook.service.ts             รับ Webhook + ตรวจลายเซ็น + กันซ้ำ
  line-messaging.service.ts           LINE Messaging API client
  webhook-event-processor.service.ts  ประมวลผล Event
  queue.service.ts                    Queue / Background Worker
  auto-reply-engine.service.ts        Auto Reply Engine
  reply.service.ts                    ส่งข้อความ + บันทึกผล
  text-template.service.ts flex-message.service.ts
  customer.service.ts message.service.ts rule.service.ts
  settings.service.ts line-account.service.ts dashboard.service.ts maintenance.service.ts
hooks/                    useApiQuery / useApiMutation, useDebounce, App context
prisma/
  schema.prisma  migrations/  seed.ts
scripts/
  create-admin.ts  simulate-webhook.ts  backup-db.sh
deploy/                   Caddyfile, ตัวอย่าง nginx.conf
tests/                    Unit tests (Vitest)
instrumentation.ts        เริ่ม Queue Worker เมื่อ server start
proxy.ts                  Redirect ไปหน้า Login เมื่อไม่มี session (Next.js 16 Proxy)
```

### Database Schema (สรุป)

| ตาราง | หน้าที่ |
|---|---|
| `User`, `Session` | ผู้ดูแลระบบ (bcrypt) และ session (เก็บเฉพาะ SHA-256 ของ token) |
| `LineAccount` | ข้อมูลบัญชี LINE OA + Credentials ที่เข้ารหัส AES-256-GCM |
| `Customer` | ลูกค้า LINE (`@@unique([lineAccountId, lineUserId])`) |
| `Message` | ข้อความขาเข้า/ขาออก (index ตามลูกค้า/เวลา, GIN trigram สำหรับค้นหา) |
| `WebhookEvent` | คิว + ป้องกัน Event ซ้ำ (`webhookEventId` unique) |
| `ReplyRule`, `ReplyKeyword` | กฎตอบกลับและ Keyword |
| `ReplyTemplate`, `FlexTemplate` | Text Template และ Flex Template |
| `ReplyLog` | ประวัติการตอบกลับ (`webhookEventId` unique กันตอบซ้ำ, `retryKey` unique กัน Push ซ้ำ) |
| `SystemSetting` | การตั้งค่าระบบ (key-value ตรวจสอบด้วย Zod) |
| `AuditLog` | บันทึกการแก้ไขกฎ/การตั้งค่า/การเข้าสู่ระบบ |
| `MediaAsset` | รูปภาพที่อัปโหลดสำหรับ Flex Message |

ทุกตารางใช้ **UUID** (UUIDv7 สำหรับตารางข้อมูลจำนวนมาก), มี `createdAt` / `updatedAt` (timestamptz), Foreign Key, Unique Constraint และ Index ที่จำเป็น

---

## การติดตั้ง (Development)

### ความต้องการ

- Node.js **20.19+** (แนะนำ 22 LTS)
- PostgreSQL **14+** (แนะนำ 16)

### ขั้นตอน

```bash
git clone <repository-url> line-oa-manager
```

```bash
cd line-oa-manager
```

```bash
npm install
```

```bash
cp .env.example .env
```

แก้ไข `.env` อย่างน้อย `DATABASE_URL`, `ENCRYPTION_KEY`, `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — สร้าง `ENCRYPTION_KEY` ด้วย:

```bash
openssl rand -base64 32
```

สร้างตารางในฐานข้อมูล (Migration):

```bash
npx prisma migrate deploy
```

สร้างผู้ดูแลระบบและข้อมูลตัวอย่าง (Template, Flex, กฎตอบกลับ):

```bash
npm run db:seed
```

เริ่มเซิร์ฟเวอร์:

```bash
npm run dev
```

เปิด http://localhost:3000 แล้วเข้าสู่ระบบด้วย `ADMIN_EMAIL` / `ADMIN_PASSWORD`

> ต้องการข้อมูลลูกค้าและสถิติจำลองสำหรับทดสอบหน้าจอ: ตั้ง `SEED_DEMO_DATA="true"` ก่อนรัน seed (ไม่ควรใช้ใน Production)

> ทดสอบ Webhook ในเครื่องโดยต้องให้ LINE เข้าถึงได้ ให้ใช้ HTTPS tunnel เช่น `cloudflared tunnel --url http://localhost:3000` หรือ `ngrok http 3000` แล้วตั้ง `APP_URL` เป็น URL ที่ได้

### สร้าง/รีเซ็ตผู้ดูแลระบบภายหลัง

```bash
npm run admin:create -- --email admin@example.com --name "ผู้ดูแล" --role OWNER
```

(ระบบจะถามรหัสผ่านแบบซ่อนตัวอักษร, ใช้ `--reset` เพื่อรีเซ็ตรหัสผ่านของผู้ใช้ที่มีอยู่)

---

## Environment Variables

| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `ENCRYPTION_KEY` | ✅ | คีย์ 32 bytes (base64/hex) สำหรับเข้ารหัส LINE Credentials และ Reply Token — **ห้ามเปลี่ยนหลังใช้งาน** |
| `APP_URL` | ✅ (Production) | URL สาธารณะแบบ HTTPS ใช้สร้าง Webhook URL และ URL รูปภาพ |
| `SESSION_TTL_HOURS` | | อายุ session (ค่าเริ่มต้น 168 ชม.) |
| `COOKIE_SECURE` | | `auto` / `true` / `false` |
| `TRUST_PROXY` | | `true` เมื่ออยู่หลัง Reverse Proxy (อ่าน IP จาก X-Forwarded-For) |
| `LINE_CHANNEL_SECRET` | | (ไม่บังคับ) ถ้ากำหนด จะใช้แทนค่าที่ตั้งในหน้าเว็บ |
| `LINE_CHANNEL_ACCESS_TOKEN` | | (ไม่บังคับ) เช่นเดียวกับด้านบน |
| `LINE_CHANNEL_ID` | | (ไม่บังคับ) สำหรับอ้างอิง |
| `QUEUE_WORKER_ENABLED` | | เปิด Background Worker (ค่าเริ่มต้น `true`) |
| `QUEUE_POLL_INTERVAL_MS` | | ความถี่ตรวจคิว (ค่าเริ่มต้น 3000) |
| `LOG_LEVEL` | | ระดับ Log เริ่มต้น |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seed | ผู้ดูแลคนแรก (ไม่ hardcode รหัสผ่านในโค้ด) |
| `SEED_DEMO_DATA` | | สร้างข้อมูลจำลองตอน seed |
| `LINE_API_BASE_URL` / `LINE_DATA_API_BASE_URL` | | ใช้กับ Mock/Staging เท่านั้น (ค่าเริ่มต้นคือ LINE API จริง) |

---

## วิธีตั้งค่า LINE Developers

1. เข้า [LINE Developers Console](https://developers.line.biz/console/) และเข้าสู่ระบบ
2. สร้าง **Provider** (หรือเลือกที่มีอยู่)
3. สร้าง Channel ประเภท **Messaging API** (หรือเปิดใช้ Messaging API จาก LINE Official Account Manager → Settings → Messaging API)
4. แท็บ **Basic settings** → คัดลอก **Channel ID** และ **Channel secret**
5. แท็บ **Messaging API** → ส่วน *Channel access token (long-lived)* → กด **Issue** แล้วคัดลอก
6. ใน **LINE Official Account Manager** → *Response settings*:
   - เปิด **Webhook**
   - ปิด **Auto-response messages** และ **Greeting messages** (เพื่อไม่ให้ LINE ตอบซ้ำกับระบบนี้)
   - เลือกโหมด **Bot** (หรือ Chat + Webhook หากต้องการแชทด้วยแอป LINE OA ด้วย)
7. ในระบบนี้ไปที่ **LINE OA Settings** → กรอก Channel ID, Channel Secret, Channel Access Token → **บันทึก Credentials** (ระบบเข้ารหัสก่อนบันทึก และจะไม่แสดงค่ากลับ)
8. กด **ทดสอบการเชื่อมต่อ** — ควรแสดงชื่อบัญชีและ Basic ID

> ทางเลือก: กำหนดผ่าน Environment `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` แทนการบันทึกในฐานข้อมูล

---

## วิธีตั้งค่า Webhook

Webhook URL ของระบบคือ:

```
https://<โดเมนของคุณ>/api/webhook/line
```

**วิธีที่ 1 — ผ่านหน้า LINE OA Settings (แนะนำ)**
1. ตั้ง `APP_URL` เป็นโดเมน HTTPS จริง
2. หน้า **LINE OA Settings** → การ์ด Webhook → กด **ตั้งค่า Webhook URL ไปยัง LINE**
3. กด **ทดสอบ Webhook** — LINE จะส่งคำขอทดสอบมายังระบบ

**วิธีที่ 2 — ผ่าน LINE Developers Console**
1. แท็บ **Messaging API** → *Webhook settings* → **Edit** → วาง Webhook URL
2. กด **Verify** (ต้องได้ Success)
3. เปิด **Use webhook**
4. แนะนำให้เปิด **Webhook redelivery** — ระบบรองรับการส่งซ้ำและกัน Event ซ้ำด้วย `webhookEventId` อยู่แล้ว

ข้อกำหนด: LINE ส่ง Webhook ได้เฉพาะ **HTTPS ที่มีใบรับรองถูกต้อง** เท่านั้น

---

## คู่มือการใช้งาน

### สร้างกฎตอบกลับ

1. สร้างข้อความที่เมนู **Text Message** หรือ Flex ที่เมนู **Flex Message Builder**
2. เมนู **ระบบตอบกลับอัตโนมัติ** → **เพิ่มกฎ**
3. เลือก *เหตุการณ์* (ข้อความตัวอักษร / Postback / เพิ่มเพื่อน / รูปภาพ / สติกเกอร์ / ตำแหน่ง)
4. สำหรับข้อความ/Postback: เลือกเงื่อนไข และใส่ Keyword (กด Enter เพื่อเพิ่ม)

| เงื่อนไข | ตัวอย่าง Keyword | ข้อความ “ขอราคาหน่อย” |
|---|---|---|
| Exact Match | `ราคา` | ❌ ไม่ตรง (ต้องพิมพ์ “ราคา” ตรงตัว) |
| Contains | `ราคา` | ✅ ตรง |
| Starts With | `ขอ` | ✅ ตรง |
| Ends With | `หน่อย` | ✅ ตรง |
| Multiple Keywords (ALL) | `ส่ง`, `ฟรี` | ต้องมีทั้งสองคำ |
| Regular Expression | `^(ราคา\|เท่าไหร่)` | ตามรูปแบบ (ตรวจ ReDoS อัตโนมัติ) |

5. เลือกรูปแบบการตอบกลับ (Text / Flex) และ Template, กำหนด **Priority** (ค่ามากถูกตรวจก่อน)
6. ใช้ปุ่ม **ทดสอบข้อความ** เพื่อตรวจว่าข้อความจะตรงกฎใด (ไม่ส่งข้อความจริง)

ตัวอย่างจาก Seed: `สมัครสมาชิก` (Contains → Flex), `ราคา` (Exact → Text), `ติดต่อ` (Contains → Flex), ต้อนรับเพื่อนใหม่ (Follow → Text), Postback `action=coupon`

### ตัวแปร Dynamic

| ตัวแปร | ค่า |
|---|---|
| `{{displayName}}` | ชื่อที่แสดงของลูกค้า (ถ้าไม่ทราบ = “ลูกค้า”) |
| `{{userId}}` | LINE User ID |
| `{{date}}` | วันที่ เช่น 31 ตุลาคม 2569 (ตาม Timezone) |
| `{{time}}` | เวลา เช่น 14:30 |
| `{{datetime}}` | วันที่และเวลา |

ค่าตัวแปรถูกทำความสะอาด (ตัดอักขระควบคุม/ขึ้นบรรทัดใหม่, จำกัดความยาว) และแทนค่าแบบ single-pass; ใน Flex จะแทนเฉพาะใน string field และ URL-encode เมื่ออยู่ใน `uri`

### Flex Message Builder

- **Component Panel** (ซ้าย): คลิกเพื่อเพิ่มใน Box ที่เลือก หรือ *ลากไปวาง* ใน Canvas
- **Editor Canvas** (กลาง): โครงสร้าง Header / Hero / Body / Footer, ลากเพื่อจัดลำดับ/ย้าย Box, ปุ่มเลื่อนขึ้น-ลง, ทำสำเนา, ลบ; แผง **คุณสมบัติ** สำหรับแก้ไขสี ขนาด ระยะห่าง Alignment Background Border และ Action (URI / Message / Postback)
- **Live Preview** (ขวา): แสดงผลใกล้เคียงแอป LINE, คลิกที่องค์ประกอบเพื่อเลือกแก้ไข, แสดงขนาด JSON และผลการตรวจสอบแบบเรียลไทม์
- **Validate**: ตรวจตาม LINE Flex Spec (property, enum, สี, ขนาด, aspect ratio, ข้อจำกัด 30 KB/bubble, 50 KB/carousel, 12 bubbles, ความยาว label/data/URL) และกด *ตรวจสอบกับ LINE API* เพื่อเรียก `validate/reply` ของ LINE (ไม่ส่งข้อความจริง)
- **Export JSON** / **นำเข้า JSON** ใช้ร่วมกับ LINE Flex Message Simulator ได้
- ปุ่ม Undo/Redo (Ctrl+Z / Ctrl+Y)

### ส่งข้อความโดย Admin (Inbox)

ใช้ **Push API** ซึ่งนับรวมโควตาข้อความรายเดือนของ LINE OA และส่งได้เฉพาะลูกค้าที่ยังเป็นเพื่อนอยู่ ระบบใช้ `X-Line-Retry-Key` ป้องกันการส่งซ้ำเมื่อกดซ้ำหรือเครือข่ายขัดข้อง

### สิทธิ์ผู้ใช้

| บทบาท | สิทธิ์ |
|---|---|
| OWNER | ทุกอย่าง รวมถึง LINE Credentials, จัดการผู้ใช้, Audit Log |
| ADMIN | จัดการกฎ, Template, Flex, ตั้งค่าระบบ, ดูประวัติ/ส่งซ้ำ |
| AGENT | Dashboard, Inbox (ส่งข้อความ), ลูกค้า, ดูกฎ/Template |

---

## วิธี Deploy (Production)

### วิธีที่ 1: Docker Compose (แนะนำ)

ต้องมี Docker 24+ และ Docker Compose v2 บนเซิร์ฟเวอร์ และชี้ DNS ของโดเมนมาที่เซิร์ฟเวอร์

```bash
cp .env.example .env
```

แก้ไข `.env`: `POSTGRES_PASSWORD`, `ENCRYPTION_KEY`, `APP_URL=https://<โดเมน>`, `DOMAIN=<โดเมน>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (ค่า `DATABASE_URL` ใน compose ถูกสร้างจาก POSTGRES_* ให้อัตโนมัติ)

เริ่มระบบพร้อม HTTPS อัตโนมัติ (Caddy + Let's Encrypt):

```bash
docker compose --profile https up -d --build
```

หรือเริ่มเฉพาะแอป (กรณีมี Nginx/Reverse proxy อยู่แล้ว — แอปฟังที่ `127.0.0.1:3000`):

```bash
docker compose up -d --build
```

Service ที่ได้: `db` (PostgreSQL 16 + volume), `migrate` (รัน `prisma migrate deploy` + seed ครั้งเดียว), `app` (Next.js standalone, ผู้ใช้ non-root, healthcheck `/api/health`), `caddy` (เมื่อใช้ profile https)

ดู Log:

```bash
docker compose logs -f app
```

อัปเดตเวอร์ชัน:

```bash
git pull && docker compose --profile https up -d --build
```

สร้างผู้ดูแลเพิ่มใน Docker:

```bash
docker compose run --rm migrate npm run admin:create -- --email you@example.com --role OWNER
```

> หากดึง image จาก Docker Hub ไม่ได้ ให้ระบุ registry อื่น เช่น `--build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm-slim`

### วิธีที่ 2: Node.js โดยตรง (PM2 / systemd + Nginx)

```bash
npm ci
```

```bash
npm run build
```

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

เตรียมไฟล์สำหรับรัน (standalone):

```bash
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
```

รันเซิร์ฟเวอร์ (ตัวอย่างด้วย PM2):

```bash
pm2 start .next/standalone/server.js --name line-oa-manager
```

ตั้งค่า Nginx ตาม `deploy/nginx.conf.example` และออกใบรับรองด้วย certbot — อย่าลืมกำหนด Environment Variables ให้ process (เช่น ผ่าน `pm2 ecosystem` หรือ systemd `EnvironmentFile=`)

### Checklist ก่อนใช้งานจริง

- [ ] `APP_URL` เป็น HTTPS และ Webhook Verify ผ่าน
- [ ] `ENCRYPTION_KEY` สุ่มใหม่และเก็บสำรองไว้อย่างปลอดภัย
- [ ] รหัสผ่านฐานข้อมูลและผู้ดูแลแข็งแรง, `SEED_DEMO_DATA=false`
- [ ] ปิด Auto-response / Greeting ใน LINE OA Manager
- [ ] เปิด Webhook redelivery
- [ ] ตั้ง Backup อัตโนมัติ (ด้านล่าง)
- [ ] เปิด Firewall เฉพาะพอร์ต 80/443

---

## วิธี Backup / Restore Database

### Backup

ใช้สคริปต์ที่เตรียมไว้ (สร้างไฟล์ `.dump` ในโฟลเดอร์ `backups/` และลบไฟล์ที่เก่ากว่า 14 วัน):

```bash
./scripts/backup-db.sh
```

หรือกับฐานข้อมูลภายนอก (ต้องมี `pg_dump`):

```bash
DATABASE_URL="postgresql://user:pass@host:5432/lineoa" ./scripts/backup-db.sh
```

ตั้งเวลาสำรองทุกวันเวลา 02:30 ด้วย cron (`crontab -e`):

```
30 2 * * * cd /opt/line-oa-manager && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

> ควรคัดลอกไฟล์สำรองออกนอกเซิร์ฟเวอร์ (เช่น S3 / Google Drive) และสำรอง `.env` (โดยเฉพาะ `ENCRYPTION_KEY`) แยกไว้อย่างปลอดภัย

### Restore

Docker Compose (ไฟล์อยู่ใน `./backups` ซึ่ง mount ไว้ที่ `/backups`):

```bash
docker compose stop app
```

```bash
docker compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" /backups/lineoa-YYYYMMDD-HHMMSS.dump'
```

```bash
docker compose start app
```

ฐานข้อมูลภายนอก:

```bash
pg_restore --clean --if-exists --no-owner -d "postgresql://user:pass@host:5432/lineoa" backups/lineoa-YYYYMMDD-HHMMSS.dump
```

---

## ความปลอดภัย

| หัวข้อ | การดำเนินการ |
|---|---|
| LINE Webhook Signature | HMAC-SHA256 ของ raw body + `timingSafeEqual`, ปฏิเสธเมื่อไม่ผ่าน, rate limit คำขอลายเซ็นผิด |
| Event ซ้ำ / ตอบซ้ำ | `webhookEventId` unique, `ReplyLog.webhookEventId` unique, Push ใช้ `X-Line-Retry-Key` และ `retryKey` unique |
| SQL Injection | Prisma (parameterized) และ `$queryRaw` แบบ tagged template เท่านั้น |
| XSS | React escape อัตโนมัติ, ไม่ใช้ `dangerouslySetInnerHTML`, CSP header, Preview ไม่สร้างลิงก์จาก action |
| CSRF | Cookie `SameSite=Lax` + ตรวจ `Origin`/`Sec-Fetch-Site` ทุกคำขอที่เปลี่ยนข้อมูล + บังคับ `Content-Type: application/json` |
| Authentication | Session token สุ่ม 256-bit เก็บเฉพาะ SHA-256 ในฐานข้อมูล, httpOnly, sliding expiration, ยกเลิก session เมื่อเปลี่ยนรหัสผ่าน |
| รหัสผ่าน | bcrypt (cost 12), นโยบายรหัสผ่าน, ล็อกบัญชีชั่วคราวเมื่อผิด 5 ครั้ง, ป้องกัน user enumeration |
| Rate Limiting | Login (ต่อ IP/อีเมล), API ทั่วไป (ต่อผู้ใช้), endpoint สำคัญ, Webhook, Media |
| Validation | Zod ทุก API + Flex validator + จำกัดขนาด body |
| Authorization | สิทธิ์ตามบทบาทตรวจซ้ำที่ทุก Route Handler และทุกหน้า |
| Credentials | เข้ารหัส AES-256-GCM, ไม่ส่งไป Frontend (ส่งเฉพาะสถานะว่าตั้งค่าแล้ว), รองรับเก็บใน Environment |
| Reply Token | เข้ารหัส, ไม่อยู่ใน payload, ลบทันทีหลังใช้ และล้างอัตโนมัติหากค้างเกิน 10 นาที |
| ไฟล์อัปโหลด | JPEG/PNG เท่านั้น, ≤ 5 MB, ตรวจ magic bytes, เสิร์ฟพร้อม `nosniff` + CSP sandbox |
| URL ใน Flex | อนุญาตเฉพาะ `https:`, `line:`, `tel:` (รูปภาพต้อง HTTPS), ห้าม credentials ใน URL, ห้าม localhost/private IP |
| ReDoS | ตรวจรูปแบบ (star height, backreference, ความยาว) + รัน regex ใน `vm` ที่มี timeout 50ms + จำกัดความยาวข้อความ |
| Logs | ปิดบังคีย์อ่อนไหว (token/secret/password) อัตโนมัติ, บันทึก LINE Response เฉพาะที่จำเป็น |
| Audit Log | บันทึกการสร้าง/แก้ไข/ลบกฎ, Template, การตั้งค่า, Credentials, ผู้ใช้, การเข้าสู่ระบบ |
| HTTP Headers | CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy |

---

## การทดสอบ

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run build
```

Unit tests ครอบคลุม: การตรวจลายเซ็น Webhook, Keyword matcher (ทุกรูปแบบ + Thai normalization), ป้องกัน ReDoS (รวมการ abort regex ที่ทำงานนาน), Flex validator, URL safety, ตัวแปร Template และโมเดลของ Flex Builder

### จำลอง Webhook ในเครื่อง

```bash
npx tsx scripts/simulate-webhook.ts --text "ราคา" --url http://localhost:3000
```

(ต้องตั้ง `LINE_CHANNEL_SECRET` ให้ตรงกับระบบ — ข้อความจะถูกรับ บันทึก และจับคู่กฎ; การตอบกลับจริงจะล้มเหลวเพราะ Reply Token เป็นค่าจำลอง ซึ่งจะเห็นได้ในหน้า **ประวัติการตอบกลับ**)

---

## การแก้ไขปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| LINE Verify ได้ 503 | ยังไม่ได้ตั้งค่า Channel Secret |
| LINE Verify ได้ 401 | Channel Secret ไม่ตรงกับ Channel ที่ตั้ง Webhook |
| ข้อความเข้าแต่ไม่ตอบกลับ | ตรวจหน้า ประวัติการตอบกลับ / สถานะข้อความใน Inbox: ไม่มีกฎที่ตรง, ปิด Auto Reply, ยังไม่ตั้ง Access Token, หรือ Channel อยู่โหมด standby |
| `Invalid reply token` | ประมวลผลช้าเกิน/ใช้ซ้ำ — เปิด *Push fallback* ในตั้งค่าระบบหากต้องการ |
| LINE ตอบซ้ำ 2 ข้อความ | ปิด Auto-response messages ใน LINE Official Account Manager |
| รูปใน Flex ไม่แสดงใน LINE | URL ต้องเป็น HTTPS ที่ LINE เข้าถึงได้ (ตั้ง `APP_URL` เป็น HTTPS เมื่อใช้รูปที่อัปโหลด) |
| ถอดรหัส Credentials ไม่ได้ | เปลี่ยน `ENCRYPTION_KEY` — ให้บันทึก Credentials ใหม่ในหน้า LINE OA Settings |
| ลืมรหัสผ่าน | `npm run admin:create -- --email <อีเมล> --reset` |

---

## ข้อจำกัดและหมายเหตุ

- Rate limiter ทำงานในหน่วยความจำของแต่ละ instance — เมื่อ scale หลาย instance ควรเพิ่ม rate limit ที่ Reverse Proxy (ตัวอย่างใน `deploy/nginx.conf.example`) ส่วน Queue รองรับหลาย instance อยู่แล้ว
- ระบบออกแบบ schema ให้รองรับหลาย LINE OA แต่หน้าจอปัจจุบันจัดการบัญชีหลัก 1 บัญชี
- ข้อความในแชทกลุ่ม/ห้อง จะถูกบันทึกเป็น Event แต่ไม่ตอบกลับอัตโนมัติ
- ไฟล์ที่ลูกค้าส่ง (รูป/วิดีโอ/ไฟล์) ดึงจาก LINE Content API แบบ on-demand ซึ่ง LINE เก็บไว้ระยะเวลาจำกัด
- คอมโพเนนต์ `spacer` LINE แนะนำให้ใช้ margin/spacing แทน (ยังส่งได้ตามปกติ — Builder จะแจ้งเตือน)
