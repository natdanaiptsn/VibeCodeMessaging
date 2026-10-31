import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/auth/current-user";
import { InboxView } from "@/components/inbox/inbox-view";
import { LoadingState } from "@/components/common/states";

export const metadata: Metadata = { title: "กล่องข้อความ" };

export default async function InboxPage() {
  await requirePageUser("inbox:view");
  return (
    <Suspense fallback={<LoadingState />}>
      <InboxView />
    </Suspense>
  );
}
