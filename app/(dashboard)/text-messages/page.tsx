import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth/current-user";
import { TextMessagesView } from "@/components/text-messages/text-messages-view";

export const metadata: Metadata = { title: "Text Message" };

export default async function TextMessagesPage() {
  await requirePageUser("templates:view");
  return <TextMessagesView />;
}
