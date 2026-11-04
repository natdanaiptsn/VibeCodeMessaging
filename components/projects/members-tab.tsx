"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, LogOut, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { ErrorState, LoadingState } from "@/components/common/states";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { can, ROLE_LABELS, type Role } from "@/lib/auth/permissions";

type Member = {
  userId: string;
  name: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  providers: ("GOOGLE" | "LINE")[];
  role: Role;
};

type MembersData = { myRole: Role; myUserId: string; members: Member[] };

const ROLE_HELP: Record<Role, string> = {
  OWNER: "ทำได้ทุกอย่าง รวมถึงเชื่อม LINE OA และลบโปรเจกต์",
  ADMIN: "จัดการกฎ ข้อความ Flex การตั้งค่า และสมาชิก",
  AGENT: "ตอบแชทและดูข้อมูลลูกค้า",
};

export function MembersTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, error, isLoading, refetch } = useApiQuery<MembersData>(["members"], "/api/members");
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<Role>("AGENT");
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (isLoading || !data) return <LoadingState />;

  const canManage = can(data.myRole, "members:manage");
  const assignable = (["OWNER", "ADMIN", "AGENT"] as Role[]).filter((r) => r !== "OWNER" || data.myRole === "OWNER");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ["members"] });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ทำรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    void run("add", async () => {
      await apiFetch("/api/members", { method: "POST", body: { identifier, role } });
      toast.success("เพิ่มสมาชิกแล้ว");
      setIdentifier("");
    });
  };

  const changeRole = (m: Member, r: Role) =>
    run(m.userId, async () => {
      await apiFetch(`/api/members/${m.userId}`, { method: "PATCH", body: { role: r } });
      toast.success(`เปลี่ยน ${m.name} เป็น${ROLE_LABELS[r]}แล้ว`);
    });

  const remove = (m: Member) => {
    const self = m.userId === data.myUserId;
    if (!window.confirm(self ? "ออกจากโปรเจกต์นี้? (จะเข้าโปรเจกต์นี้ไม่ได้อีกจนกว่าจะมีคนเพิ่มกลับ)" : `นำ ${m.name} ออกจากโปรเจกต์?`)) return;
    void run(m.userId, async () => {
      await apiFetch(`/api/members/${m.userId}`, { method: "DELETE" });
      toast.success(self ? "ออกจากโปรเจกต์แล้ว" : `นำ ${m.name} ออกแล้ว`);
      if (self) router.push("/projects");
    });
  };

  return (
    <div className="grid gap-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-primary" /> เพิ่มสมาชิก
            </CardTitle>
            <CardDescription>
              ใส่อีเมลหรือชื่อผู้ใช้ของบัญชีที่มีในระบบแล้ว (ดูได้ที่เมนู “บัญชีและผู้ใช้งาน” ของบัญชีนั้น) — ถ้ายังไม่มีบัญชี ให้เข้าสู่ระบบด้วย Google หรือ LINE หนึ่งครั้งก่อน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={add} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
              <Field label="อีเมลหรือชื่อผู้ใช้" htmlFor="member-id">
                <Input
                  id="member-id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="เช่น somchai@gmail.com"
                  autoComplete="off"
                />
              </Field>
              <Field label="บทบาท">
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger aria-label="บทบาท">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {assignable.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" disabled={busy !== null || !identifier.trim()}>
                {busy === "add" ? <Loader2 className="animate-spin" /> : <UserPlus />} เพิ่ม
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
          </CardContent>
        </Card>
      )}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-5">
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" /> สมาชิก ({data.members.length})
          </CardTitle>
          <CardDescription>เฉพาะสมาชิกเท่านั้นที่เห็นและจัดการโปรเจกต์นี้ได้</CardDescription>
        </CardHeader>
        <ul className="divide-y">
          {data.members.map((m) => {
            const self = m.userId === data.myUserId;
            const editable = canManage && !self && (m.role !== "OWNER" || data.myRole === "OWNER");
            return (
              <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
                <ProjectAvatar name={m.name} pictureUrl={m.avatarUrl} className="size-9 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    <span className="truncate">{m.name}</span>
                    {self && <Badge variant="muted">คุณ</Badge>}
                    {!m.isActive && <Badge variant="destructive">ปิดใช้งาน</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[m.email, m.username && `@${m.username}`, ...m.providers.map((p) => (p === "GOOGLE" ? "Google" : "LINE"))]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </p>
                </div>
                {editable ? (
                  <Select value={m.role} onValueChange={(v) => changeRole(m, v as Role)} disabled={busy !== null}>
                    <SelectTrigger size="sm" className="w-32" aria-label={`บทบาทของ ${m.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {assignable.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={m.role === "OWNER" ? "success" : "outline"}>{ROLE_LABELS[m.role]}</Badge>
                )}
                {(editable || self) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy !== null}
                    onClick={() => remove(m)}
                    aria-label={self ? "ออกจากโปรเจกต์" : `นำ ${m.name} ออก`}
                    title={self ? "ออกจากโปรเจกต์" : "นำออก"}
                  >
                    {busy === m.userId ? <Loader2 className="animate-spin" /> : self ? <LogOut /> : <Trash2 />}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
