"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronUp, Filter, Info, Loader2, MessagesSquare, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CustomerAvatar } from "@/components/common/customer-avatar";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { MessageStatusBadge } from "@/components/common/badges";
import { CustomerDetailSheet } from "@/components/customers/customer-detail-sheet";
import { MessageBubble, type ThreadMessage } from "@/components/inbox/message-bubble";
import { Composer } from "@/components/inbox/composer";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatDate, formatRelative } from "@/lib/format";
import { MESSAGE_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  isFollowing: boolean;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  lastMessageType: string | null;
  lastInboundStatus: string | null;
};

type Filters = { search: string; messageSearch: string; type: string; from: string; to: string };
const EMPTY_FILTERS: Filters = { search: "", messageSearch: "", type: "", from: "", to: "" };

function buildQuery(params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  return sp.toString();
}

function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { timezone } = useAppContext();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const debSearch = useDebounce(filters.search);
  const debMsg = useDebounce(filters.messageSearch);
  const query = buildQuery({ search: debSearch, messageSearch: debMsg, type: filters.type, from: filters.from, to: filters.to, page, pageSize: 30 });
  const { data, isLoading, error, refetch } = useApiQuery<{ items: Conversation[]; total: number }>(
    ["conversations", query],
    `/api/conversations?${query}`,
    { refetchInterval: 10_000, placeholderData: (prev) => prev },
  );
  const activeFilterCount = [filters.messageSearch, filters.type, filters.from, filters.to].filter(Boolean).length;
  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="ค้นหาลูกค้า" className="pl-8" />
          </div>
          <Button variant={showFilters || activeFilterCount ? "secondary" : "outline"} size="icon" onClick={() => setShowFilters((s) => !s)} aria-label="ตัวกรอง">
            <Filter />
          </Button>
        </div>
        {showFilters && (
          <div className="grid gap-2 rounded-lg bg-gray-50 p-2">
            <Input value={filters.messageSearch} onChange={(e) => set({ messageSearch: e.target.value })} placeholder="ค้นหาข้อความ" />
            <Select value={filters.type || "all"} onValueChange={(v) => set({ type: v === "all" ? "" : v })}>
              <SelectTrigger size="sm"><SelectValue placeholder="ประเภทข้อความ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกประเภทข้อความ</SelectItem>
                {Object.entries(MESSAGE_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                ตั้งแต่วันที่
                <Input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className="h-8" />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                ถึงวันที่
                <Input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} className="h-8" />
              </label>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => set({ messageSearch: "", type: "", from: "", to: "" })}>
                <X /> ล้างตัวกรอง
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isLoading ? (
          <LoadingState />
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={MessagesSquare} title="ไม่พบการสนทนา" description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง" />
        ) : (
          <ul>
            {data.items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-gray-50",
                    selectedId === c.id && "bg-accent hover:bg-accent",
                  )}
                >
                  <CustomerAvatar name={c.displayName} pictureUrl={c.pictureUrl} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.displayName ?? c.lineUserId}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(c.lastMessageAt, timezone)}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.lastMessageText ?? "-"}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      {c.lastInboundStatus && <MessageStatusBadge status={c.lastInboundStatus} />}
                      {!c.isFollowing && <Badge variant="muted">เลิกติดตาม</Badge>}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > page * 30 && (
          <div className="p-3">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setPage((p) => p + 1)}>โหลดเพิ่ม</Button>
          </div>
        )}
        {page > 1 && (
          <div className="px-3 pb-3">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setPage(1)}>กลับหน้าแรก</Button>
          </div>
        )}
      </div>
    </div>
  );
}

type MessagesPage = { items: ThreadMessage[]; hasMore: boolean; nextBefore: string | null };

