import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-thai";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";

export const metadata: Metadata = {
  title: { default: "LINE OA Auto Reply Manager", template: "%s | LINE OA Auto Reply Manager" },
  description: "ระบบจัดการ LINE Official Account และตอบกลับข้อความอัตโนมัติ",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#06C755",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: สคริปต์ธีมเพิ่ม class "dark" ที่ <html> ก่อน React โหลด
    <html lang="th" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
