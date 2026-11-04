import type { Metadata } from "next";
import { requireProjectPage } from "@/lib/auth/current-user";
import { LineSettingsView } from "@/components/line-settings/line-settings-view";

export const metadata: Metadata = { title: "LINE OA Settings" };

export default async function LineSettingsPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireProjectPage(params, "line:view");
  return <LineSettingsView />;
}
