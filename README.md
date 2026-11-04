# LINE OA Auto Reply Manager

ระบบจัดการ **LINE Official Account** แบบ Web Application สำหรับรับข้อความจากลูกค้าผ่าน LINE Webhook และ **ตอบกลับอัตโนมัติด้วย Text Message หรือ Flex Message** โดยใช้ **Keyword Matching และ Rule-based Automation** (ไม่ใช้ AI, ไม่ใช้ Botnoi หรือแพลตฟอร์ม Chatbot สำเร็จรูป) พร้อมหน้าเว็บสำหรับจัดการทุกอย่างในที่เดียว

---

## สารบัญ

1. [ฟีเจอร์หลัก](#ฟีเจอร์หลัก)
2. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
3. [Technology Stack](#technology-stack)
4. [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
5. [การติดตั้ง (Development)](#การติดตั้ง-development)
6. [Environment Variables](#environment-variables)
7. [วิธีเชื่อมต่อ LINE OA](#วิธีเชื่อมต่อ-line-oa)
   - [เข้าสู่ระบบด้วย Google / LINE (Single Sign-On)](#เข้าสู่ระบบด้วย-google--line-single-sign-on)
8. [Webhook URL](#webhook-url)
9. [คู่มือการใช้งาน](#คู่มือการใช้งาน)
10. [วิธี Deploy (Production)](#วิธี-deploy-production) — Docker / Node.js / Vercel
11. [วิธี Backup / Restore Database](#วิธี-backup--restore-database)
12. [ความปลอดภัย](#ความปลอดภัย)
13. [การทดสอบ](#การทดสอบ)
14. [การแก้ไขปัญหาที่พบบ่อย](#การแก้ไขปัญหาที่พบบ่อย)
15. [ข้อจำกัดและหมายเหตุ](#ข้อจำกัดและหมายเหตุ)

---

## ฟีเจอร์หลัก

| เมนู | ความสามารถ |
|---|---|
| **เข้าสู่ระบบด้วย Google / LINE** | ปุ่ม Single Sign-On ในหน้าเข้าสู่ระบบ — ใครก็สมัครได้ด้วยคลิกเดียว **แต่ละบัญชีเห็นเฉพาะโปรเจกต์ของตัวเอง** และโปรเจกต์ที่มีคนแชร์ให้ (เพิ่มสมาชิกด้วยอีเมล/ชื่อผู้ใช้ กำหนดบทบาทได้) ผูก/ยกเลิกการผูกบัญชีได้ที่หน้า “บัญชีและผู้ใช้งาน” |
| **โปรเจกต์** (หน้าแรกหลังเข้าสู่ระบบ) | 1 โปรเจกต์ = 1 LINE OA — สร้าง/เปลี่ยนชื่อ/ลบโปรเจกต์, การ์ดแสดงสถานะการเชื่อมต่อ LINE, ตอบกลับอัตโนมัติเปิด/ปิด, จำนวนลูกค้า/กฎ/ข้อความ 7 วัน, ค้นหาและกรองตามสถานะ, สลับโปรเจกต์ได้จากแถบเมนู — กฎ ข้อความ Flex ลูกค้า และการตั้งค่า **แยกกันในแต่ละโปรเจกต์** |
| **กล่องข้อความ (Inbox)** | รายการแชท, ค้นหาลูกค้า/ข้อความ, กรองตามวันที่และประเภทข้อความ, ประวัติข้อความรายคน (รูปภาพ/สติกเกอร์/ตำแหน่ง/Postback/Flex), สถานะการตอบกลับ, **ส่งข้อความโดย Admin** (ข้อความ, Text Template, Flex Message) พร้อมกันส่งซ้ำ, อัปเดตอัตโนมัติทุก 5 วินาที |
| **ลูกค้า** | รายชื่อลูกค้า, สถานะติดตาม/บล็อก, สถิติ, โน้ตภายใน, ดึงโปรไฟล์จาก LINE |
| **ระบบตอบกลับอัตโนมัติ** | **ตอบได้หลายข้อความต่อกฎ (สูงสุด 5 — ข้อความพิมพ์เอง / Text Template / Flex ผสมกันได้)**, เพิ่ม/แก้ไข/ลบ/เปิด-ปิด/ทำสำเนากฎ, Keyword หลายคำ (AND/OR), Exact / Contains / Starts With / Ends With / Regular Expression (ป้องกัน ReDoS), Priority, ทริกเกอร์ตามเหตุการณ์ (ข้อความ, Postback, เพิ่มเพื่อน, รูปภาพ, สติกเกอร์, ตำแหน่ง), เครื่องมือทดสอบข้อความ |
| **Text Message** | สร้าง/แก้ไข/ลบข้อความ, Preview แบบแชท LINE, บันทึกเป็น Template ใหม่, ตัวแปร Dynamic `{{displayName}} {{userId}} {{date}} {{time}} {{datetime}}` |
| **Flex Message Builder** | Visual Builder 3 ส่วน (Component Panel / Editor Canvas / Live Preview), Drag & Drop, Bubble และ Carousel, Box / Text / Image / Button / Separator / Spacer, กำหนดสี ขนาดตัวอักษร ระยะห่าง Alignment Background (รวม Gradient) Border Action URL และ Postback, Duplicate / ลบ / Undo-Redo, อัปโหลดรูป, เทมเพลตเริ่มต้น, บันทึก/โหลด Template, นำเข้า/Export JSON, Validate ตาม LINE Spec และตรวจสอบกับ LINE API จริง |
| **LINE OA Settings** | คู่มือเชื่อมต่อ 5 ขั้นตอนในหน้าเว็บ, ใช้แค่ Channel ID + Channel secret (ขอ Access token ให้อัตโนมัติ), ปุ่มเชื่อมต่อคลิกเดียว (ตั้ง Webhook + ทดสอบให้เอง), ตรวจสถานะ Webhook, ลิงก์เพิ่มเพื่อน, โควตาข้อความ |
| **ตั้งค่าระบบ** | เปิด/ปิด Auto Reply, พฤติกรรมเมื่อพบหลายกฎ, Push fallback, Timezone (ค่าเริ่มต้น Asia/Bangkok), Default Reply (+cooldown), ระบบ Log และระยะเวลาเก็บข้อมูล, เปลี่ยนรหัสผ่าน, จัดการผู้ใช้และสิทธิ์, Audit Log |
| **แชททดสอบ** (ปุ่มหุ่นยนต์มุมขวาล่าง ทุกหน้า) | พิมพ์เหมือนลูกค้าใน LINE แล้วเห็นคำตอบทันที (Text / Flex) พร้อมบอกว่าตรงกับกฎไหน, จำลองส่งรูป/สติกเกอร์/ตำแหน่ง/เพิ่มเพื่อน, กดปุ่มในการ์ด Flex ได้ — ใช้กฎชุดเดียวกับของจริงแต่ **ไม่ส่งข้อความถึง LINE และไม่ใช้โควตา** |
| **โหมดมืด** | สลับ สว่าง / มืด / ตามเครื่อง ได้ที่แถบเมนูด้านซ้าย (และหน้าเข้าสู่ระบบ) จำค่าไว้ในเบราว์เซอร์ |

---

## สถาปัตยกรรมระบบ

```mermaid
flowchart LR
  U[ลูกค้า LINE] -->|ส่งข้อความ| LP[LINE Platform]
  LP -->|POST /api/webhook/line/{projectId}<br/>X-Line-Signature| WH[Webhook Route]
  WH -->|1. ตรวจลายเซ็น raw body<br/>2. กัน Event ซ้ำ webhookEventId<br/>3. บันทึกคิว| DB[(PostgreSQL)]
  WH -->|ตอบ 200 ทันที| LP
  WH -.->|after: kick| Q[Queue Worker<br/>FOR UPDATE SKIP LOCKED]
  Q --> P[Event Processor]
  P -->|ลูกค้า / ข้อความ| DB
  P --> E[Auto Reply Engine<br/>Keyword + Rules]
  E --> R[Reply Service]
  R -->|Reply API / Push API + Retry Key| LP
  R -->|ReplyLog / ข้อความขาออก| DB
  A[Admin Web<br/>Next.js App Router] -->|Route Handlers + Zod| DB
```

### ลำดับการประมวลผลข้อความ

1. **รับ Event** ที่ `POST /api/webhook/line/{projectId}` ของแต่ละโปรเจกต์ (URL เดิม `/api/webhook/line` ใช้กับโปรเจกต์หลัก, จำกัดขนาด 1 MB)
2. **ตรวจสอบ Signature** — HMAC-SHA256 ของ *raw body* ด้วย Channel Secret ของโปรเจกต์นั้น เปรียบเทียบแบบ constant-time; ไม่ผ่าน = 401 และไม่บันทึกอะไร
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
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix UI), Lucide Icons, TanStack Query, dnd-kit, Sonner |
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
  (dashboard)/            หน้าจัดการทั้งหมด (ต้องเข้าสู่ระบบ)
    (account)/projects/   รายการโปรเจกต์ (หน้าแรก)
    (account)/settings/   บัญชีและผู้ใช้งาน (ใช้ร่วมกันทุกโปรเจกต์)
    p/[projectId]/        หน้าภายในโปรเจกต์: inbox/ customers/ auto-reply/
                          text-messages/ flex-builder/ line-settings/ settings/
  login/                  หน้าเข้าสู่ระบบ
  api/
    webhook/line/[projectId]/  ★ LINE Webhook Endpoint ของแต่ละโปรเจกต์ (webhook/line = URL เดิมของโปรเจกต์หลัก)
    projects/             สร้าง/แก้ไข/ลบโปรเจกต์
    auth/ conversations/ customers/ messages/ rules/
    text-templates/ flex-templates/ media/ line/
    settings/ users/ audit-logs/ health/
components/
  ui/                     shadcn/ui components
  layout/ common/         Sidebar, สถานะ Loading/Empty/Error ฯลฯ
  projects/ inbox/ customers/ auto-reply/ text-messages/ test-chat/
  flex/                   Flex Message Preview renderer
  flex-builder/           Visual Flex Message Builder (model, canvas, inspector)
  line-settings/ settings/
lib/
  api/handler.ts          Route wrapper: Auth, สิทธิ์, CSRF, Rate limit, Error handling
                          + projectRoute() ระบุโปรเจกต์ด้วย header x-project-id (หน้าเว็บส่งให้อัตโนมัติ)
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
  project.service.ts settings.service.ts line-account.service.ts maintenance.service.ts
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
| `Project` (ตาราง `LineAccount`) | โปรเจกต์ = 1 บัญชี LINE OA: ชื่อ, การตั้งค่าของโปรเจกต์, Credentials ที่เข้ารหัส AES-256-GCM (`botUserId` unique → 1 LINE OA ต่อ 1 โปรเจกต์) |
| `Customer` | ลูกค้า LINE (`@@unique([projectId, lineUserId])`) |
| `Message` | ข้อความขาเข้า/ขาออก (index ตามลูกค้า/เวลา, GIN trigram สำหรับค้นหา) |
| `WebhookEvent` | คิว + ป้องกัน Event ซ้ำ (`webhookEventId` unique) |
| `ReplyRule`, `ReplyKeyword`, `ReplyRuleMessage` | กฎตอบกลับ, Keyword และข้อความตอบกลับของกฎ (หลายข้อความเรียงตาม `position`) — กฎเป็นของโปรเจกต์ |
| `ReplyTemplate`, `FlexTemplate` | Text Template และ Flex Template (เป็นของโปรเจกต์) |
| `ReplyLog` | บันทึกการตอบกลับเบื้องหลัง — แสดงสถานะ/ข้อผิดพลาดใต้ข้อความใน Inbox (`webhookEventId` unique กันตอบซ้ำ, `retryKey` unique กัน Push ซ้ำ) |
| `SystemSetting` | การตั้งค่าที่ใช้ร่วมกันทุกโปรเจกต์ เช่น ระบบ Log (key-value ตรวจสอบด้วย Zod) |
| `AuditLog` | บันทึกการแก้ไขกฎ/การตั้งค่า/การเข้าสู่ระบบ |
| `MediaAsset` | รูปภาพที่อัปโหลดสำหรับ Flex Message |

ทุกตารางใช้ **UUID** (UUIDv7 สำหรับตารางข้อมูลจำนวนมาก), มี `createdAt` / `updatedAt` (timestamptz), Foreign Key, Unique Constraint และ Index ที่จำเป็น

---

## การติดตั้ง (Development)

### ความต้องการ

- Node.js **22.x** (เวอร์ชันที่ทดสอบแล้ว และใช้ใน Docker/Vercel)
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

แก้ไข `.env` อย่างน้อย `DATABASE_URL`, `ENCRYPTION_KEY`, `APP_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` — สร้าง `ENCRYPTION_KEY` ด้วย:

```bash
openssl rand -base64 32
```

สร้างตารางในฐานข้อมูล (Migration):

```bash
npx prisma migrate deploy
```

สร้างข้อมูลตัวอย่าง (Template, Flex, กฎตอบกลับ):

```bash
npm run db:seed
```

เริ่มเซิร์ฟเวอร์:

```bash
npm run dev
```

เปิด http://localhost:3000 แล้วเข้าสู่ระบบด้วย **ชื่อผู้ใช้** `ADMIN_USERNAME` และ**รหัสผ่าน** `ADMIN_PASSWORD` ที่ตั้งไว้ใน `.env` (ไม่ต้องใช้อีเมล)

> ต้องการข้อมูลลูกค้าและสถิติจำลองสำหรับทดสอบหน้าจอ: ตั้ง `SEED_DEMO_DATA="true"` ก่อนรัน seed (ไม่ควรใช้ใน Production)

> ทดสอบ Webhook ในเครื่องโดยต้องให้ LINE เข้าถึงได้ ให้ใช้ HTTPS tunnel เช่น `cloudflared tunnel --url http://localhost:3000` หรือ `ngrok http 3000` แล้วตั้ง `APP_URL` เป็น URL ที่ได้

### ผู้ดูแลหลักและผู้ใช้เพิ่มเติม

- **ผู้ดูแลหลัก (OWNER)** มาจาก `ADMIN_USERNAME` + `ADMIN_PASSWORD` ใน Environment โดยตรง — ระบบสร้างบัญชีให้อัตโนมัติตอนเข้าสู่ระบบครั้งแรก
- **เปลี่ยนรหัสผ่าน/ชื่อผู้ใช้ของผู้ดูแลหลัก:** แก้ค่าใน `.env` (หรือ Vercel) แล้ว restart/redeploy — session เดิมจะถูกออกจากระบบ
- **ผู้ใช้ทั่วไป:** เข้าสู่ระบบด้วย Google / LINE ได้เลย (ดู [Single Sign-On](#เข้าสู่ระบบด้วย-google--line-single-sign-on)) — แต่ละคนมีโปรเจกต์ของตัวเอง
- **เพิ่มผู้ใช้แบบรหัสผ่าน:** หน้า **บัญชีและผู้ใช้งาน → ผู้ใช้งาน** (กำหนดชื่อผู้ใช้/อีเมล รหัสผ่าน และสิทธิ์) หรือใช้คำสั่ง

```bash
npm run admin:create -- --username somchai --name "สมชาย" --role ADMIN
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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | | (ไม่บังคับ) เปิดปุ่ม “เข้าสู่ระบบด้วย Google” — สร้างที่ Google Cloud Console |
| `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` | | (ไม่บังคับ) เปิดปุ่ม “เข้าสู่ระบบด้วย LINE” — ใช้ช่อง **LINE Login** (คนละช่องกับ Messaging API) |
| `AUTH_ALLOW_SIGNUP` | | `true` (ค่าเริ่มต้น) = ใครก็สมัครด้วย Google/LINE ได้, `false` = เฉพาะบัญชีที่มีในระบบหรือผูกไว้แล้ว |
| `PRIVACY_CONTACT_EMAIL` | | (ไม่บังคับ) อีเมลติดต่อที่แสดงในหน้า `/privacy` (หน้านโยบายความเป็นส่วนตัวที่ Google ต้องใช้ตอน Publish app) |
| `COOKIE_SECURE` | | `auto` / `true` / `false` |
| `TRUST_PROXY` | | `true` เมื่ออยู่หลัง Reverse Proxy (อ่าน IP จาก X-Forwarded-For) |
| `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` | | (ไม่บังคับ) ใช้กับ **โปรเจกต์หลัก** เท่านั้น ถ้ากำหนด จะใช้แทนค่าที่กรอกในหน้าเว็บ — โปรเจกต์อื่นกรอกในหน้า LINE OA Settings ของโปรเจกต์นั้น |
| `LINE_CHANNEL_ACCESS_TOKEN` | | (ไม่บังคับ) token แบบ long-lived — ถ้าไม่ตั้ง ระบบขอ token จาก LINE ให้อัตโนมัติ |
| `DATABASE_URL_UNPOOLED` | | (ไม่บังคับ) connection แบบ direct สำหรับ migration เมื่อ `DATABASE_URL` เป็น pooler (Neon/Vercel) |
| `CRON_SECRET` | Vercel | รหัสสำหรับเรียก `/api/cron/maintenance` (Vercel Cron ส่งให้อัตโนมัติ) |
| `QUEUE_WORKER_ENABLED` | | เปิด Background Worker (ค่าเริ่มต้น `true`, ปิดอัตโนมัติบน Vercel) |
| `QUEUE_POLL_INTERVAL_MS` | | ความถี่ตรวจคิว (ค่าเริ่มต้น 3000) |
| `LOG_LEVEL` | | ระดับ Log เริ่มต้น |
| `ADMIN_USERNAME` | ✅ | ชื่อผู้ใช้ของผู้ดูแลหลักสำหรับเข้าสู่ระบบ (a-z, 0-9, `.`, `_`, `-` ยาว 3-50 ตัว) |
| `ADMIN_PASSWORD` | ✅ | รหัสผ่านของผู้ดูแลหลัก (อย่างน้อย 8 ตัวอักษร) — แก้แล้ว restart/redeploy เพื่อเปลี่ยนรหัส |
| `ADMIN_NAME` / `ADMIN_EMAIL` | | ชื่อที่แสดง / อีเมล (ถ้าไม่ตั้ง `ADMIN_USERNAME` จะใช้อีเมลเข้าสู่ระบบแทน) |
| `SEED_DEMO_DATA` | | สร้างข้อมูลจำลองตอน seed |
| `LINE_API_BASE_URL` / `LINE_DATA_API_BASE_URL` | | ใช้กับ Mock/Staging เท่านั้น (ค่าเริ่มต้นคือ LINE API จริง) |

---

## วิธีเชื่อมต่อ LINE OA

**1 โปรเจกต์เชื่อมต่อ LINE OA ได้ 1 บัญชี** — ถ้ามีหลาย LINE OA ให้สร้างโปรเจกต์ละบัญชีที่หน้า **โปรเจกต์** (หน้าแรกหลังเข้าสู่ระบบ) แล้วกด **เชื่อมต่อ LINE OA** บนการ์ดของโปรเจกต์ (LINE OA เดียวกันเชื่อมกับ 2 โปรเจกต์ไม่ได้)

ทำครั้งเดียวต่อโปรเจกต์ ประมาณ 5 นาที — ในเว็บมีหน้า **LINE OA Settings** ของแต่ละโปรเจกต์ที่อธิบายทีละขั้นพร้อมปุ่มลัด และตรวจสถานะให้อัตโนมัติ

**ขั้นตอนที่ 1 — เปิดใช้ Messaging API** (ใน [LINE Official Account Manager](https://manager.line.biz))
1. เลือกบัญชี LINE OA → กด **ตั้งค่า** (Settings) มุมขวาบน → เมนูซ้าย **Messaging API**
2. กด **เปิดใช้ Messaging API** → เลือกหรือสร้าง **Provider** (ตั้งชื่ออะไรก็ได้ เช่น ชื่อร้าน) → ช่อง Privacy policy/Terms เว้นว่างได้ → **ตกลง**

**ขั้นตอนที่ 2 — คัดลอก 2 ค่า** ในหน้า Messaging API เดิม: **Channel ID** (ตัวเลข ~10 หลัก) และ **Channel secret** (32 ตัวอักษร) แล้ววางในหน้า **LINE OA Settings** ของระบบ
(หาไม่เจอ: [LINE Developers Console](https://developers.line.biz/console/) → Provider → Channel → แท็บ **Basic settings**)

> ไม่ต้องออก Channel access token เอง — ระบบขอ token อายุ 15 นาทีจาก LINE ให้อัตโนมัติด้วย Channel ID + Channel secret และต่ออายุเอง (ถ้าต้องการใช้ token แบบ long-lived ยังกรอกได้ที่ “ตัวเลือกขั้นสูง”)

**ขั้นตอนที่ 3 — กดปุ่ม “เชื่อมต่อ LINE OA”** ระบบจะทำให้อัตโนมัติ: บันทึกข้อมูล (เข้ารหัส) → ขอ Access token → ตรวจสอบบัญชี → **ตั้ง Webhook URL ที่ LINE ให้เอง** → ให้ LINE ทดสอบส่งข้อความมา → ตรวจว่าเปิด Webhook แล้ว แต่ละขั้นแสดงผลพร้อมวิธีแก้ถ้าไม่สำเร็จ

**ขั้นตอนที่ 4 — ตั้งค่าการตอบกลับ** (LINE OA Manager → ตั้งค่า → **การตอบกลับ** / Response settings)
- เปิด **Webhook** (หน้าเว็บของระบบจะยืนยันให้ว่าเปิดแล้ว)
- ปิด **ข้อความตอบกลับอัตโนมัติ** (Auto-response) — ไม่งั้นลูกค้าได้คำตอบซ้ำ 2 ข้อความ
- ปิด **ข้อความทักทาย** (Greeting) ถ้าจะใช้กฎ “ต้อนรับเพื่อนใหม่” ของระบบนี้
- สวิตช์ **แชท** เปิดหรือปิดก็ได้

**ขั้นตอนที่ 5 — ทดสอบ** เพิ่ม LINE OA เป็นเพื่อน (มีลิงก์เพิ่มเพื่อนในหน้าเว็บ) → กดปุ่ม **สร้างกฎทดสอบ** (สร้างให้ 2 กฎอัตโนมัติ กดซ้ำได้) → พิมพ์ `test` หรือ `ทดสอบ` จะได้ข้อความธรรมดา และพิมพ์ `TestFlex` จะได้การ์ด Flex Message ชื่อ “TestFlex” — หน้าเว็บจะแสดงทันทีเมื่อได้รับข้อความแรก (ทดสอบเสร็จแล้วปิดหรือลบกฎได้ที่หน้าระบบตอบกลับอัตโนมัติ และแก้หน้าตาการ์ด TestFlex ได้ใน Flex Message Builder)

> ทางเลือก (เฉพาะโปรเจกต์หลัก): กำหนดผ่าน Environment `LINE_CHANNEL_ID` + `LINE_CHANNEL_SECRET` (และ `LINE_CHANNEL_ACCESS_TOKEN` ถ้าต้องการ) แทนการกรอกในหน้าเว็บ — ค่าจาก Environment มีลำดับความสำคัญสูงกว่า

### เข้าสู่ระบบด้วย Google / LINE (Single Sign-On)

หน้าเข้าสู่ระบบจะมีปุ่ม **เข้าสู่ระบบด้วย Google** และ **เข้าสู่ระบบด้วย LINE** เมื่อตั้งค่า Environment Variable ของผู้ให้บริการนั้นแล้ว (ไม่ตั้ง = ไม่แสดงปุ่ม)

**การทำงาน**
- กดปุ่มครั้งแรก = สมัครอัตโนมัติ — บัญชีใหม่ยังไม่มีโปรเจกต์ กด **สร้างโปรเจกต์แรก** ได้เลย
- **แต่ละบัญชีเห็นเฉพาะโปรเจกต์ที่ตัวเองเป็นสมาชิก** — ผู้สร้างเป็น “เจ้าของ” และเพิ่มคนอื่นได้ที่ **ตั้งค่าโปรเจกต์ → สมาชิก** (ใส่อีเมลหรือชื่อผู้ใช้ ซึ่งดูได้ที่หน้า “บัญชีและผู้ใช้งาน” ของคนนั้น)
- บัญชีที่มีอยู่แล้ว (เช่น ผู้ดูแลหลัก) กด **ผูกบัญชี Google / LINE** ได้ที่ **บัญชีและผู้ใช้งาน → บัญชีของฉัน** แล้วเข้าสู่ระบบด้วยปุ่มนั้นได้เลย
- ถ้าอีเมลที่ Google ยืนยันแล้วตรงกับบัญชีที่มีอยู่ ระบบจะผูกให้อัตโนมัติ (บัญชี LINE ไม่ส่งอีเมล จึงระบุตัวตนด้วย LINE user ID และได้ชื่อผู้ใช้อัตโนมัติ เช่น `line.ab12c`)
- ผู้ดูแลหลัก (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) ยังเข้าด้วยรหัสผ่านได้เสมอ — กด “เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน” ใต้ปุ่ม

**ตั้งค่า Google** ([Google Cloud Console](https://console.cloud.google.com/))
1. สร้างหรือเลือกโปรเจกต์ → **APIs & Services → OAuth consent screen** → เลือก **External** → กรอกชื่อแอปและอีเมลติดต่อ → บันทึก
2. **Credentials → Create credentials → OAuth client ID** → ประเภท **Web application**
3. **Authorized redirect URIs** ใส่ `https://<โดเมนของคุณ>/api/auth/oauth/google/callback` (เช่น `https://xxx.vercel.app/api/auth/oauth/google/callback`)
4. คัดลอก **Client ID** และ **Client secret** ไปใส่ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` แล้ว Redeploy
5. ถ้าหน้า OAuth consent screen ยังเป็น **Testing** จะเข้าได้เฉพาะอีเมลที่เพิ่มไว้ใน *Test users* — จะเปิดให้ทุกคนต้องกรอกหน้า **Branding** ให้ครบก่อนกด **Publish app**:
   - Application home page: `https://<โดเมนของคุณ>`
   - Application privacy policy link: `https://<โดเมนของคุณ>/privacy` (ระบบมีหน้านี้ให้แล้ว)
   - Application Terms of Service link: `https://<โดเมนของคุณ>/terms`
   - Authorised domains: `<โดเมนของคุณ>` เช่น `xxx.vercel.app` · **ไม่ต้องอัปโหลดโลโก้** (ใส่แล้วต้องส่งตรวจ)
   - ตั้ง `PRIVACY_CONTACT_EMAIL` เพื่อแสดงอีเมลติดต่อในหน้านโยบายความเป็นส่วนตัว (ไม่บังคับ)

**ตั้งค่า LINE Login** ([LINE Developers Console](https://developers.line.biz/console/))
1. เลือก Provider (จะใช้ Provider เดียวกับ LINE OA ก็ได้) → **Create a new channel → LINE Login** → App types เลือก **Web app**
2. แท็บ **LINE Login** → **Callback URL** ใส่ `https://<โดเมนของคุณ>/api/auth/oauth/line/callback`
3. แท็บ **Basic settings** → คัดลอก **Channel ID** และ **Channel secret** ไปใส่ `LINE_LOGIN_CHANNEL_ID` / `LINE_LOGIN_CHANNEL_SECRET` แล้ว Redeploy
4. เปลี่ยนสถานะช่องจาก **Developing** เป็น **Published** (ตอน Developing เข้าได้เฉพาะผู้ดูแลช่อง)

> ช่อง LINE Login เป็น **คนละช่อง** กับ Messaging API ของ LINE OA — ห้ามใช้ Channel ID/secret ของ Messaging API แทน
> เข้าสู่ระบบด้วย Google/LINE ต้องเปิดเว็บผ่านโดเมนเดียวกับ `APP_URL` (บน Vercel = โดเมน Production) เพราะ Callback URL ต้องตรงกับที่ลงทะเบียนไว้

### Webhook URL

```
https://<โดเมนของคุณ>/api/webhook/line/<รหัสโปรเจกต์>
```

แต่ละโปรเจกต์มี URL ของตัวเอง (ดูได้ที่หน้า LINE OA Settings ของโปรเจกต์) — URL เดิม `https://<โดเมนของคุณ>/api/webhook/line` ยังใช้ได้กับ **โปรเจกต์หลัก** (โปรเจกต์ที่มีดาว ★) จึงไม่ต้องแก้ค่าที่ตั้งไว้ใน LINE ก่อนหน้านี้

ปกติไม่ต้องตั้งเอง เพราะปุ่ม **เชื่อมต่อ LINE OA** ตั้งให้อัตโนมัติ ถ้าต้องการตั้งเองใน LINE Developers Console: แท็บ **Messaging API** → *Webhook settings* → **Edit** → วาง URL → **Verify** → เปิด **Use webhook** และแนะนำให้เปิด **Webhook redelivery** (ระบบกัน Event ซ้ำด้วย `webhookEventId` อยู่แล้ว)

ข้อกำหนด: LINE ส่ง Webhook ได้เฉพาะ **HTTPS ที่มีใบรับรองถูกต้อง** เท่านั้น (บน Vercel ใช้โดเมน `.vercel.app` ได้เลย)

---

## คู่มือการใช้งาน

### สร้างกฎตอบกลับ

1. (ไม่บังคับ) สร้างข้อความที่ใช้ซ้ำได้ที่เมนู **Text Message** หรือ Flex ที่เมนู **Flex Message Builder** — ข้อความธรรมดาพิมพ์ในกฎได้เลย
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

5. ใส่ **ข้อความตอบกลับ** ได้ **สูงสุด 5 ข้อความ** (ข้อจำกัดของ LINE ต่อการตอบกลับ 1 ครั้ง) ส่งเรียงตามลำดับ — แบ่งข้อความยาวเป็นหลายข้อความสั้น ๆ ได้
   - แต่ละข้อความเลือกได้ว่าเป็น **ข้อความ** (พิมพ์เองพร้อมตัวแปร หรือเลือก Text Template) หรือ **Flex Message**
   - เลื่อนขึ้น/ลง ลบ และดูตัวอย่างทุกข้อความแบบแชท LINE ได้ในฟอร์ม
   - จำนวนข้อความรวมต่อการตอบกลับไม่เกินค่า “จำนวนข้อความสูงสุดต่อการตอบกลับ” ใน ตั้งค่าโปรเจกต์ (ส่วนเกินจะไม่ถูกส่ง และมีหมายเหตุในผลทดสอบ)
6. กำหนด **Priority** (ค่ามากถูกตรวจก่อน)
7. ใช้ปุ่ม **ทดสอบข้อความ** หรือ **แชททดสอบ** เพื่อดูว่าข้อความจะตรงกฎใดและตอบอะไร (ไม่ส่งข้อความจริง)

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

### แชททดสอบ (ทดสอบในเว็บก่อนใช้งานจริง)

กดปุ่มหุ่นยนต์สีเขียวที่มุมขวาล่าง แล้วพิมพ์ข้อความเหมือนเป็นลูกค้า เช่น `test` หรือ `TestFlex`

- คำตอบมาจากเครื่องมือตอบกลับตัวเดียวกับ Webhook จริง (`POST /api/rules/test`) — แสดงทั้ง Text และ Flex Message พร้อมบอกว่าตรงกับกฎ/คีย์เวิร์ดไหน หรือใช้ Default Reply
- ปุ่มด้านล่างใช้จำลองการส่งรูปภาพ สติกเกอร์ ตำแหน่ง และปุ่มรูปคนใช้จำลองการเพิ่มเพื่อน (Follow)
- ปุ่มในการ์ด Flex กดได้: แบบ message จะส่งข้อความนั้น, แบบ postback จะส่ง Postback, แบบลิงก์จะเปิดแท็บใหม่
- ไม่ส่งข้อความถึง LINE ไม่สร้างลูกค้า/ประวัติ และไม่ใช้โควตาข้อความ — ถ้าปิด Auto Reply ไว้ จะมีแถบเตือนว่าลูกค้าจริงจะไม่ได้รับคำตอบ

### ส่งข้อความโดย Admin (Inbox)

ใช้ **Push API** ซึ่งนับรวมโควตาข้อความรายเดือนของ LINE OA และส่งได้เฉพาะลูกค้าที่ยังเป็นเพื่อนอยู่ ระบบใช้ `X-Line-Retry-Key` ป้องกันการส่งซ้ำเมื่อกดซ้ำหรือเครือข่ายขัดข้อง

### โปรเจกต์

- หน้าแรกหลังเข้าสู่ระบบคือรายการ **โปรเจกต์** — กด **สร้างโปรเจกต์** → ตั้งชื่อ → ระบบพาไปหน้าเชื่อมต่อ LINE OA ของโปรเจกต์นั้นทันที
- ภายในโปรเจกต์ เมนูด้านซ้ายทั้งหมด (กล่องข้อความ ลูกค้า กฎ Text/Flex LINE OA Settings ตั้งค่าโปรเจกต์) เป็นข้อมูลของโปรเจกต์นั้นเท่านั้น — สลับโปรเจกต์ได้จากกล่องชื่อโปรเจกต์ด้านบนของเมนู
- **ตั้งค่าโปรเจกต์**: เปิด/ปิดตอบกลับอัตโนมัติ, พฤติกรรมเมื่อพบหลายกฎ, Default Reply, Timezone ฯลฯ แยกกันแต่ละโปรเจกต์
- **สมาชิก** (ตั้งค่าโปรเจกต์ → สมาชิก): เห็นโปรเจกต์ได้เฉพาะสมาชิก — เพิ่มด้วยอีเมลหรือชื่อผู้ใช้ เลือกบทบาท เจ้าของ / ผู้ดูแล / เจ้าหน้าที่ และออกจากโปรเจกต์เองได้ (เจ้าของคนสุดท้ายออกไม่ได้)
- **หน้าโปรเจกต์** กรองได้ว่า “ของฉัน” (เป็นเจ้าของ) หรือ “แชร์กับฉัน”
- **บัญชีและผู้ใช้งาน** (เมนูผู้ใช้): บัญชีของฉัน (ผูก Google/LINE, รหัสผ่าน) และสำหรับผู้ดูแลระบบ: ผู้ใช้งาน, Audit Log, ระบบ Log
- **ลบโปรเจกต์** (เฉพาะเจ้าของโปรเจกต์) ต้องพิมพ์ชื่อโปรเจกต์ยืนยัน — ลูกค้า ข้อความ กฎ และ Template ของโปรเจกต์ถูกลบถาวร
- อัปเกรดจากเวอร์ชันก่อน: ผู้ใช้เดิมทุกคนเป็นสมาชิกของโปรเจกต์เดิมด้วยบทบาทเดิม และ migration ย้ายข้อมูลเดิมทั้งหมด (ลูกค้า ข้อความ กฎ Template การตั้งค่า) เข้า **โปรเจกต์หลัก** ให้อัตโนมัติ และลิงก์เดิม เช่น `/inbox` จะพาไปหน้าเดียวกันของโปรเจกต์หลัก

### สิทธิ์ผู้ใช้

สิทธิ์ภายในโปรเจกต์ดูจาก **บทบาทในโปรเจกต์นั้น** (คนเดียวกันเป็นเจ้าของโปรเจกต์หนึ่ง และเป็นเจ้าหน้าที่อีกโปรเจกต์ได้)

| บทบาทในโปรเจกต์ | สิทธิ์ |
|---|---|
| เจ้าของ (OWNER) | ทุกอย่าง รวมถึงเชื่อม LINE OA (Credentials), ให้สิทธิ์เจ้าของ, ลบโปรเจกต์ |
| ผู้ดูแล (ADMIN) | จัดการกฎ, Template, Flex, ตั้งค่าโปรเจกต์, เปลี่ยนชื่อโปรเจกต์, เพิ่ม/นำสมาชิกออก (ยกเว้นเจ้าของ) |
| เจ้าหน้าที่ (AGENT) | Inbox (ส่งข้อความ), ลูกค้า, ดูกฎ/Template, แชททดสอบ |

บทบาทระดับระบบ (บัญชี): **ผู้ดูแลระบบสูงสุด** (ผู้ดูแลหลักจาก Environment) จัดการผู้ใช้ทั้งระบบและดู Audit Log ได้ · **ผู้ดูแลระบบ** ตั้งค่าระบบ Log ได้ · **ผู้ใช้ทั่วไป** (บัญชีที่สมัครด้วย Google/LINE) สร้างและจัดการเฉพาะโปรเจกต์ของตัวเอง — ผู้ดูแลระบบก็ไม่เห็นโปรเจกต์ที่ตัวเองไม่ได้เป็นสมาชิก

---|---|
| OWNER | ทุกอย่าง รวมถึง LINE Credentials, ลบโปรเจกต์, จัดการผู้ใช้, Audit Log |
| ADMIN | สร้าง/เปลี่ยนชื่อโปรเจกต์, จัดการกฎ, Template, Flex, ตั้งค่าโปรเจกต์ |
| AGENT | Inbox (ส่งข้อความ), ลูกค้า, ดูกฎ/Template, แชททดสอบ |

---

## วิธี Deploy (Production)

### วิธีที่ 1: Docker Compose (แนะนำ)

ต้องมี Docker 24+ และ Docker Compose v2 บนเซิร์ฟเวอร์ และชี้ DNS ของโดเมนมาที่เซิร์ฟเวอร์

```bash
cp .env.example .env
```

แก้ไข `.env`: `POSTGRES_PASSWORD`, `ENCRYPTION_KEY`, `APP_URL=https://<โดเมน>`, `DOMAIN=<โดเมน>`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` (ค่า `DATABASE_URL` ใน compose ถูกสร้างจาก POSTGRES_* ให้อัตโนมัติ)

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
docker compose run --rm migrate npm run admin:create -- --username somchai --role ADMIN
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

### วิธีที่ 3: Vercel + Neon (ฟรี — เหมาะกับงานเดโม / ส่งงาน)

> ⚠️ Vercel แพ็กเกจฟรี (Hobby) ใช้ได้เฉพาะงาน**ส่วนตัวที่ไม่ใช่เชิงพาณิชย์** — ถ้าจะใช้กับ LINE OA ของธุรกิจจริง ให้ใช้ Vercel Pro หรือวิธีที่ 1/2

ระบบปรับให้ทำงานบน Serverless อัตโนมัติเมื่อตรวจพบ Vercel:
- Webhook ประมวลผลข้อความทันทีหลังตอบ LINE ด้วย `after()` และรอ retry ที่ถึงเวลาภายใน 45 วินาที
- ปิด Background Worker แบบวนลูป (ใช้ไม่ได้บน Serverless) และใช้ **Vercel Cron** เรียก `/api/cron/maintenance` วันละครั้งแทน (กู้งานค้าง, ประมวลผลคิว, ลบข้อมูลตามระยะเวลาเก็บ)
- ตอน build บน **Production** จะรัน `prisma migrate deploy` และ seed ให้อัตโนมัติ (Preview deployment จะไม่แก้ฐานข้อมูล)
- ถ้าไม่ได้ตั้ง `APP_URL` จะใช้โดเมน `xxx.vercel.app` ของโปรเจกต์อัตโนมัติ
- Function รันที่ region สิงคโปร์ (`sin1`) ใกล้ผู้ใช้ในไทย

**ขั้นตอน**

1. Push โค้ดขึ้น GitHub แล้วเข้า [vercel.com](https://vercel.com) → **Add New → Project** → เลือก repository (Vercel จะอ่านค่าจาก `vercel.json` เอง ไม่ต้องแก้ Build Command)
2. สร้างฐานข้อมูล: ในหน้าโปรเจกต์ Vercel → **Storage → Create Database → Neon** (เลือก region Singapore) แล้วเชื่อมกับโปรเจกต์ — Vercel จะเพิ่ม `DATABASE_URL` และ `DATABASE_URL_UNPOOLED` ให้อัตโนมัติ
   (หรือสมัคร [Neon](https://neon.com) เอง แล้วใส่ connection string แบบ pooled เป็น `DATABASE_URL` และแบบ direct เป็น `DATABASE_URL_UNPOOLED`)
3. **Settings → Environment Variables** เพิ่มค่าต่อไปนี้ (Environment: Production)

   | ตัวแปร | ค่า |
   |---|---|
   | `ENCRYPTION_KEY` | ผลลัพธ์จาก `openssl rand -base64 32` (เก็บสำรองไว้ ห้ามเปลี่ยนภายหลัง) |
   | `CRON_SECRET` | ผลลัพธ์จาก `openssl rand -hex 24` |
   | `ADMIN_USERNAME` | ชื่อผู้ใช้สำหรับเข้าสู่ระบบ เช่น `admin` (a-z, 0-9, `.`, `_`, `-`) |
   | `ADMIN_PASSWORD` | รหัสผ่านอย่างน้อย 8 ตัวอักษร (ต้องเก็บไว้ — ใช้ทุกครั้งที่เข้าสู่ระบบ) |
   | `APP_URL` | (ไม่บังคับ) ใส่เมื่อใช้โดเมนของตัวเอง เช่น `https://bot.example.com` |

4. กด **Deploy** (ถ้าเพิ่มตัวแปรหลังจาก deploy ไปแล้ว ให้กด **Redeploy**) — ดู Build Logs จะเห็นขั้นตอน migrate และ seed
5. เปิด `https://<ชื่อโปรเจกต์>.vercel.app` เข้าสู่ระบบด้วย `ADMIN_USERNAME` / `ADMIN_PASSWORD` แล้วทำตามคู่มือในหน้า **LINE OA Settings** (ดู [วิธีเชื่อมต่อ LINE OA](#วิธีเชื่อมต่อ-line-oa))

**(ไม่บังคับ) ให้ระบบส่งซ้ำ/กู้งานค้างถี่ขึ้น** — Vercel Cron แพ็กเกจฟรีรันได้วันละครั้ง สามารถใช้บริการ Cron ภายนอกที่ฟรี เช่น [cron-job.org](https://cron-job.org) ให้เรียกทุก 5–10 นาที:

```
GET https://<โดเมน>/api/cron/maintenance
Authorization: Bearer <CRON_SECRET>
```

**ข้อจำกัดบน Vercel**
- อัปโหลดรูปได้ไม่เกิน 4 MB และเปิดไฟล์ที่ลูกค้าส่งผ่านหน้า Inbox ได้ไม่เกิน 4 MB (ข้อจำกัด 4.5 MB ของ Vercel Functions)
- Rate limit ทำงานแยกตามแต่ละ instance
- Neon แพ็กเกจฟรีจะหยุดพักเมื่อไม่มีการใช้งาน 5 นาที ข้อความแรกหลังพักอาจช้าขึ้นเล็กน้อย

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
| Rate Limiting | Login (ต่อ IP/ชื่อผู้ใช้), API ทั่วไป (ต่อผู้ใช้), endpoint สำคัญ, Webhook, Media |
| Validation | Zod ทุก API + Flex validator + จำกัดขนาด body |
| Authorization | ตรวจสมาชิกภาพของโปรเจกต์ + สิทธิ์ตามบทบาทในโปรเจกต์ซ้ำที่ทุก Route Handler และทุกหน้า (ไม่ใช่สมาชิก = 404 ไม่เปิดเผยว่ามีโปรเจกต์อยู่) |
| Single Sign-On | OpenID Connect Authorization Code + **PKCE (S256)** + `state` + `nonce` เก็บใน cookie ที่เข้ารหัส อายุ 10 นาที และลบทิ้งหลังใช้ (code ใช้ซ้ำไม่ได้), ตรวจลายเซ็น ID Token (Google: RS256 จาก JWKS, LINE: HS256) และตรวจ `iss`/`aud`/`exp`/`nonce`, ไม่ยอมรับ `alg` อื่น, กัน open redirect, ไม่เก็บ access token ของผู้ให้บริการ, ใช้อีเมลจับคู่บัญชีเฉพาะอีเมลที่ Google ยืนยันแล้ว |
| Credentials | เข้ารหัส AES-256-GCM, ไม่ส่งไป Frontend (ส่งเฉพาะสถานะว่าตั้งค่าแล้ว), รองรับเก็บใน Environment |
| Reply Token | เข้ารหัส, ไม่อยู่ใน payload, ลบทันทีหลังใช้ และล้างอัตโนมัติหากค้างเกิน 10 นาที |
| ไฟล์อัปโหลด | JPEG/PNG เท่านั้น, ≤ 4 MB, ตรวจ magic bytes, เสิร์ฟพร้อม `nosniff` + CSP sandbox |
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

(ต้องตั้ง `LINE_CHANNEL_SECRET` ให้ตรงกับระบบ — ข้อความจะถูกรับ บันทึก และจับคู่กฎ; การตอบกลับจริงจะล้มเหลวเพราะ Reply Token เป็นค่าจำลอง ซึ่งจะเห็นข้อผิดพลาดใต้ข้อความในหน้า **กล่องข้อความ**)

---

## การแก้ไขปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| LINE Verify ได้ 503 | ยังไม่ได้ตั้งค่า Channel Secret |
| LINE Verify ได้ 401 | Channel Secret ไม่ตรงกับ Channel ที่ตั้ง Webhook |
| ข้อความเข้าแต่ไม่ตอบกลับ | ดูสถานะ/ข้อผิดพลาดใต้ข้อความในหน้ากล่องข้อความ หรือพิมพ์ข้อความเดียวกันในแชททดสอบ: ไม่มีกฎที่ตรง, ปิด Auto Reply, ยังไม่ตั้ง Access Token, หรือ Channel อยู่โหมด standby |
| `Invalid reply token` | ประมวลผลช้าเกิน/ใช้ซ้ำ — เปิด *Push fallback* ในตั้งค่าระบบหากต้องการ |
| LINE ตอบซ้ำ 2 ข้อความ | ปิด Auto-response messages ใน LINE Official Account Manager |
| รูปใน Flex ไม่แสดงใน LINE | URL ต้องเป็น HTTPS ที่ LINE เข้าถึงได้ (ตั้ง `APP_URL` เป็น HTTPS เมื่อใช้รูปที่อัปโหลด) |
| ถอดรหัส Credentials ไม่ได้ | เปลี่ยน `ENCRYPTION_KEY` — ให้บันทึก Credentials ใหม่ในหน้า LINE OA Settings |
| ลืมรหัสผ่าน | ผู้ดูแลหลัก: ดู/แก้ `ADMIN_PASSWORD` ใน `.env` หรือ Vercel แล้ว restart/redeploy · ผู้ใช้อื่น: `npm run admin:create -- --username <ชื่อผู้ใช้> --reset` |
| Vercel: build ล้มเหลวที่ `prisma migrate deploy` | ตรวจว่าเชื่อม Neon แล้ว และมี `DATABASE_URL` (และ `DATABASE_URL_UNPOOLED`) ใน Environment Production |
| Vercel: Cron ได้ 503 | ยังไม่ได้ตั้ง `CRON_SECRET` แล้ว Redeploy |

---

## ข้อจำกัดและหมายเหตุ

- Rate limiter ทำงานในหน่วยความจำของแต่ละ instance — เมื่อ scale หลาย instance ควรเพิ่ม rate limit ที่ Reverse Proxy (ตัวอย่างใน `deploy/nginx.conf.example`) ส่วน Queue รองรับหลาย instance อยู่แล้ว
- ระบบออกแบบ schema ให้รองรับหลาย LINE OA แต่หน้าจอปัจจุบันจัดการบัญชีหลัก 1 บัญชี
- ข้อความในแชทกลุ่ม/ห้อง จะถูกบันทึกเป็น Event แต่ไม่ตอบกลับอัตโนมัติ
- ไฟล์ที่ลูกค้าส่ง (รูป/วิดีโอ/ไฟล์) ดึงจาก LINE Content API แบบ on-demand ซึ่ง LINE เก็บไว้ระยะเวลาจำกัด
- คอมโพเนนต์ `spacer` LINE แนะนำให้ใช้ margin/spacing แทน (ยังส่งได้ตามปกติ — Builder จะแจ้งเตือน)
