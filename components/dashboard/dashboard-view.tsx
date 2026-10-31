"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Inbox,
  Link2,
  Loader2,
  MessageSquareDashed,
  PlugZap,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/misc";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { MessageStatusBadge } from "@/components/common/badges";
import { CustomerAvatar } from "@/components/common/customer-avatar";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatNumber, formatRelative, formatDateTime } from "@/lib/format";
import { MESSAGE_TYPE_LABELS } from "@/lib/labels";

type DashboardData = {
  stats: {
    receivedToday: number;
    successToday: number;
    failedToday: number;
    totalCustomers: number;
    followingCustomers: number;
    activeRules: number;
  };
  chart: { day: string; inbound: number; success: number; failed: number }[];
  recent: {
    id: string;
    type: string;
    text: string | null;
    status: string;
    timestamp: string;
    customer: { id: string; displayName: string | null; pictureUrl: string | null; lineUserId: string };
  }[];
  line: {
    connectionStatus: "UNKNOWN" | "CONNECTED" | "FAILED";
    connectionError: string | null;
    lastVerifiedAt: string | null;
    lastWebhookAt: string | null;
    displayName: string | null;
    pictureUrl: string | null;
    basicId: string | null;
    configured: boolean;
  };
  autoReplyEnabled: boolean;
  queue: { pending: number; failed: number };
};

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: typeof Inbox;
  hint?: string;
  tone?: "default" | "success" | "danger";
}) {
  const iconTone =
    tone === "success" ? "bg-emerald-50 text-emerald-600" : tone === "danger" ? "bg-red-50 text-red-600" : "bg-accent text-primary";
  return (
    <Card className="gap-3 py-4">
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function ConnectionCard({ line, autoReplyEnabled, queue }: Pick<DashboardData, "line" | "autoReplyEnabled" | "queue">) {
  const { timezone } = useAppContext();
  const canTest = useCan("line:view");
  const test = useApiMutation<void, { ok: boolean; message: string }>({
    url: "/api/line/test-connection",
    successMessage: (d) => (d.ok ? d.message : null),
    invalidate: [["dashboard"]],
    onSuccess: (d) => {
      if (!d.ok) toast.error(d.message);
    },
  });
  const status = line.connectionStatus;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZap className="size-4 text-primary" /> สถานะ LINE OA
        </CardTitle>
        <CardDescription>การเชื่อมต่อ Messaging API และ Webhook</CardDescription>
        {canTest && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
              {test.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} ตรวจสอบ
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <CustomerAvatar name={line.displayName ?? "LINE"} pictureUrl={line.pictureUrl} className="size-11" />
          <div className="min-w-0">
            <p className="truncate font-medium">{line.displayName ?? "ยังไม่ทราบชื่อบัญชี"}</p>
            <p className="text-xs text-muted-foreground">{line.basicId ?? "-"}</p>
          </div>
          <div className="ml-auto">
            {!line.configured ? (
              <Badge variant="warning"><CircleAlert /> ยังไม่ตั้งค่า</Badge>
            ) : status === "CONNECTED" ? (
              <Badge variant="success"><CheckCircle2 /> เชื่อมต่อแล้ว</Badge>
            ) : status === "FAILED" ? (
              <Badge variant="destructive"><XCircle /> เชื่อมต่อไม่สำเร็จ</Badge>
            ) : (
              <Badge variant="muted"><CircleAlert /> ยังไม่ได้ทดสอบ</Badge>
            )}
          </div>
        </div>
        {status === "FAILED" && line.connectionError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{line.connectionError}</p>
        )}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">ระบบตอบกลับอัตโนมัติ</dt>
            <dd className="mt-0.5 font-medium">{autoReplyEnabled ? "เปิดใช้งาน" : "ปิดอยู่"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Webhook ล่าสุด</dt>
            <dd className="mt-0.5 font-medium" title={formatDateTime(line.lastWebhookAt, timezone)}>
              {line.lastWebhookAt ? formatRelative(line.lastWebhookAt, timezone) : "ยังไม่เคยได้รับ"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">ตรวจสอบล่าสุด</dt>
            <dd className="mt-0.5 font-medium">{line.lastVerifiedAt ? formatRelative(line.lastVerifiedAt, timezone) : "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">คิวรอประมวลผล</dt>
            <dd className="mt-0.5 font-medium">
              {formatNumber(queue.pending)}
              {queue.failed > 0 && <span className="ml-1 text-xs text-destructive">(ล้มเหลว {formatNumber(queue.failed)})</span>}
            </dd>
          </div>
        </dl>
        {!line.configured && canTest && (
          <Button asChild variant="outline" className="w-full">
            <Link href="/line-settings"><Link2 /> ไปตั้งค่า LINE OA</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { timezone } = useAppContext();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useApiQuery<DashboardData>(["dashboard"], "/api/dashboard", {
    refetchInterval: 30_000,
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="ภาพรวมการรับและตอบกลับข้อความของ LINE Official Account"
        actions={
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["dashboard"] })} disabled={isFetching}>
            <RefreshCw className={isFetching ? "animate-spin" : ""} /> รีเฟรช
          </Button>
        }
      />
      {error ? (
        <Card><ErrorState message={error.message} onRetry={() => refetch()} /></Card>
      ) : isLoading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="ข้อความที่ได้รับวันนี้" value={data.stats.receivedToday} icon={Inbox} />
            <StatCard label="ตอบกลับสำเร็จวันนี้" value={data.stats.successToday} icon={CheckCircle2} tone="success" />
            <StatCard label="ตอบกลับไม่สำเร็จวันนี้" value={data.stats.failedToday} icon={XCircle} tone="danger" />
            <StatCard
              label="ลูกค้าทั้งหมด"
              value={data.stats.totalCustomers}
              icon={Users}
              hint={`ติดตามอยู่ ${formatNumber(data.stats.followingCustomers)} คน`}
            />
            <StatCard label="กฎ Auto Reply ที่เปิดใช้งาน" value={data.stats.activeRules} icon={Bot} />
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>สถิติข้อความรายวัน</CardTitle>
                <CardDescription>14 วันล่าสุด (เขตเวลา {timezone})</CardDescription>
              </CardHeader>
              <CardContent>
                <DailyChart data={data.chart} />
              </CardContent>
            </Card>
            <ConnectionCard line={data.line} autoReplyEnabled={data.autoReplyEnabled} queue={data.queue} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>ข้อความล่าสุด</CardTitle>
              <CardDescription>ข้อความที่ลูกค้าส่งเข้ามาล่าสุด</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm"><Link href="/inbox">ดูทั้งหมด</Link></Button>
              </CardAction>
            </CardHeader>
            <CardContent className="px-0">
              {data.recent.length === 0 ? (
                <EmptyState
                  icon={MessageSquareDashed}
                  title="ยังไม่มีข้อความ"
                  description="เมื่อลูกค้าส่งข้อความเข้า LINE OA ข้อความจะแสดงที่นี่"
                />
              ) : (
                <ul className="divide-y">
                  {data.recent.map((m) => (
                    <li key={m.id}>
                      <Link href={`/inbox?customer=${m.customer.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                        <CustomerAvatar name={m.customer.displayName} pictureUrl={m.customer.pictureUrl} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{m.customer.displayName ?? m.customer.lineUserId}</p>
                            <Badge variant="outline" className="hidden sm:inline-flex">{MESSAGE_TYPE_LABELS[m.type] ?? m.type}</Badge>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">{m.text || `[${MESSAGE_TYPE_LABELS[m.type] ?? m.type}]`}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-muted-foreground">{formatRelative(m.timestamp, timezone)}</span>
                          <MessageStatusBadge status={m.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
