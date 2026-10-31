import type { Metadata, Viewport } from "next";
import "@fontsource-variable/noto-sans-thai";
import "./globals.css";

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
    <html lang="th" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
