import Link from "next/link";
import { MessageCircle } from "lucide-react";

/** โครงหน้าเอกสารสาธารณะ (นโยบายความเป็นส่วนตัว / ข้อกำหนดการใช้งาน) — เปิดได้โดยไม่ต้องเข้าสู่ระบบ */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2.5 px-4 sm:px-6">
          <Link href="/login" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
              <MessageCircle className="size-5" fill="currentColor" />
            </span>
            <span className="text-sm font-bold">LINE OA Auto Reply Manager</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">ปรับปรุงล่าสุด: {updated}</p>
        <article className="mt-8 space-y-7 text-[15px] leading-relaxed [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_a]:font-medium [&_a]:text-primary [&_a]:underline">
          {children}
        </article>
        <footer className="mt-12 flex flex-wrap gap-x-4 gap-y-1 border-t pt-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground">นโยบายความเป็นส่วนตัว</Link>
          <Link href="/terms" className="hover:text-foreground">ข้อกำหนดการใช้งาน</Link>
          <Link href="/login" className="hover:text-foreground">เข้าสู่ระบบ</Link>
        </footer>
      </main>
    </div>
  );
}

/** ช่องทางติดต่อ (ตั้งใน Environment Variable: PRIVACY_CONTACT_EMAIL) */
export function ContactLine() {
  const email = process.env.PRIVACY_CONTACT_EMAIL?.trim();
  return email ? (
    <p>
      ติดต่อเรื่องข้อมูลส่วนบุคคลได้ที่ <a href={`mailto:${email}`}>{email}</a>
    </p>
  ) : (
    <p>ติดต่อเรื่องข้อมูลส่วนบุคคลได้ที่ผู้ดูแลระบบของเว็บไซต์นี้</p>
  );
}
