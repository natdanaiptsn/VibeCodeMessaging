"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Copy, FlaskConical, Loader2, MoreHorizontal, Pencil, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import { Field } from "@/components/common/field";
import { RuleFormSheet, type RuleRecord } from "@/components/auto-reply/rule-form";
import { LineTextBubble } from "@/components/text-messages/line-text-bubble";
import { ChatBackdrop, FlexPreview } from "@/components/flex/flex-preview";
import { apiFetch, ApiClientError, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatNumber, formatRelative } from "@/lib/format";
import { MATCH_TYPE_SHORT, TRIGGER_LABELS } from "@/lib/labels";
import { toast } from "sonner";

type Settings = {
  general: { autoReplyEnabled: boolean; multiRuleMode: "FIRST_MATCH" | "ALL_MATCHES"; maxMessagesPerReply: number };
  defaultReply: { enabled: boolean; replyType: string; cooldownMinutes: number };
};

type TestResult = {
  source: "RULE" | "DEFAULT" | null;
  messages: ({ type: "text"; text: string } | { type: "flex"; altText: string; contents: unknown })[];
  matchedRules: { id: string; name: string; keyword?: string }[];
  errors: string[];
  skippedReason?: string;
  autoReplyEnabled: boolean;
  multiRuleMode: string;
};

const SKIP_LABEL: Record<string, string> = {
  NO_MATCH: "ไม่พบกฎที่ตรงกัน และไม่ได้เปิด Default Reply สำหรับเหตุการณ์นี้",
  DEFAULT_COOLDOWN: "Default Reply อยู่ในช่วง cooldown",
  BUILD_FAILED: "สร้างข้อความตอบกลับไม่สำเร็จ",
  AUTO_REPLY_DISABLED: "ระบบตอบกลับอัตโนมัติถูกปิด",
};

