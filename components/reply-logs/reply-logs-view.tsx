"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { History, Loader2, RotateCcw, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { ReplyStatusBadge } from "@/components/common/badges";
import { CustomerAvatar } from "@/components/common/customer-avatar";
import { EmptyState, ErrorState, LoadingState, TableSkeleton } from "@/components/common/states";
import { LineTextBubble } from "@/components/text-messages/line-text-bubble";
import { ChatBackdrop, FlexPreview } from "@/components/flex/flex-preview";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatDateTime, formatNumber } from "@/lib/format";
import { MESSAGE_TYPE_LABELS, REPLY_SOURCE_LABELS, REPLY_TYPE_LABELS } from "@/lib/labels";

type LogRow = {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  source: string;
  method: string;
  replyType: string;
  ruleId: string | null;
  ruleName: string | null;
  matchedKeyword: string | null;
  errorMessage: string | null;
  responseStatus: number | null;
  customer: { id: string; displayName: string | null; pictureUrl: string | null; lineUserId: string } | null;
  sourceMessage: { id: string; type: string; text: string | null } | null;
  triggeredBy: { name: string } | null;
};

type LogDetail = LogRow & {
  requestMessages: ({ type: "text"; text: string } | { type: "flex"; altText: string; contents: unknown })[] | null;
  responseBody: unknown;
  lineRequestId: string | null;
  attempts: number;
  matchedRules: { id: string; name: string; keyword?: string }[] | null;
  webhookEvent: { webhookEventId: string; type: string; isRedelivery: boolean; eventTimestamp: string } | null;
  retries: { id: string; status: string; createdAt: string; errorMessage: string | null }[];
};

function LogDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { timezone } = useAppContext();
  const canRetry = useCan("logs:retry");
  const { data, isLoading, error, refetch } = useApiQuery<LogDetail>(["reply-log", id], id ? `/api/reply-logs/${id}` : null);
  const retry = useApiMutation<void, { status: string; errorMessage: string | null }>({
    url: `/api/reply-logs/${id}/retry`,
    successMessage: (d) => (d.status === "SUCCESS" ? "ส่งซ้ำสำเร็จ" : null),
    invalidate: [["reply-logs"], ["reply-log", id]],
    onSuccess: (d) => {
      if (d.status !== "SUCCESS") toast.error(`ส่งซ้ำไม่สำเร็จ: ${d.errorMessage ?? ""}`);
    },
  });
  return (
    <Sheet open={Boolean(id)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>รายละเอียดการตอบกลับ</SheetTitle>
          <SheetDescription>ข้อมูลคำขอและผลลัพธ์จาก LINE Messaging API</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {error ? (
            <ErrorState message={error.message} onRetry={() => refetch()} />
          ) : isLoading || !data ? (
            <LoadingState />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <ReplyStatusBadge status={data.status} />
                <Badge variant="outline">{REPLY_SOURCE_LABELS[data.source]}</Badge>
                <Badge variant="outline">{data.method === "REPLY" ? "Reply API" : "Push API"}</Badge>
                <Badge variant="outline">{REPLY_TYPE_LABELS[data.replyType]}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">เวลา</dt><dd>{formatDateTime(data.createdAt, timezone)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">เสร็จสิ้น</dt><dd>{formatDateTime(data.completedAt, timezone)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">ลูกค้า</dt><dd className="truncate">{data.customer?.displayName ?? data.customer?.lineUserId ?? "-"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">กฎที่ใช้</dt><dd>{data.ruleName ?? "-"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Keyword ที่ตรง</dt><dd className="font-mono text-xs">{data.matchedKeyword ?? "-"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">HTTP Status</dt><dd>{data.responseStatus ?? "-"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">LINE Request ID</dt><dd className="font-mono text-xs break-all">{data.lineRequestId ?? "-"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">จำนวนครั้งที่พยายาม</dt><dd>{data.attempts}</dd></div>
                {data.webhookEvent && (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Webhook Event ID</dt>
                    <dd className="font-mono text-xs break-all">
                      {data.webhookEvent.webhookEventId} {data.webhookEvent.isRedelivery && <Badge variant="warning">Redelivery</Badge>}
                    </dd>
                  </div>
                )}
              </dl>
              {data.sourceMessage && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">ข้อความต้นทาง ({MESSAGE_TYPE_LABELS[data.sourceMessage.type]})</p>
                  <p className="rounded-md bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap">{data.sourceMessage.text ?? "-"}</p>
                </div>
              )}
              {data.errorMessage && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Error Message</p>
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm whitespace-pre-wrap text-red-700">{data.errorMessage}</p>
                </div>
              )}
              {data.requestMessages && data.requestMessages.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">ข้อความที่ส่ง</p>
                  <ChatBackdrop className="space-y-2">
                    {data.requestMessages.map((m, i) =>
                      m.type === "text" ? <LineTextBubble key={i} text={m.text} /> : <div key={i} className="origin-top-left scale-90"><FlexPreview contents={m.contents} /></div>,
                    )}
                  </ChatBackdrop>
                </div>
              )}
              {data.responseBody != null && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">LINE API Response (เฉพาะข้อมูลที่จำเป็น)</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-gray-900 p-3 text-xs text-gray-100">{JSON.stringify(data.responseBody, null, 2)}</pre>
                </div>
              )}
              {data.retries.length > 0 && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">ประวัติการส่งซ้ำ</p>
                  <ul className="space-y-1 text-sm">
                    {data.retries.map((r) => (
                      <li key={r.id} className="flex items-center gap-2"><ReplyStatusBadge status={r.status} /> {formatDateTime(r.createdAt, timezone)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {canRetry && data.status === "FAILED" && data.requestMessages && data.requestMessages.length > 0 && !data.retries.some((r) => r.status === "SUCCESS") && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <p className="mb-2 text-amber-800">ส่งซ้ำด้วย Push API (Reply Token ใช้ได้ครั้งเดียว) — นับรวมในโควตาข้อความ</p>
                  <Button size="sm" onClick={() => retry.mutate()} disabled={retry.isPending || data.customer === null}>
                    {retry.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />} ส่งซ้ำ
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ReplyLogsView() {
  const { timezone } = useAppContext();
  const params = useSearchParams();
  const [customerId, setCustomerId] = useState(params.get("customerId") ?? "");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [replyType, setReplyType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const debounced = useDebounce(search);
  const qs = new URLSearchParams(
    Object.entries({
      page: String(page),
      pageSize: "25",
      search: debounced,
      status: status === "all" ? "" : status,
      source: source === "all" ? "" : source,
      replyType: replyType === "all" ? "" : replyType,
      from,
      to,
      customerId,
    }).filter(([, v]) => v),
  ).toString();
  const { data, isLoading, error, refetch } = useApiQuery<{ items: LogRow[]; total: number; page: number; pageSize: number; counts: Record<string, number> }>(
    ["reply-logs", qs],
    `/api/reply-logs?${qs}`,
    { placeholderData: (p) => p, refetchInterval: 15_000 },
  );
  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader title="ประวัติการตอบกลับ" description="บันทึกการตอบกลับอัตโนมัติและการส่งข้อความทั้งหมด" />
      <Card className="gap-0 py-0">
        <div className="grid gap-2 border-b p-4 md:grid-cols-2 xl:grid-cols-[1fr_150px_160px_150px_150px_150px]">
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => reset(setSearch)(e.target.value)} placeholder="ค้นหาลูกค้า, ข้อความ, กฎ หรือ Error" className="pl-8" />
          </div>
          <Select value={status} onValueChange={reset(setStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="SUCCESS">Success</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={reset(setSource)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกแหล่งที่มา</SelectItem>
              {Object.entries(REPLY_SOURCE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={replyType} onValueChange={reset(setReplyType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกรูปแบบ</SelectItem>
              {Object.entries(REPLY_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} aria-label="ตั้งแต่วันที่" />
          <Input type="date" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} aria-label="ถึงวันที่" />
        </div>
        {(customerId || data?.counts) && (
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
            {customerId && (
              <Badge variant="info" className="gap-1">
                กรองตามลูกค้า
                <button onClick={() => reset(setCustomerId)("")} aria-label="ล้าง"><X className="size-3" /></button>
              </Badge>
            )}
            {data?.counts && (
              <span className="text-muted-foreground">
                Success {formatNumber(data.counts.SUCCESS ?? 0)} · Failed {formatNumber(data.counts.FAILED ?? 0)} · Pending/Processing{" "}
                {formatNumber((data.counts.PENDING ?? 0) + (data.counts.PROCESSING ?? 0))}
              </span>
            )}
          </div>
        )}
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <TableSkeleton rows={8} cols={5} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={History} title="ไม่พบประวัติการตอบกลับ" description="ลองปรับตัวกรอง หรือรอให้มีข้อความเข้ามา" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่และเวลา</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="hidden md:table-cell">ข้อความต้นทาง</TableHead>
                  <TableHead className="hidden lg:table-cell">กฎที่ถูกเรียกใช้</TableHead>
                  <TableHead className="hidden sm:table-cell">รูปแบบ</TableHead>
                  <TableHead>ผลการส่ง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((l) => (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => setSelected(l.id)}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDateTime(l.createdAt, timezone)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CustomerAvatar name={l.customer?.displayName} pictureUrl={l.customer?.pictureUrl} className="size-7" />
                        <span className="max-w-32 truncate text-sm">{l.customer?.displayName ?? l.customer?.lineUserId ?? "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-56 md:table-cell">
                      <p className="truncate text-sm">
                        {l.sourceMessage ? l.sourceMessage.text ?? `[${MESSAGE_TYPE_LABELS[l.sourceMessage.type]}]` : l.triggeredBy ? `ส่งโดย ${l.triggeredBy.name}` : "-"}
                      </p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <p className="max-w-44 truncate text-sm">{l.ruleName ?? REPLY_SOURCE_LABELS[l.source]}</p>
                      <p className="text-xs text-muted-foreground">{REPLY_SOURCE_LABELS[l.source]} · {l.method}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><Badge variant="outline">{REPLY_TYPE_LABELS[l.replyType]}</Badge></TableCell>
                    <TableCell>
                      <ReplyStatusBadge status={l.status} />
                      {l.errorMessage && l.status === "FAILED" && <p className="mt-1 max-w-48 truncate text-xs text-destructive" title={l.errorMessage}>{l.errorMessage}</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
      <LogDetailSheet id={selected} onClose={() => setSelected(null)} />
    </>
  );
}
