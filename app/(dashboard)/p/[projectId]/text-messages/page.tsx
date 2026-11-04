import type { Metadata } from "next";
import { requireProjectPage } from "@/lib/auth/current-user";
import { TextMessagesView } from "@/components/text-messages/text-messages-view";

export const metadata: Metadata = { title: "Text Message" };

export default async function TextMessagesPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireProjectPage(params, "templates:view");
  return <TextMessagesView />;
}
