"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleSlash,
  FolderPlus,
  Loader2,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  PlugZap,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/common/page-header";
import { Field } from "@/components/common/field";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { ProjectAvatar } from "@/components/projects/project-avatar";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { can, ROLE_LABELS, type Role } from "@/lib/auth/permissions";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Project = {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  basicId: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  connectionStatus: "UNKNOWN" | "CONNECTED" | "FAILED";
  hasCredentials: boolean;
  autoReplyEnabled: boolean;
  /** บทบาทของฉันในโปรเจกต์นี้ */
  role: Role;
  members: number;
  lastWebhookAt: string | null;
  stats: { customers: number; activeRules: number; messages7d: number };
};

type Filter = "all" | "mine" | "shared" | "connected" | "not-connected";

const isConnected = (p: Project) => p.connectionStatus === "CONNECTED";
const isMine = (p: Project) => p.role === "OWNER";

const FILTER_FNS: Record<Filter, (p: Project) => boolean> = {
  all: () => true,
  mine: isMine,
  shared: (p) => !isMine(p),
  connected: isConnected,
  "not-connected": (p) => !isConnected(p),
};

function StatusBadge({ project }: { project: Project }) {
  if (project.connectionStatus === "CONNECTED") {
    return (
      <Badge variant="success">
        <CheckCircle2 /> เชื่อมต่อ LINE แล้ว
      </Badge>
    );
  }
  if (project.connectionStatus === "FAILED") {
    return (
      <Badge variant="destructive">
        <AlertTriangle /> เชื่อมต่อไม่สำเร็จ
      </Badge>
    );
  }
  if (project.hasCredentials) {
    return (
      <Badge variant="warning">
        <AlertTriangle /> รอตรวจสอบการเชื่อมต่อ
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <CircleSlash /> ยังไม่ได้เชื่อมต่อ LINE
    </Badge>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 px-3 py-2">
      <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        <Icon className="size-3 shrink-0" /> {label}
      </p>
      <p className="text-lg leading-tight font-semibold">{formatNumber(value)}</p>
    </div>
  );
}

function ProjectCard({
  project,
  onEdit,
  onDelete,
  onLeave,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onLeave: () => void;
}) {
  // สิทธิ์ตามบทบาทของฉันในโปรเจกต์นี้
  const canManage = can(project.role, "projects:manage");
  const canDelete = can(project.role, "projects:delete");
  const canLine = can(project.role, "line:view");
  const base = `/p/${project.id}`;
  const connected = isConnected(project);
  return (
    <Card className="gap-0 py-0 transition hover:border-primary/50 hover:shadow-sm">
      <div className="flex items-start gap-3 p-4 pb-3">
        <ProjectAvatar name={project.name} pictureUrl={project.pictureUrl} className="size-11 text-base" />
        <div className="min-w-0 flex-1">
          <Link href={`${base}/inbox`} className="flex items-center gap-1.5 hover:underline">
            <span className="truncate font-semibold">{project.name}</span>
            {project.isDefault && (
              <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="โปรเจกต์หลัก" />
            )}
          </Link>
          {!isMine(project) && (
            <p className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-300">
              <Users className="size-3" /> แชร์กับฉัน · {ROLE_LABELS[project.role]}
            </p>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {project.displayName ? (
              <>
                LINE OA: {project.displayName}
                {project.basicId && <span className="font-mono"> · {project.basicId}</span>}
              </>
            ) : (
              "ยังไม่ได้ผูกบัญชี LINE OA"
            )}
          </p>
        </div>
        {(canManage || canDelete || canLine || !isMine(project)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`เมนูของ ${project.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canManage && (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> เปลี่ยนชื่อ / คำอธิบาย
                </DropdownMenuItem>
              )}
              {canLine && (
                <DropdownMenuItem asChild>
                  <Link href={`${base}/line-settings`}>
                    <PlugZap /> ตั้งค่าการเชื่อมต่อ LINE
                  </Link>
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                    <Trash2 /> ลบโปรเจกต์
                  </DropdownMenuItem>
                </>
              )}
              {!isMine(project) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={onLeave}>
                    <LogOut /> ออกจากโปรเจกต์
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge project={project} />
          <Badge variant={project.autoReplyEnabled ? "info" : "muted"}>
            <Bot /> ตอบกลับอัตโนมัติ{project.autoReplyEnabled ? "เปิด" : "ปิด"}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={Users} label="ลูกค้า" value={project.stats.customers} />
          <Stat icon={Bot} label="กฎที่เปิด" value={project.stats.activeRules} />
          <Stat icon={MessagesSquare} label="ข้อความ 7 วัน" value={project.stats.messages7d} />
        </div>
      </div>

      <div className="mt-auto flex items-center gap-2 border-t px-4 py-3">
        {!connected && canLine ? (
          <>
            <Button asChild size="sm" className="flex-1">
              <Link href={`${base}/line-settings`}>
                <PlugZap /> {project.hasCredentials ? "ตรวจสอบการเชื่อมต่อ" : "เชื่อมต่อ LINE OA"}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`${base}/inbox`}>เปิด</Link>
            </Button>
          </>
        ) : (
          <Button asChild size="sm" variant="outline" className="flex-1">
            <Link href={`${base}/inbox`}>
              เปิดโปรเจกต์ <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}

function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project: Project | null;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const editing = Boolean(project);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("กรุณากรอกชื่อโปรเจกต์");
    setSaving(true);
    setError(undefined);
    try {
      if (project) {
        await apiFetch(`/api/projects/${project.id}`, { method: "PATCH", body: { name, description: description || null } });
        toast.success("บันทึกแล้ว");
        await qc.invalidateQueries({ queryKey: ["projects"] });
        onOpenChange(false);
      } else {
        const created = await apiFetch<{ id: string; name: string }>("/api/projects", {
          method: "POST",
          body: { name, description: description || null },
        });
        toast.success(`สร้างโปรเจกต์ “${created.name}” แล้ว — ต่อไปเชื่อมต่อ LINE OA`);
        await qc.invalidateQueries({ queryKey: ["projects"] });
        router.push(`/p/${created.id}/line-settings`);
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? (err.fieldErrors.name ?? err.message) : "บันทึกไม่สำเร็จ";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{editing ? "แก้ไขโปรเจกต์" : "สร้างโปรเจกต์ใหม่"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "เปลี่ยนชื่อหรือคำอธิบายของโปรเจกต์"
                : "1 โปรเจกต์เชื่อมต่อ LINE OA ได้ 1 บัญชี กฎตอบกลับ ข้อความ Flex และลูกค้าจะแยกจากโปรเจกต์อื่น"}
            </DialogDescription>
          </DialogHeader>
          <Field label="ชื่อโปรเจกต์" htmlFor="project-name" required error={error}>
            <Input
              id="project-name"
              value={name}
              maxLength={80}
              autoFocus
              placeholder="เช่น ร้านกาแฟสาขาสยาม"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="คำอธิบาย (ไม่บังคับ)" htmlFor="project-desc">
            <Textarea
              id="project-desc"
              value={description}
              maxLength={300}
              rows={2}
              placeholder="เช่น LINE OA สำหรับลูกค้าหน้าร้าน"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : editing ? <Pencil /> : <FolderPlus />}
              {editing ? "บันทึก" : "สร้างโปรเจกต์"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProjectDialog({ project, onOpenChange }: { project: Project; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const match = typed.trim() === project.name.trim();
  const remove = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: "DELETE" });
      toast.success(`ลบโปรเจกต์ “${project.name}” แล้ว`);
      await qc.invalidateQueries({ queryKey: ["projects"] });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ลบโปรเจกต์ “{project.name}”</DialogTitle>
          <DialogDescription>
            ข้อมูลทั้งหมดของโปรเจกต์นี้จะถูกลบถาวร ได้แก่ ลูกค้า {formatNumber(project.stats.customers)} ราย, ข้อความ, กฎตอบกลับ, Text Message
            และ Flex Message — กู้คืนไม่ได้ (บัญชี LINE OA ไม่ถูกลบ แต่จะไม่ตอบกลับอัตโนมัติอีก)
          </DialogDescription>
        </DialogHeader>
        <Field label={<>พิมพ์ชื่อโปรเจกต์ “{project.name}” เพื่อยืนยัน</>} htmlFor="confirm-name">
          <Input id="confirm-name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" onClick={remove} disabled={!match || busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Trash2 />} ลบโปรเจกต์
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsView() {
  const router = useRouter();
  const params = useSearchParams();
  const canCreate = useCan("projects:create");
  const { user } = useAppContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // ?create=1 (จากเมนูเลือกโปรเจกต์) เปิดหน้าต่างสร้างโปรเจกต์ทันที
  const [form, setForm] = useState<{ open: boolean; project: Project | null }>(() => ({
    open: canCreate && params.get("create") === "1",
    project: null,
  }));
  const [deleting, setDeleting] = useState<Project | null>(null);
  const { data, isLoading, error, refetch } = useApiQuery<Project[]>(["projects"], "/api/projects");

  const q = search.trim().toLowerCase();
  const all = data ?? [];
  const counts = Object.fromEntries(
    (Object.keys(FILTER_FNS) as Filter[]).map((k) => [k, all.filter(FILTER_FNS[k]).length]),
  ) as Record<Filter, number>;
  const shown = all.filter(
    (p) => FILTER_FNS[filter](p) && (!q || [p.name, p.description, p.displayName, p.basicId].some((v) => v?.toLowerCase().includes(q))),
  );

  const leave = async (p: Project) => {
    if (!window.confirm(`ออกจากโปรเจกต์ “${p.name}”? (จะเข้าโปรเจกต์นี้ไม่ได้อีกจนกว่าเจ้าของจะเพิ่มกลับ)`)) return;
    try {
      // อยู่นอกหน้าโปรเจกต์ จึงระบุโปรเจกต์เองผ่าน header
      await apiFetch(`/api/members/${user.id}`, { method: "DELETE", headers: { "x-project-id": p.id } });
      toast.success(`ออกจากโปรเจกต์ “${p.name}” แล้ว`);
      await qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ทำรายการไม่สำเร็จ");
    }
  };

  const closeForm = (open: boolean) => {
    setForm((f) => ({ ...f, open }));
    if (!open && params.get("create")) router.replace("/projects", { scroll: false });
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "ทั้งหมด" },
    { key: "mine", label: "ของฉัน" },
    { key: "shared", label: "แชร์กับฉัน" },
    { key: "connected", label: "เชื่อมต่อแล้ว" },
    { key: "not-connected", label: "ยังไม่เชื่อมต่อ" },
  ];

  return (
    <>
      <PageHeader
        title="โปรเจกต์"
        description="โปรเจกต์ของคุณและที่มีคนแชร์ให้ — แต่ละโปรเจกต์เชื่อมต่อ LINE OA ได้ 1 บัญชี กฎตอบกลับ ข้อความ Flex และลูกค้าแยกกัน"
        actions={
          canCreate && (
            <Button onClick={() => setForm({ open: true, project: null })}>
              <Plus /> สร้างโปรเจกต์
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อโปรเจกต์ หรือ LINE OA" className="pl-8" />
        </div>
        <div role="tablist" aria-label="กรองตามสถานะ" className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/60 p-1">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                filter === key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{data ? counts[key] : "–"}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderPlus}
            title={all.length === 0 ? "ยังไม่มีโปรเจกต์" : "ไม่พบโปรเจกต์ที่ตรงกับเงื่อนไข"}
            description={
              all.length === 0
                ? "สร้างโปรเจกต์แรกของคุณ แล้วเชื่อมต่อ LINE OA เพื่อเริ่มตอบกลับอัตโนมัติ (หรือให้เจ้าของโปรเจกต์เพิ่มคุณเป็นสมาชิก)"
                : undefined
            }
            action={
              all.length === 0 &&
              canCreate && (
                <Button onClick={() => setForm({ open: true, project: null })}>
                  <Plus /> สร้างโปรเจกต์แรก
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => setForm({ open: true, project: p })}
              onDelete={() => setDeleting(p)}
              onLeave={() => leave(p)}
            />
          ))}
          {canCreate && filter === "all" && !q && (
            <button
              onClick={() => setForm({ open: true, project: null })}
              className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              <FolderPlus className="size-7" />
              สร้างโปรเจกต์ใหม่
              <span className="text-xs">สำหรับ LINE OA อีกบัญชี</span>
            </button>
          )}
        </div>
      )}

      {form.open && <ProjectFormDialog key={form.project?.id ?? "new"} open onOpenChange={closeForm} project={form.project} />}
      {deleting && <DeleteProjectDialog project={deleting} onOpenChange={(o) => !o && setDeleting(null)} />}
    </>
  );
}
