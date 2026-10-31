"use client";

import { useState } from "react";
import { Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { CustomerAvatar } from "@/components/common/customer-avatar";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { CustomerDetailSheet } from "@/components/customers/customer-detail-sheet";
import { useApiQuery } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAppContext } from "@/hooks/use-app-context";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

type CustomerRow = {
  id: string;
  lineUserId: string;
  displayName: string | null;
  pictureUrl: string | null;
  isFollowing: boolean;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  messageCount: number;
  createdAt: string;
  note: string | null;
};

export function CustomersView() {
  const { timezone } = useAppContext();
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const debounced = useDebounce(search);
  const qs = new URLSearchParams({ page: String(page), pageSize: "20", following, ...(debounced ? { search: debounced } : {}) }).toString();
  const { data, isLoading, error, refetch } = useApiQuery<{ items: CustomerRow[]; total: number; page: number; pageSize: number }>(
    ["customers", qs],
    `/api/customers?${qs}`,
    { placeholderData: (p) => p },
  );

  return (
    <>
      <PageHeader title="ลูกค้า" description="รายชื่อผู้ใช้ LINE ที่ติดต่อเข้ามาทาง LINE OA" />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-2 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ค้นหาชื่อ, LINE User ID หรือโน้ต"
              className="pl-8"
            />
          </div>
          <Select value={following} onValueChange={(v) => { setFollowing(v); setPage(1); }}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="following">ติดตามอยู่</SelectItem>
              <SelectItem value="unfollowed">เลิกติดตาม / บล็อก</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <TableSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Users} title="ไม่พบลูกค้า" description={debounced ? "ลองเปลี่ยนคำค้นหา" : "เมื่อมีลูกค้าส่งข้อความหรือเพิ่มเพื่อน ข้อมูลจะแสดงที่นี่"} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead className="hidden md:table-cell">ข้อความล่าสุด</TableHead>
                  <TableHead className="text-right">จำนวนข้อความ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="hidden lg:table-cell">เพิ่มเมื่อ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CustomerAvatar name={c.displayName} pictureUrl={c.pictureUrl} />
                        <div className="min-w-0">
                          <p className="max-w-48 truncate font-medium">{c.displayName ?? "ไม่ทราบชื่อ"}</p>
                          <p className="max-w-48 truncate font-mono text-[11px] text-muted-foreground">{c.lineUserId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden max-w-xs md:table-cell">
                      <p className="truncate text-sm">{c.lastMessageText ?? "-"}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(c.lastMessageAt, timezone)}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(c.messageCount)}</TableCell>
                    <TableCell>{c.isFollowing ? <Badge variant="success">ติดตามอยู่</Badge> : <Badge variant="muted">เลิกติดตาม</Badge>}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatDateTime(c.createdAt, timezone)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
          </>
        )}
      </Card>
      <CustomerDetailSheet customerId={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}
