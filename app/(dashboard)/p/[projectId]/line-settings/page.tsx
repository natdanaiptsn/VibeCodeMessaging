import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/current-user";
import { LineSettingsView } from "@/components/line-settings/line-settings-view";

export const metadata: Metadata = { title: "LINE OA Settings" };

export default async function LineSettingsPage() {
  await requirePageUser("line:view");
  return <LineSettingsView />;
}
