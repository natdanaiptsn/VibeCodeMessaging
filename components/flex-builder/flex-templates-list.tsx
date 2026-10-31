"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, LayoutTemplate, Loader2, MoreHorizontal, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/common/page-header";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { ChatBackdrop, FlexPreview } from "@/components/flex/flex-preview";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { useAppContext, useCan } from "@/hooks/use-app-context";
import { formatRelative } from "@/lib/format";
import { FLEX_PRESETS } from "@/lib/flex/presets";
import { renderFlexVariables } from "@/lib/flex/render";
import { sampleTemplateValues } from "@/lib/templates/variables";

type Item = { id: string; name: string; description: string | null; altText: string; containerType: string; contents: unknown; updatedAt: string; _count: { rules: number } };

export function FlexTemplatesList() {
  const { timezone } = useAppContext();
  const canEdit = useCan("flex:manage");
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const debounced = useDebounce(search);
  const { data, isLoading, error, refetch } = useApiQuery<Item[]>(["flex-templates", debounced], `/api/flex-templates${debounced ? `?search=${encodeURIComponent(debounced)}` : ""}`, {
    placeholderData: (p) => p,
  });

  const duplicate = async (t: Item) => {
    setBusy(true);
    try {
      const created = await apiFetch<{ id: string }>("/api/flex-templates", {
        method: "POST",
        body: { name: `${t.name} (สำเนา)`.slice(0, 100), altText: t.altText, description: t.description, contents: t.contents },
      });
      toast.success("ทำสำเนาแล้ว");
      await qc.invalidateQueries({ queryKey: ["flex-templates"] });
      router.push(`/flex-builder/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ทำสำเนาไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiFetch(`/api/flex-templates/${deleting.id}`, { method: "DELETE" });
      toast.success("ลบ Template แล้ว");
      setDeleting(null);
      await qc.invalidateQueries({ queryKey: ["flex-templates"] });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Flex Message Builder"
        description="ออกแบบ Flex Message แบบ Visual โดยไม่ต้องเขียน JSON"
        actions={canEdit && <Button asChild><Link href="/flex-builder/new"><Plus /> สร้าง Flex Message</Link></Button>}
      />
      {canEdit && (
        <div className="mb-5">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Sparkles className="size-4 text-primary" /> เริ่มจากเทมเพลต</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {FLEX_PRESETS.map((p) => (
              <Link key={p.key} href={`/flex-builder/new?preset=${p.key}`} className="rounded-xl border bg-white p-3 transition hover:border-primary hover:shadow-sm">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
      <div className="relative mb-4 max-w-md">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา Template" className="pl-8" />
      </div>
      {error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={LayoutTemplate} title="ยังไม่มี Flex Template" description="สร้าง Flex Message แล้วนำไปใช้ในกฎตอบกลับอัตโนมัติ" />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {data.map((t) => (
            <Card key={t.id} className="gap-0 overflow-hidden py-0">
              <Link href={`/flex-builder/${t.id}`} className="block">
                <ChatBackdrop className="pointer-events-none h-56 overflow-hidden rounded-none">
                  <div className="origin-top-left scale-[0.7]">
                    <FlexPreview contents={renderFlexVariables(t.contents, sampleTemplateValues())} />
                  </div>
                </ChatBackdrop>
              </Link>
              <CardContent className="flex items-start gap-2 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/flex-builder/${t.id}`} className="block truncate font-medium hover:underline">{t.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">{t.altText}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{t.containerType}</Badge>
                    {t._count.rules > 0 && <Badge variant="secondary">ใช้ใน {t._count.rules} กฎ</Badge>}
                    <span className="text-[11px] text-muted-foreground">แก้ไข {formatRelative(t.updatedAt, timezone)}</span>
                  </div>
                </div>
                {canEdit && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" disabled={busy} aria-label="เมนู">{busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => router.push(`/flex-builder/${t.id}`)}><Pencil /> แก้ไข</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => duplicate(t)}><Copy /> ทำสำเนา</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(t)}><Trash2 /> ลบ</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบ Flex Template"
        description={`ต้องการลบ "${deleting?.name}" ใช่หรือไม่? (ลบไม่ได้หากถูกใช้งานในกฎตอบกลับหรือ Default Reply)`}
        confirmLabel="ลบ"
        destructive
        loading={busy}
        onConfirm={remove}
      />
    </>
  );
}
