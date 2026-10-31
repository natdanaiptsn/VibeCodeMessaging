import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePageUser } from "@/lib/auth/current-user";
import { ReplyLogsView } from "@/components/reply-logs/reply-logs-view";
import { LoadingState } from "@/components/common/states";

export const metadata: Metadata = { title: "ประวัติการตอบกลับ" };

export default async function ReplyLogsPage() {
  await requirePageUser("logs:view");
  return (
    <Suspense fallback={<LoadingState />}>
      <ReplyLogsView />
    </Suspense>
  );
}
