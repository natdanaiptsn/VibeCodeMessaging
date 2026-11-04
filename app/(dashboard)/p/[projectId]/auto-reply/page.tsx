import type { Metadata } from "next";
import { requireProjectPage } from "@/lib/auth/current-user";
import { RulesView } from "@/components/auto-reply/rules-view";

export const metadata: Metadata = { title: "ระบบตอบกลับอัตโนมัติ" };

export default async function AutoReplyPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireProjectPage(params, "rules:view");
  return <RulesView />;
}