function Thread({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const { timezone } = useAppContext();
  const canSend = useCan("inbox:send");
  const [detailOpen, setDetailOpen] = useState(false);
  const [msgType, setMsgType] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  const customer = useApiQuery<Conversation & { note: string | null }>(["customer", customerId], `/api/customers/${customerId}`);
  const messages = useInfiniteQuery<MessagesPage>({
    queryKey: ["messages", customerId, msgType],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      apiFetch<MessagesPage>(`/api/customers/${customerId}/messages?${buildQuery({ before: (pageParam as string | null) ?? undefined, limit: 40, type: msgType })}`),
    getNextPageParam: (last) => (last.hasMore ? last.nextBefore : undefined),
    refetchInterval: 5_000,
  });

  const items = useMemo(() => {
    const pages = messages.data?.pages ?? [];
    return [...pages].reverse().flatMap((p) => p.items);
  }, [messages.data]);

  // เลื่อนลงล่างสุดเมื่อมีข้อความใหม่
  useEffect(() => {
    const last = items[items.length - 1]?.id ?? null;
    if (last && last !== lastIdRef.current) {
      lastIdRef.current = last;
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }
  }, [items]);

  const c = customer.data;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b bg-white px-3 py-2.5">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="กลับ">
          <ArrowLeft />
        </Button>
        <CustomerAvatar name={c?.displayName} pictureUrl={c?.pictureUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{c?.displayName ?? c?.lineUserId ?? "กำลังโหลด..."}</p>
          <p className="truncate text-xs text-muted-foreground">{c?.isFollowing === false ? "เลิกติดตาม / บล็อก" : "ติดตามอยู่"}</p>
        </div>
        <Select value={msgType || "all"} onValueChange={(v) => setMsgType(v === "all" ? "" : v)}>
          <SelectTrigger size="sm" className="hidden w-36 sm:flex"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {Object.entries(MESSAGE_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)}>
          <Info /> <span className="hidden sm:inline">ข้อมูลลูกค้า</span>
        </Button>
      </div>
      <div ref={scrollRef} className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#eef1f5] p-3 sm:p-4">
        {messages.error ? (
          <ErrorState message={messages.error.message} onRetry={() => messages.refetch()} />
        ) : messages.isLoading ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState title="ยังไม่มีข้อความ" />
        ) : (
          <>
            {messages.hasNextPage && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => messages.fetchNextPage()} disabled={messages.isFetchingNextPage}>
                  {messages.isFetchingNextPage ? <Loader2 className="animate-spin" /> : <ChevronUp />} โหลดข้อความก่อนหน้า
                </Button>
              </div>
            )}
            {items.map((m, i) => {
              const day = formatDate(m.timestamp, timezone);
              const showDay = i === 0 || formatDate(items[i - 1]!.timestamp, timezone) !== day;
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-full bg-black/10 px-3 py-0.5 text-[11px] text-gray-700">{day}</span>
                    </div>
                  )}
                  <MessageBubble m={m} timezone={timezone} />
                </div>
              );
            })}
          </>
        )}
      </div>
      {canSend && <Composer customerId={customerId} disabled={c?.isFollowing === false} onSent={() => messages.refetch()} />}
      <CustomerDetailSheet customerId={detailOpen ? customerId : null} onOpenChange={setDetailOpen} />
    </div>
  );
}

export function InboxView() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("customer");
  const select = (id: string | null) => router.replace(id ? `/inbox?customer=${id}` : "/inbox", { scroll: false });

  return (
    <Card className="h-[calc(100dvh-7.5rem)] min-h-[520px] flex-row gap-0 overflow-hidden p-0 lg:h-[calc(100dvh-3rem)]">
      <div className={cn("w-full border-r md:block md:w-80 lg:w-96", selected ? "hidden" : "block")}>
        <ConversationList selectedId={selected} onSelect={(id) => select(id)} />
      </div>
      <div className={cn("min-w-0 flex-1", selected ? "block" : "hidden md:block")}>
        {selected ? (
          <Thread key={selected} customerId={selected} onBack={() => select(null)} />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-50">
            <EmptyState icon={MessagesSquare} title="เลือกการสนทนา" description="เลือกลูกค้าจากรายการด้านซ้ายเพื่อดูประวัติข้อความและตอบกลับ" />
          </div>
        )}
      </div>
    </Card>
  );
}
