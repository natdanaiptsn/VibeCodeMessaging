"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Plus, Save, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/field";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState, LoadingState, TableSkeleton } from "@/components/common/states";
import { apiFetch, ApiClientError, useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import type { SystemSettings } from "@/lib/validation/settings";

const TIMEZONES = ["Asia/Bangkok", "Asia/Ho_Chi_Minh", "Asia/Jakarta", "Asia/Singapore", "Asia/Kuala_Lumpur", "Asia/Manila", "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Taipei", "Asia/Kolkata", "Europe/London", "UTC"];

function SettingRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0 sm:w-64 sm:text-right">{children}</div>
    </div>
  );
}

function SettingsSections({ original }: { original: SystemSettings }) {
  const [draft, setDraft] = useState<SystemSettings>(() => structuredClone(original));
  return (
    <>
      <TabsContent value="general"><GeneralTab draft={draft} setDraft={setDraft} original={original} /></TabsContent>
      <TabsContent value="auto-reply"><DefaultReplyTab draft={draft} setDraft={setDraft} original={original} /></TabsContent>
      <TabsContent value="logging"><LoggingTab draft={draft} setDraft={setDraft} original={original} /></TabsContent>
    </>
  );
}

function SaveSection({ section, draft, original }: { section: keyof SystemSettings; draft: SystemSettings; original?: SystemSettings }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const canManage = useCan("settings:manage");
  const dirty = JSON.stringify(draft[section]) !== JSON.stringify(original?.[section]);
  if (!canManage) return null;
  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings", { method: "PUT", body: { [section]: draft[section] } });
      toast.success("บันทึกการตั้งค่าแล้ว");
      await Promise.all([qc.invalidateQueries({ queryKey: ["settings"] }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <CardFooter className="justify-end border-t">
      <Button onClick={save} disabled={saving || !dirty}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />} บันทึก
      </Button>
    </CardFooter>
  );
}

function GeneralTab({ draft, setDraft, original }: { draft: SystemSettings; setDraft: (d: SystemSettings) => void; original?: SystemSettings }) {
  const g = draft.general;
  const canManage = useCan("settings:manage");
  const set = (patch: Partial<SystemSettings["general"]>) => setDraft({ ...draft, general: { ...g, ...patch } });
  return (
    <Card>
      <CardHeader>
        <CardTitle>การตั้งค่าทั่วไป</CardTitle>
        <CardDescription>ควบคุมการทำงานของระบบตอบกลับอัตโนมัติ</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow title="เปิด/ปิด Auto Reply" description="ปิดเพื่อหยุดตอบกลับอัตโนมัติทั้งหมด (ยังรับและบันทึกข้อความตามปกติ)">
          <Switch checked={g.autoReplyEnabled} disabled={!canManage} onCheckedChange={(v) => set({ autoReplyEnabled: v })} />
        </SettingRow>
        <SettingRow title="เมื่อข้อความตรงกับหลายกฎ" description="กำหนดพฤติกรรมเมื่อพบหลายกฎที่ตรงเงื่อนไข (เรียงตาม Priority จากมากไปน้อย)">
          <Select value={g.multiRuleMode} disabled={!canManage} onValueChange={(v) => set({ multiRuleMode: v as typeof g.multiRuleMode })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="FIRST_MATCH">ใช้กฎ Priority สูงสุดกฎเดียว</SelectItem>
              <SelectItem value="ALL_MATCHES">ส่งทุกกฎที่ตรง</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title="จำนวนข้อความสูงสุดต่อการตอบกลับ" description="LINE อนุญาตสูงสุด 5 ข้อความต่อ 1 Reply">
          <Select value={String(g.maxMessagesPerReply)} disabled={!canManage} onValueChange={(v) => set({ maxMessagesPerReply: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n} ข้อความ</SelectItem>)}</SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title="ใช้ Push Message เมื่อ Reply Token หมดอายุ" description="ส่งด้วย Push API แทน (นับโควตาข้อความ) พร้อม Retry Key ป้องกันส่งซ้ำ">
          <Switch checked={g.pushFallbackEnabled} disabled={!canManage} onCheckedChange={(v) => set({ pushFallbackEnabled: v })} />
        </SettingRow>
        <SettingRow title="ดึงข้อมูลโปรไฟล์ลูกค้าจาก LINE" description="ดึง Display Name และรูปโปรไฟล์อัตโนมัติ (อัปเดตทุก 24 ชั่วโมง)">
          <Switch checked={g.fetchProfileEnabled} disabled={!canManage} onCheckedChange={(v) => set({ fetchProfileEnabled: v })} />
        </SettingRow>
        <SettingRow title="Timezone" description="ใช้กับตัวแปร {{date}}, {{time}} และสถิติรายวัน">
          <Select value={g.timezone} disabled={!canManage} onValueChange={(v) => set({ timezone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
          </Select>
        </SettingRow>
      </CardContent>
      <SaveSection section="general" draft={draft} original={original} />
    </Card>
  );
}

function DefaultReplyTab({ draft, setDraft, original }: { draft: SystemSettings; setDraft: (d: SystemSettings) => void; original?: SystemSettings }) {
  const d = draft.defaultReply;
  const canManage = useCan("settings:manage");
  const set = (patch: Partial<SystemSettings["defaultReply"]>) => setDraft({ ...draft, defaultReply: { ...d, ...patch } });
  const texts = useApiQuery<{ id: string; name: string }[]>(["text-templates"], "/api/text-templates");
  const flexes = useApiQuery<{ id: string; name: string }[]>(["flex-templates"], "/api/flex-templates");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Default Reply</CardTitle>
        <CardDescription>ข้อความที่ส่งเมื่อไม่พบ Keyword ที่ตรงกับกฎใดเลย</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow title="เปิดใช้งาน Default Reply">
          <Switch checked={d.enabled} disabled={!canManage} onCheckedChange={(v) => set({ enabled: v })} />
        </SettingRow>
        <SettingRow title="รูปแบบข้อความ">
          <Select value={d.replyType} disabled={!canManage} onValueChange={(v) => set({ replyType: v as "TEXT" | "FLEX" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">Text Message</SelectItem>
              <SelectItem value="FLEX">Flex Message</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title={d.replyType === "TEXT" ? "ข้อความ" : "Flex Message"}>
          {d.replyType === "TEXT" ? (
            <Select value={d.textTemplateId ?? ""} disabled={!canManage} onValueChange={(v) => set({ textTemplateId: v })}>
              <SelectTrigger><SelectValue placeholder="เลือกข้อความ" /></SelectTrigger>
              <SelectContent>{(texts.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <Select value={d.flexTemplateId ?? ""} disabled={!canManage} onValueChange={(v) => set({ flexTemplateId: v })}>
              <SelectTrigger><SelectValue placeholder="เลือก Flex Message" /></SelectTrigger>
              <SelectContent>{(flexes.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </SettingRow>
        <SettingRow title="ใช้กับรูปภาพ / สติกเกอร์ / ตำแหน่ง" description="ส่ง Default Reply เมื่อลูกค้าส่งข้อความที่ไม่ใช่ตัวอักษรและไม่มีกฎรองรับ">
          <Switch checked={d.applyToNonText} disabled={!canManage} onCheckedChange={(v) => set({ applyToNonText: v })} />
        </SettingRow>
        <SettingRow title="Cooldown (นาที)" description="ไม่ส่ง Default Reply ซ้ำให้ลูกค้าคนเดิมภายในเวลาที่กำหนด (0 = ส่งทุกครั้ง)">
          <Input type="number" min={0} max={1440} value={d.cooldownMinutes} disabled={!canManage} onChange={(e) => set({ cooldownMinutes: Math.max(0, Math.min(1440, Number(e.target.value) || 0)) })} />
        </SettingRow>
      </CardContent>
      <SaveSection section="defaultReply" draft={draft} original={original} />
    </Card>
  );
}

function LoggingTab({ draft, setDraft, original }: { draft: SystemSettings; setDraft: (d: SystemSettings) => void; original?: SystemSettings }) {
  const l = draft.logging;
  const canManage = useCan("settings:manage");
  const set = (patch: Partial<SystemSettings["logging"]>) => setDraft({ ...draft, logging: { ...l, ...patch } });
  return (
    <Card>
      <CardHeader>
        <CardTitle>ระบบ Log</CardTitle>
        <CardDescription>ระดับการบันทึก และระยะเวลาการเก็บข้อมูล (ลบอัตโนมัติทุกชั่วโมง)</CardDescription>
      </CardHeader>
      <CardContent>
        <SettingRow title="ระดับ Log ของเซิร์ฟเวอร์">
          <Select value={l.logLevel} disabled={!canManage} onValueChange={(v) => set({ logLevel: v as typeof l.logLevel })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow title="เก็บประวัติการตอบกลับ (วัน)" description="0 = เก็บถาวร">
          <Input type="number" min={0} max={3650} value={l.replyLogRetentionDays} disabled={!canManage} onChange={(e) => set({ replyLogRetentionDays: Math.max(0, Number(e.target.value) || 0) })} />
        </SettingRow>
        <SettingRow title="เก็บ Webhook Event (วัน)" description="Event ที่ประมวลผลแล้ว (ใช้ตรวจสอบย้อนหลังและป้องกัน Event ซ้ำ)">
          <Input type="number" min={1} max={365} value={l.webhookEventRetentionDays} disabled={!canManage} onChange={(e) => set({ webhookEventRetentionDays: Math.max(1, Number(e.target.value) || 1) })} />
        </SettingRow>
        <SettingRow title="บันทึก LINE API Response" description="เก็บเฉพาะข้อมูลที่จำเป็น (Message ID, Request ID) — ไม่บันทึก Token/Secret">
          <Switch checked={l.storeLineResponse} disabled={!canManage} onCheckedChange={(v) => set({ storeLineResponse: v })} />
        </SettingRow>
      </CardContent>
      <SaveSection section="logging" draft={draft} original={original} />
    </Card>
  );
}

function AccountTab() {
  const { user } = useAppContext();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await apiFetch("/api/auth/change-password", { method: "POST", body: form });
      toast.success("เปลี่ยนรหัสผ่านแล้ว (ออกจากระบบอุปกรณ์อื่นทั้งหมด)");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> เปลี่ยนรหัสผ่าน Admin</CardTitle>
        <CardDescription>{user.name} ({user.email}) · {ROLE_LABELS[user.role]}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid max-w-md gap-4">
          <Field label="รหัสผ่านปัจจุบัน" htmlFor="cur-pw" error={errors.currentPassword}>
            <Input id="cur-pw" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </Field>
          <Field label="รหัสผ่านใหม่" htmlFor="new-pw" error={errors.newPassword} hint="อย่างน้อย 10 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข">
            <Input id="new-pw" type="password" autoComplete="new-password" required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่" htmlFor="confirm-pw" error={errors.confirmPassword}>
            <Input id="confirm-pw" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </Field>
          <Button type="submit" className="justify-self-start" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <ShieldCheck />} เปลี่ยนรหัสผ่าน
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

type UserRow = { id: string; email: string; name: string; role: Role; isActive: boolean; lastLoginAt: string | null; lockedUntil: string | null; createdAt: string };

function UsersTab() {
  const { user: me, timezone } = useAppContext();
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useApiQuery<UserRow[]>(["users"], "/api/users");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "ADMIN" as Role, password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const update = useApiMutation<{ id: string; data: Partial<UserRow> }, UserRow>({
    url: (v) => `/api/users/${v.id}`,
    method: "PATCH",
    body: (v) => v.data,
    successMessage: "อัปเดตผู้ใช้แล้ว",
    invalidate: [["users"]],
  });
  const remove = useApiMutation<string>({
    url: (id) => `/api/users/${id}`,
    method: "DELETE",
    body: () => undefined,
    successMessage: "ลบผู้ใช้แล้ว",
    invalidate: [["users"]],
    onSuccess: () => setDeleting(null),
  });
  const create = async () => {
    setSaving(true);
    setErrors({});
    try {
      await apiFetch("/api/users", { method: "POST", body: form });
      toast.success("เพิ่มผู้ใช้แล้ว");
      setCreateOpen(false);
      setForm({ email: "", name: "", role: "ADMIN", password: "" });
      await qc.invalidateQueries({ queryKey: ["users"] });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-5">
        <CardTitle className="flex items-center gap-2"><UserCog className="size-4 text-primary" /> ผู้ใช้งานระบบ</CardTitle>
        <CardDescription>OWNER: จัดการทุกอย่าง · ADMIN: จัดการกฎ/Template/ตั้งค่า · AGENT: ใช้งานกล่องข้อความ</CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus /> เพิ่มผู้ใช้</Button>
        </div>
      </CardHeader>
      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <TableSkeleton />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ผู้ใช้</TableHead>
              <TableHead>สิทธิ์</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="hidden md:table-cell">เข้าสู่ระบบล่าสุด</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <p className="font-medium">{u.name} {u.id === me.id && <Badge variant="secondary">คุณ</Badge>}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => update.mutate({ id: u.id, data: { role: v as Role } })}>
                    <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={u.isActive} disabled={u.id === me.id} onCheckedChange={(v) => update.mutate({ id: u.id, data: { isActive: v } })} />
                    {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <Badge variant="warning">ล็อกชั่วคราว</Badge>}
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDateTime(u.lastLoginAt, timezone)}</TableCell>
                <TableCell>
                  {u.id !== me.id && (
                    <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => setDeleting(u)} aria-label="ลบผู้ใช้"><Trash2 /></Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>เพิ่มผู้ใช้</DialogTitle>
            <DialogDescription>ผู้ใช้ใหม่จะเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่กำหนด</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="ชื่อ" htmlFor="u-name" error={errors.name}><Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="อีเมล" htmlFor="u-email" error={errors.email}><Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="สิทธิ์" error={errors.role}>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(ROLE_LABELS) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="รหัสผ่านเริ่มต้น" htmlFor="u-pw" error={errors.password} hint="อย่างน้อย 10 ตัวอักษร มีตัวอักษรและตัวเลข">
              <Input id="u-pw" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>ยกเลิก</Button>
            <Button onClick={create} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus />} เพิ่มผู้ใช้</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบผู้ใช้"
        description={`ต้องการลบ ${deleting?.email} ใช่หรือไม่?`}
        confirmLabel="ลบ"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Card>
  );
}

type AuditRow = { id: string; action: string; entityType: string; entityId: string | null; summary: string | null; ipAddress: string | null; createdAt: string; user: { name: string; email: string } | null };

function AuditTab() {
  const { timezone } = useAppContext();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("all");
  const qs = new URLSearchParams({ page: String(page), pageSize: "25", ...(entityType !== "all" ? { entityType } : {}) }).toString();
  const { data, isLoading, error, refetch } = useApiQuery<{ items: AuditRow[]; total: number; page: number; pageSize: number }>(["audit", qs], `/api/audit-logs?${qs}`, { placeholderData: (p) => p });
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-5">
        <CardTitle>Audit Log</CardTitle>
        <CardDescription>บันทึกการแก้ไขกฎ, Template, การตั้งค่า และการเข้าสู่ระบบ</CardDescription>
        <div className="col-start-2 row-span-2 row-start-1 self-start justify-self-end">
          <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
            <SelectTrigger size="sm" className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="ReplyRule">กฎตอบกลับ</SelectItem>
              <SelectItem value="ReplyTemplate">Text Template</SelectItem>
              <SelectItem value="FlexTemplate">Flex Template</SelectItem>
              <SelectItem value="SystemSetting">ตั้งค่าระบบ</SelectItem>
              <SelectItem value="LineAccount">LINE OA</SelectItem>
              <SelectItem value="User">ผู้ใช้</SelectItem>
              <SelectItem value="Customer">ลูกค้า</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <TableSkeleton />
      ) : data.items.length === 0 ? (
        <EmptyState title="ยังไม่มี Audit Log" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เวลา</TableHead>
                <TableHead>ผู้ใช้</TableHead>
                <TableHead>การกระทำ</TableHead>
                <TableHead className="hidden lg:table-cell">IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatDateTime(a.createdAt, timezone)}</TableCell>
                  <TableCell className="text-sm">{a.user?.name ?? "ระบบ"}</TableCell>
                  <TableCell>
                    <p className="text-sm">{a.summary ?? a.action}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{a.action}</p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">{a.ipAddress ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}
    </Card>
  );
}

export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const canUsers = useCan("users:manage");
  const canAudit = useCan("audit:view");
  const canSettings = useCan("settings:view");
  const requested = params.get("tab") ?? (canSettings ? "general" : "account");
  const tab = !canSettings && ["general", "auto-reply", "logging"].includes(requested) ? "account" : requested;
  const settings = useApiQuery<SystemSettings>(["settings"], canSettings ? "/api/settings" : null);

  return (
    <>
      <PageHeader title="ตั้งค่าระบบ" description="การทำงานของระบบตอบกลับ, Default Reply, Log และบัญชีผู้ใช้" />
      <Tabs value={tab} onValueChange={(v) => router.replace(`/settings?tab=${v}`, { scroll: false })}>
        <TabsList>
          {canSettings && <TabsTrigger value="general">ทั่วไป</TabsTrigger>}
          {canSettings && <TabsTrigger value="auto-reply">Default Reply</TabsTrigger>}
          {canSettings && <TabsTrigger value="logging">ระบบ Log</TabsTrigger>}
          <TabsTrigger value="account">รหัสผ่าน</TabsTrigger>
          {canUsers && <TabsTrigger value="users">ผู้ใช้งาน</TabsTrigger>}
          {canAudit && <TabsTrigger value="audit">Audit Log</TabsTrigger>}
        </TabsList>
        {canSettings && ["general", "auto-reply", "logging"].includes(tab) &&
          (settings.error ? (
            <ErrorState message={settings.error.message} onRetry={() => settings.refetch()} />
          ) : !settings.data ? (
            <LoadingState />
          ) : (
            <SettingsSections key={settings.dataUpdatedAt} original={settings.data} />
          ))}
        <TabsContent value="account"><AccountTab /></TabsContent>
        {canUsers && <TabsContent value="users"><UsersTab /></TabsContent>}
        {canAudit && <TabsContent value="audit"><AuditTab /></TabsContent>}
      </Tabs>
    </>
  );
}
