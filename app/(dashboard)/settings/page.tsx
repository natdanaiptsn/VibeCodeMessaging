import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/auth/current-user";
import { SettingsView } from "@/components/settings/settings-view";
import { LoadingState } from "@/components/common/states";

export const metadata: Metadata = { title: "ตั้งค่าระบบ" };

export default async function SettingsPage() {
  // ทุกบทบาทเข้าได้ (เพื่อเปลี่ยนรหัสผ่าน) — แท็บอื่นแสดงตามสิทธิ์
  await requirePageUser();
  return (
    <Suspense fallback={<LoadingState />}>
      <SettingsView />
    </Suspense>
  );
}
