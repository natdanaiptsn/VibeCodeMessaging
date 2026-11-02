import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/current-user";
import { RulesView } from "@/components/auto-reply/rules-view";

export const metadata: Metadata = { title: "ระบบตอบกลับอัตโนมัติ" };

export default async function AutoReplyPage() {
  await requirePageUser("rules:view");
  return <RulesView />;
}
