import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsView } from "@/components/settings/settings-view";
import { LoadingState } from "@/components/common/states";

export const metadata: Metadata = { title: "บัญชีและผู้ใช้งาน" };

export default function AccountSettingsPage() {
  // ทุกบทบาทเข้าได้ (เพื่อเปลี่ยนรหัสผ่าน) — แท็บอื่นแสดงตามสิทธิ์
  return (
    <Suspense fallback={<LoadingState />}>
      <SettingsView scope="account" />
    </Suspense>
  );
}
