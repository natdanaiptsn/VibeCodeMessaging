"use client";

import Link from "next/link";
import { useState } from "react";
import { Copy, Loader2, MessagesSquare, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CustomerAvatar } from "@/components/common/customer-avatar";
import { ErrorState, LoadingState } from "@/components/common/states";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatDateTime, formatNumber } from "@/lib/format";

type CustomerDetail = {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  statusMessage: string | null;
  language: string | null;
  isFollowing: boolean;
  followedAt: string | null;
  unfollowedAt: string | null;
  lastMessageAt: string | null;
  profileSyncedAt: string | null;
  note: string | null;
  createdAt: string;
  stats: { inbound: number; outbound: number; replies: Record<string, number> };
};

export function CustomerDetailSheet({ customerId, onOpenChange }: { customerId: string | null; onOpenChange: (open: boolean) => void }) {
  const { timezone } = useAppContext();
  const canEdit = useCan("customers:edit");
  const { data, isLoading, error, refetch } = useApiQuery<CustomerDetail>(["customer", customerId], customerId ? `/api/customers/${customerId}` : null);
  const refresh = useApiMutation<void, CustomerDetail>({
    url: `/api/customers/${customerId}/refresh-profile`,
    successMessage: "อัปเดตโปรไฟล์จาก LINE แล้ว",
    invalidate: [["customer", customerId], ["customers"], ["conversations"]],
  });

  return (
    <Sheet open={Boolean(customerId)} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>ข้อมูลลูกค้า</SheetTitle>
          <SheetDescription>รายละเอียดและสถิติการสนทนา</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isLoading || !data ? (
            <LoadingState />
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <CustomerAvatar name={data.displayName} pictureUrl={data.pictureUrl} className="size-14" />
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold">{data.displayName ?? "ไม่ทราบชื่อ"}</p>
                  {data.isFollowing ? <Badge variant="success">ติดตามอยู่</Badge> : <Badge variant="muted">เลิกติดตาม / บล็อก</Badge>}
                </div>
              </div>
              {data.statusMessage && <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-muted-foreground">“{data.statusMessage}”</p>}
              <div>
                <Label className="text-xs text-muted-foreground">LINE User ID</Label>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-gray-100 px-2 py-1 text-xs">{data.lineUserId}</code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="คัดลอก User ID"
                    onClick={() => navigator.clipboard?.writeText(data.lineUserId).then(() => toast.success("คัดลอกแล้ว"))}
                  >
                    <Copy />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-semibold">{formatNumber(data.stats.inbound)}</p>
                  <p className="text-xs text-muted-foreground">ข้อความเข้า</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-semibold">{formatNumber(data.stats.outbound)}</p>
                  <p className="text-xs text-muted-foreground">ข้อความออก</p>
                </div>
                <div className="rounded-lg border p-2">
                  <p className="text-lg font-semibold text-destructive">{formatNumber(data.stats.replies.FAILED ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">ตอบไม่สำเร็จ</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">ข้อความล่าสุด</dt>
                  <dd>{formatDateTime(data.lastMessageAt, timezone)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">เพิ่มเพื่อนเมื่อ</dt>
                  <dd>{formatDateTime(data.followedAt ?? data.createdAt, timezone)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">ภาษา</dt>
                  <dd>{data.language ?? "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">อัปเดตโปรไฟล์</dt>
                  <dd>{formatDateTime(data.profileSyncedAt, timezone)}</dd>
                </div>
              </dl>
              <NoteEditor key={`${data.id}:${data.note ?? ""}`} customerId={data.id} initial={data.note ?? ""} canEdit={canEdit} />
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/inbox?customer=${data.id}`}><MessagesSquare /> เปิดแชท</Link>
                </Button>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                    {refresh.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} ดึงโปรไฟล์จาก LINE
                  </Button>
                )}
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/reply-logs?customerId=${data.id}`}>ดูประวัติการตอบกลับ</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NoteEditor({ customerId, initial, canEdit }: { customerId: string; initial: string; canEdit: boolean }) {
  const [note, setNote] = useState(initial);
  const saveNote = useApiMutation<void, CustomerDetail>({
    url: `/api/customers/${customerId}`,
    method: "PATCH",
    body: () => ({ note: note.trim() || null }),
    successMessage: "บันทึกโน้ตแล้ว",
    invalidate: [["customer", customerId], ["customers"]],
  });
  return (
    <div className="grid gap-2">
      <Label htmlFor="customer-note">โน้ตภายใน</Label>
      <Textarea
        id="customer-note"
        value={note}
        maxLength={2000}
        disabled={!canEdit}
        onChange={(e) => setNote(e.target.value)}
        placeholder="บันทึกข้อมูลเพิ่มเติมเกี่ยวกับลูกค้า (มองเห็นเฉพาะทีมงาน)"
      />
      {canEdit && (
        <Button size="sm" className="justify-self-end" onClick={() => saveNote.mutate()} disabled={saveNote.isPending || note === initial}>
          {saveNote.isPending ? <Loader2 className="animate-spin" /> : <Save />} บันทึกโน้ต
        </Button>
      )}
    </div>
  );
}
