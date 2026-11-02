import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/auth/current-user";
import { SettingsView } from "@/components/settings/settings-view";
import { LoadingState } from "@/components/common/states";

export const metadata: Metadata = { title: "ตั้งค่าโปรเจกต์" };

export default async function ProjectSettingsPage() {
  await requirePageUser("settings:view");
  return (
    <Suspense fallback={<LoadingState />}>
      <SettingsView scope="project" />
    </Suspense>
  );
}