function RuleTester({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState("");
  const [trigger, setTrigger] = useState("TEXT");
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      setResult(await apiFetch<TestResult>("/api/rules/test", { method: "POST", body: { text, triggerType: trigger } }));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ทดสอบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ทดสอบกฎตอบกลับ</DialogTitle>
          <DialogDescription>พิมพ์ข้อความตัวอย่างเพื่อดูว่าระบบจะตอบกลับอย่างไร (ไม่มีการส่งข้อความจริง)</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="ข้อความจากลูกค้า / Postback data">
            <Textarea value={text} rows={2} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="เช่น ขอทราบราคาหน่อยครับ" />
          </Field>
          <Field label="เหตุการณ์">
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Button onClick={run} disabled={loading} className="justify-self-start">
          {loading ? <Loader2 className="animate-spin" /> : <FlaskConical />} ทดสอบ
        </Button>
        {result && (
          <div className="space-y-3 rounded-lg border p-3">
            {!result.autoReplyEnabled && (
              <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">หมายเหตุ: ระบบตอบกลับอัตโนมัติปิดอยู่ (ผลทดสอบนี้จำลองเหมือนเปิดใช้งาน)</p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">ผลลัพธ์:</span>
              {result.source === "RULE" && <Badge variant="success">ตรงกับกฎ</Badge>}
              {result.source === "DEFAULT" && <Badge variant="info">Default Reply</Badge>}
              {!result.source && <Badge variant="muted">ไม่ตอบกลับ</Badge>}
              <span className="text-xs text-muted-foreground">โหมด: {result.multiRuleMode === "ALL_MATCHES" ? "ส่งทุกกฎที่ตรง" : "ใช้กฎแรกที่ตรง"}</span>
            </div>
            {result.matchedRules.length > 0 && (
              <ul className="space-y-1 text-sm">
                {result.matchedRules.map((r) => (
                  <li key={r.id}>• {r.name}{r.keyword && <span className="text-muted-foreground"> — Keyword: <code>{r.keyword}</code></span>}</li>
                ))}
              </ul>
            )}
            {result.skippedReason && !result.messages.length && <p className="text-sm text-muted-foreground">{SKIP_LABEL[result.skippedReason] ?? result.skippedReason}</p>}
            {result.errors.map((e) => <p key={e} className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{e}</p>)}
            {result.messages.length > 0 && (
              <ChatBackdrop className="space-y-2">
                {result.messages.map((m, i) =>
                  m.type === "text" ? <LineTextBubble key={i} text={m.text} /> : <div key={i} className="origin-top-left scale-90"><FlexPreview contents={m.contents} /></div>,
                )}
              </ChatBackdrop>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RulesView() {
  const { timezone } = useAppContext();
  const canManage = useCan("rules:manage");
  const canSettings = useCan("settings:view");
  const [search, setSearch] = useState("");
  const [trigger, setTrigger] = useState("all");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RuleRecord | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [deleting, setDeleting] = useState<RuleRecord | null>(null);
  const [testerOpen, setTesterOpen] = useState(false);
  const debounced = useDebounce(search);
  const qs = new URLSearchParams({
    ...(debounced ? { search: debounced } : {}),
    ...(trigger !== "all" ? { trigger } : {}),
    ...(status !== "all" ? { status } : {}),
  }).toString();
  const { data, isLoading, error, refetch } = useApiQuery<RuleRecord[]>(["rules", qs], `/api/rules?${qs}`, { placeholderData: (p) => p });
  const settings = useApiQuery<Settings>(["settings"], canSettings ? "/api/settings" : null);

  const toggle = useApiMutation<{ id: string; isActive: boolean }, RuleRecord>({
    url: (v) => `/api/rules/${v.id}`,
    method: "PATCH",
    body: (v) => ({ isActive: v.isActive }),
    successMessage: (r) => (r.isActive ? `เปิดใช้งาน "${r.name}" แล้ว` : `ปิดใช้งาน "${r.name}" แล้ว`),
    invalidate: [["rules"]],
  });
  const remove = useApiMutation<string>({
    url: (id) => `/api/rules/${id}`,
    method: "DELETE",
    body: () => undefined,
    successMessage: "ลบกฎแล้ว",
    invalidate: [["rules"]],
    onSuccess: () => setDeleting(null),
  });

  const openForm = (rule: RuleRecord | null, dup = false) => {
    setEditing(rule);
    setDuplicate(dup);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="ระบบตอบกลับอัตโนมัติ"
        description="ตอบกลับด้วย Keyword Matching และ Rule-based Automation (ไม่ใช้ AI)"
        actions={
          <>
            <Button variant="outline" onClick={() => setTesterOpen(true)}><FlaskConical /> ทดสอบข้อความ</Button>
            {canManage && <Button onClick={() => openForm(null)}><Plus /> เพิ่มกฎ</Button>}
          </>
        }
      />

      {settings.data && (
        <Card className="mb-4 py-4">
          <CardContent className="flex flex-col gap-3 px-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-2">
                ระบบตอบกลับ:
                {settings.data.general.autoReplyEnabled ? <Badge variant="success">เปิด</Badge> : <Badge variant="destructive">ปิด</Badge>}
              </span>
              <span>
                เมื่อตรงหลายกฎ:{" "}
                <strong>{settings.data.general.multiRuleMode === "FIRST_MATCH" ? "ใช้กฎ Priority สูงสุดกฎเดียว" : `ส่งทุกกฎที่ตรง (สูงสุด ${settings.data.general.maxMessagesPerReply} ข้อความ)`}</strong>
              </span>
              <span className="flex items-center gap-2">
                Default Reply:
                {settings.data.defaultReply.enabled ? <Badge variant="info">เปิด ({settings.data.defaultReply.replyType})</Badge> : <Badge variant="muted">ปิด</Badge>}
              </span>
            </div>
            <Button asChild variant="ghost" size="sm"><Link href="/settings?tab=auto-reply"><Settings2 /> ตั้งค่า</Link></Button>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-2 border-b p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อกฎหรือ Keyword" className="pl-8" />
          </div>
          <Select value={trigger} onValueChange={setTrigger}>
            <SelectTrigger className="md:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกเหตุการณ์</SelectItem>
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="active">เปิดใช้งาน</SelectItem>
              <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <ErrorState message={error.message} onRetry={() => refetch()} />
        ) : isLoading || !data ? (
          <TableSkeleton />
        ) : data.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="ยังไม่มีกฎตอบกลับ"
            description="สร้างกฎเพื่อให้ระบบตอบกลับลูกค้าอัตโนมัติเมื่อพบ Keyword ที่กำหนด"
            action={canManage && <Button onClick={() => openForm(null)}><Plus /> เพิ่มกฎแรก</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">เปิด</TableHead>
                <TableHead>กฎ / Keyword</TableHead>
                <TableHead className="hidden md:table-cell">เงื่อนไข</TableHead>
                <TableHead className="hidden lg:table-cell">ตอบกลับด้วย</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead className="hidden xl:table-cell">ถูกใช้งาน</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id} className={r.isActive ? "" : "opacity-60"}>
                  <TableCell>
                    <Switch
                      checked={r.isActive}
                      disabled={!canManage || toggle.isPending}
                      onCheckedChange={(v) => toggle.mutate({ id: r.id, isActive: v })}
                      aria-label={`เปิด/ปิด ${r.name}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="font-medium">{r.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.keywords.slice(0, 6).map((k) => (
                        <span key={k.id} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]">{k.keyword}</span>
                      ))}
                      {r.keywords.length > 6 && <span className="text-xs text-muted-foreground">+{r.keywords.length - 6}</span>}
                      {r.keywords.length === 0 && <span className="text-xs text-muted-foreground">{TRIGGER_LABELS[r.triggerType]}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col gap-1 text-xs">
                      <Badge variant="outline">{TRIGGER_LABELS[r.triggerType]}</Badge>
                      {r.keywords.length > 0 && (
                        <span className="text-muted-foreground">
                          {MATCH_TYPE_SHORT[r.matchType]}
                          {r.keywords.length > 1 && ` · ${r.keywordLogic === "ALL" ? "ทุกคำ" : "คำใดคำหนึ่ง"}`}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant={r.replyType === "FLEX" ? "info" : "secondary"}>{r.replyType === "FLEX" ? "Flex" : "Text"}</Badge>
                    <p className="mt-1 max-w-48 truncate text-xs text-muted-foreground">
                      {r.textTemplate?.name ?? r.flexTemplate?.name ?? <span className="text-destructive">ไม่พบ Template</span>}
                    </p>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{r.priority}</TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground xl:table-cell">
                    {formatNumber(r.matchCount)} ครั้ง
                    <br />
                    {r.lastMatchedAt ? formatRelative(r.lastMatchedAt, timezone) : "ยังไม่เคย"}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="เมนู"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openForm(r)}><Pencil /> แก้ไข</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openForm(r, true)}><Copy /> ทำสำเนา</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(r)}><Trash2 /> ลบ</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <RuleFormSheet open={formOpen} onOpenChange={setFormOpen} rule={editing} duplicate={duplicate} />
      <RuleTester open={testerOpen} onOpenChange={setTesterOpen} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบกฎตอบกลับ"
        description={`ต้องการลบกฎ "${deleting?.name}" ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้`}
        confirmLabel="ลบกฎ"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </>
  );
}
