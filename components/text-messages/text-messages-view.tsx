"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Braces, CopyPlus, FileText, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Field } from "@/components/common/field";
import { LineTextBubble } from "@/components/text-messages/line-text-bubble";
import { ChatBackdrop } from "@/components/flex/flex-preview";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { useDebounce } from "@/hooks/use-debounce";
import { formatRelative } from "@/lib/format";
import { findUnknownVariables, renderTemplate, TEMPLATE_VARIABLES, buildTemplateValues } from "@/lib/templates/variables";
import { cn } from "@/lib/utils";

type TextTemplate = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  updatedAt: string;
  _count?: { rules: number };
};

type Draft = { id: string | null; name: string; description: string; content: string };
const NEW_DRAFT: Draft = { id: null, name: "", description: "", content: "สวัสดีคุณ {{displayName}}\nเราได้รับข้อมูลของคุณเรียบร้อยแล้ว ขอบคุณที่ติดต่อเรา" };

export function TextMessagesView() {
  const { timezone } = useAppContext();
  const canManage = useCan("templates:manage");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search);
  const [draft, setDraft] = useState<Draft>(NEW_DRAFT);
  const [original, setOriginal] = useState<Draft>(NEW_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sampleName, setSampleName] = useState("สมชาย");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data, isLoading, error, refetch } = useApiQuery<TextTemplate[]>(
    ["text-templates", debounced],
    `/api/text-templates${debounced ? `?search=${encodeURIComponent(debounced)}` : ""}`,
    { placeholderData: (p) => p },
  );

  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const unknownVars = useMemo(() => findUnknownVariables(draft.content), [draft.content]);
  const charCount = [...draft.content].length;
  const preview = useMemo(() => {
    const values = buildTemplateValues({ displayName: sampleName, userId: "U1234567890abcdef1234567890abcdef", timezone });
    return renderTemplate(draft.content, values);
  }, [draft.content, sampleName, timezone]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const select = (t: TextTemplate | null) => {
    if (dirty && !window.confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการทิ้งการแก้ไขหรือไม่?")) return;
    const d = t ? { id: t.id, name: t.name, description: t.description ?? "", content: t.content } : NEW_DRAFT;
    setDraft(d);
    setOriginal(d);
    setErrors({});
  };

  const insertVariable = (key: string) => {
    const el = textareaRef.current;
    const token = `{{${key}}}`;
    if (!el) return setDraft((d) => ({ ...d, content: d.content + token }));
    const start = el.selectionStart ?? draft.content.length;
    const end = el.selectionEnd ?? start;
    const content = draft.content.slice(0, start) + token + draft.content.slice(end);
    setDraft((d) => ({ ...d, content }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async (asNew = false) => {
    setSaving(true);
    setErrors({});
    try {
      const body = { name: asNew && draft.id ? `${draft.name} (สำเนา)` : draft.name, description: draft.description || null, content: draft.content };
      const saved = await apiFetch<TextTemplate>(asNew || !draft.id ? "/api/text-templates" : `/api/text-templates/${draft.id}`, {
        method: asNew || !draft.id ? "POST" : "PUT",
        body,
      });
      const d = { id: saved.id, name: saved.name, description: saved.description ?? "", content: saved.content };
      setDraft(d);
      setOriginal(d);
      toast.success(asNew ? "บันทึกเป็น Template ใหม่แล้ว" : "บันทึกข้อความแล้ว");
      await qc.invalidateQueries({ queryKey: ["text-templates"] });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft.id) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/text-templates/${draft.id}`, { method: "DELETE" });
      toast.success("ลบข้อความแล้ว");
      setDraft(NEW_DRAFT);
      setOriginal(NEW_DRAFT);
      setConfirmDelete(false);
      await qc.invalidateQueries({ queryKey: ["text-templates"] });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Text Message"
        description="สร้างและแก้ไขข้อความตอบกลับ พร้อมตัวแปร Dynamic"
        actions={canManage && <Button onClick={() => select(null)}><Plus /> สร้างข้อความใหม่</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr] xl:grid-cols-[320px_1fr_360px]">
        <Card className="gap-0 py-0 lg:max-h-[calc(100dvh-10rem)]">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาข้อความ" className="pl-8" />
            </div>
          </div>
          <div className="thin-scrollbar max-h-80 overflow-y-auto lg:max-h-none lg:flex-1">
            {error ? (
              <ErrorState message={error.message} onRetry={() => refetch()} />
            ) : isLoading || !data ? (
              <LoadingState />
            ) : data.length === 0 ? (
              <EmptyState icon={FileText} title="ยังไม่มีข้อความ" description="สร้างข้อความเพื่อใช้ในกฎตอบกลับ" />
            ) : (
              <ul>
                {data.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => select(t)}
                      className={cn("w-full border-b px-4 py-3 text-left hover:bg-gray-50", draft.id === t.id && "bg-accent hover:bg-accent")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{t.name}</p>
                        {(t._count?.rules ?? 0) > 0 && <Badge variant="secondary">{t._count?.rules} กฎ</Badge>}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.content}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">แก้ไข {formatRelative(t.updatedAt, timezone)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{draft.id ? "แก้ไขข้อความ" : "ข้อความใหม่"}</CardTitle>
            <CardDescription>ข้อความจะถูกส่งเป็น LINE Text Message (สูงสุด 5,000 ตัวอักษร)</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="ชื่อ Template" htmlFor="tpl-name" required error={errors.name}>
              <Input id="tpl-name" value={draft.name} maxLength={100} disabled={!canManage} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="เช่น ข้อความต้อนรับ" />
            </Field>
            <Field label="คำอธิบาย" htmlFor="tpl-desc" error={errors.description}>
              <Input id="tpl-desc" value={draft.description} maxLength={500} disabled={!canManage} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            </Field>
            <div className="grid gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">ข้อความ<span className="text-destructive">*</span></span>
                <span className={cn("text-xs tabular-nums", charCount > 5000 ? "text-destructive" : "text-muted-foreground")}>{charCount.toLocaleString()} / 5,000</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map((v) => (
                  <Button key={v.key} type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={!canManage} onClick={() => insertVariable(v.key)} title={v.label}>
                    <Braces className="size-3" /> {v.key}
                  </Button>
                ))}
              </div>
              <Textarea
                ref={textareaRef}
                value={draft.content}
                disabled={!canManage}
                onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
                rows={10}
                className="font-[inherit]"
                aria-invalid={Boolean(errors.content) || unknownVars.length > 0}
              />
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
              {unknownVars.length > 0 && (
                <p className="text-xs text-destructive">ไม่รู้จักตัวแปร: {unknownVars.map((v) => `{{${v}}}`).join(", ")}</p>
              )}
              <div className="rounded-md bg-gray-50 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">ตัวแปรที่ใช้ได้</p>
                <ul className="grid gap-0.5 sm:grid-cols-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <li key={v.key}><code className="text-primary">{`{{${v.key}}}`}</code> — {v.label}</li>
                  ))}
                </ul>
                <p className="mt-1.5">ค่าของตัวแปรจะถูกทำความสะอาดอัตโนมัติ (ตัดอักขระควบคุม/ขึ้นบรรทัดใหม่ และจำกัดความยาว)</p>
              </div>
            </div>
            {canManage && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save(false)} disabled={saving || (!dirty && Boolean(draft.id))}>
                  {saving ? <Loader2 className="animate-spin" /> : <Save />} บันทึก
                </Button>
                {draft.id && (
                  <Button variant="outline" onClick={() => save(true)} disabled={saving}>
                    <CopyPlus /> บันทึกเป็น Template ใหม่
                  </Button>
                )}
                {draft.id && (
                  <Button variant="ghost" className="text-destructive hover:text-destructive sm:ml-auto" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> ลบ
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>ตัวอย่างการแสดงผลในแอป LINE</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Field label="ชื่อลูกค้าตัวอย่าง ({{displayName}})" htmlFor="sample-name">
              <Input id="sample-name" value={sampleName} onChange={(e) => setSampleName(e.target.value)} maxLength={100} />
            </Field>
            <ChatBackdrop className="min-h-48">
              <LineTextBubble text={preview} />
            </ChatBackdrop>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="ลบข้อความ"
        description={`ต้องการลบ "${draft.name}" ใช่หรือไม่? (ไม่สามารถลบได้หากถูกใช้งานในกฎตอบกลับหรือ Default Reply)`}
        confirmLabel="ลบ"
        destructive
        loading={deleting}
        onConfirm={remove}
      />
    </>
  );
}
