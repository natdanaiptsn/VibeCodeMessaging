"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  FolderOpen,
  Layers,
  Loader2,
  Plus,
  Redo2,
  Save,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/common/field";
import { ChatBackdrop, FlexPreview } from "@/components/flex/flex-preview";
import { BubbleCanvas, PALETTE, PaletteItem, type CanvasHandlers } from "@/components/flex-builder/canvas";
import { BubbleInspector, NodeInspector } from "@/components/flex-builder/inspector";
import {
  createBubble,
  createNode,
  docFromJson,
  docToJson,
  duplicateNode,
  emptyDoc,
  insertNode,
  locate,
  moveNode,
  moveSibling,
  removeNode,
  setSection,
  updateBubbleProps,
  updateProps,
  uid,
  type BuilderDoc,
  type PaletteKind,
  type SectionKey,
} from "@/components/flex-builder/model";
import { validateFlexMessage } from "@/lib/flex/validate";
import { FLEX_PRESETS } from "@/lib/flex/presets";
import { renderFlexVariables } from "@/lib/flex/render";
import { sampleTemplateValues } from "@/lib/templates/variables";
import { formatBytes } from "@/lib/format";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useCan } from "@/hooks/use-app-context";
import { cn } from "@/lib/utils";

export type FlexTemplateData = { id: string; name: string; description: string | null; altText: string; contents: unknown };

const MAX_HISTORY = 60;

function useHistory(initial: BuilderDoc) {
  const [state, setState] = useState({ past: [] as BuilderDoc[], present: initial, future: [] as BuilderDoc[] });
  const set = useCallback((next: BuilderDoc | ((d: BuilderDoc) => BuilderDoc)) => {
    setState((s) => {
      const value = typeof next === "function" ? next(s.present) : next;
      if (value === s.present) return s;
      return { past: [...s.past, s.present].slice(-MAX_HISTORY), present: value, future: [] };
    });
  }, []);
  const undo = useCallback(() => setState((s) => (s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1]!, future: [s.present, ...s.future] } : s)), []);
  const redo = useCallback(() => setState((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0]!, future: s.future.slice(1) } : s)), []);
  const reset = useCallback((doc: BuilderDoc) => setState({ past: [], present: doc, future: [] }), []);
  return { doc: state.present, set, undo, redo, reset, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function FlexBuilder({
  template,
  initialPreset,
}: {
  template: FlexTemplateData | null;
  initialPreset?: { name: string; altText: string; contents: unknown };
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const canEdit = useCan("flex:manage");
  const initialDoc = useMemo(() => {
    try {
      if (template) return docFromJson(template.contents);
      return initialPreset ? docFromJson(initialPreset.contents) : emptyDoc();
    } catch {
      return emptyDoc();
    }
  }, [template, initialPreset]);
  const { doc, set, undo, redo, reset, canUndo, canRedo } = useHistory(initialDoc);
  const [name, setName] = useState(template?.name ?? initialPreset?.name ?? "Flex Message ใหม่");
  const [altText, setAltText] = useState(template?.altText ?? initialPreset?.altText ?? "คุณได้รับข้อความใหม่");
  const [description, setDescription] = useState(template?.description ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bubbleIndex, setBubbleIndex] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ c: docToJson(initialDoc), n: template?.name ?? "", a: template?.altText ?? "", d: template?.description ?? "" }));
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<null | "export" | "import" | "load" | "validate">(null);
  const [activeDrag, setActiveDrag] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState("canvas");

  const json = useMemo(() => docToJson(doc), [doc]);
  const jsonWithIds = useMemo(() => docToJson(doc, true), [doc]);
  const validation = useMemo(() => validateFlexMessage(altText, json), [altText, json]);
  const dirty = JSON.stringify({ c: json, n: name, a: altText, d: description }) !== savedSnapshot;
  const currentBubble = doc.bubbles[Math.min(bubbleIndex, doc.bubbles.length - 1)]!;
  const bubbleSelId = `bubble:${currentBubble.id}`;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  // ─── การเพิ่ม component ───
  const targetBoxForAdd = (): string | null => {
    if (selectedId && !selectedId.startsWith("bubble:")) {
      const loc = locate(doc, selectedId);
      if (loc?.node.kind === "box") return loc.node.id;
      if (loc?.parent) return loc.parent.id;
    }
    return currentBubble.body?.id ?? null;
  };

  const addFromPalette = (kind: PaletteKind, parentId?: string, index?: number) => {
    const node = createNode(kind);
    let parent = parentId ?? targetBoxForAdd();
    let base = doc;
    if (!parent) {
      const body = createNode("box-vertical");
      base = setSection(doc, bubbleIndex, "body", body);
      parent = body.id;
    }
    const next = insertNode(base, parent, node, index);
    if (!next) {
      toast.error("ไม่สามารถเพิ่มคอมโพเนนต์นี้ในตำแหน่งที่เลือกได้ (Box แบบ baseline รองรับเฉพาะ Text และ Spacer)");
      return;
    }
    set(next);
    setSelectedId(node.id);
  };

  const onDragStart = (e: DragStartEvent) => setActiveDrag(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const over = e.over?.data.current as { type: string; nodeId?: string; boxId?: string } | undefined;
    const active = e.active.data.current as { type: string; kind?: PaletteKind; nodeId?: string } | undefined;
    if (!over || !active) return;
    let parentId: string | undefined;
    let index: number | undefined;
    if (over.type === "append") {
      parentId = over.boxId;
    } else if (over.type === "before" && over.nodeId) {
      const loc = locate(doc, over.nodeId);
      if (!loc?.parent) return;
      parentId = loc.parent.id;
      index = loc.index;
    }
    if (!parentId) return;
    if (active.type === "palette" && active.kind) return addFromPalette(active.kind, parentId, index);
    if (active.type === "node" && active.nodeId) {
      if (active.nodeId === over.nodeId) return;
      const next = moveNode(doc, active.nodeId, parentId, index);
      if (!next) return toast.error("ไม่สามารถย้ายไปตำแหน่งนี้ได้ (ห้ามวางใน Box ของตัวเอง หรือ Box แบบ baseline ไม่รองรับ)");
      set(next);
    }
  };

  const handlers: CanvasHandlers = {
    selectedId,
    onSelect: setSelectedId,
    onRemove: (id) => {
      set(removeNode(doc, id));
      if (selectedId === id) setSelectedId(null);
    },
    onDuplicate: (id) => {
      const r = duplicateNode(doc, id);
      set(r.doc);
      if (r.newId) setSelectedId(r.newId);
    },
    onMove: (id, delta) => set(moveSibling(doc, id, delta)),
  };

  const addSection = (section: SectionKey, kind: "box" | "image") => {
    const node = kind === "image" ? createNode("image") : createNode("box-vertical");
    if (kind === "box" && section !== "hero") {
      const t = createNode("text");
      t.props = { ...t.props, text: section === "header" ? "หัวข้อ" : "ข้อความ" };
      if (section === "footer") node.children = [createNode("button")];
      else node.children = [t];
    }
    set(setSection(doc, bubbleIndex, section, node));
    setSelectedId(node.id);
  };

  // ─── Carousel ───
  const setContainerKind = (kind: "bubble" | "carousel") => {
    if (kind === doc.kind) return;
    if (kind === "bubble" && doc.bubbles.length > 1 && !window.confirm("เปลี่ยนเป็น Bubble จะเหลือเฉพาะ Bubble แรก ต้องการดำเนินการต่อหรือไม่?")) return;
    set({ kind, bubbles: kind === "bubble" ? [doc.bubbles[0]!] : doc.bubbles });
    setBubbleIndex(0);
  };
  const addBubble = (duplicate: boolean) => {
    if (doc.bubbles.length >= 12) return toast.error("Carousel มีได้สูงสุด 12 Bubble");
    const nb = duplicate ? docFromJson(docToJson({ kind: "bubble", bubbles: [currentBubble] })).bubbles[0]! : createBubble();
    nb.id = uid("b");
    const bubbles = [...doc.bubbles];
    bubbles.splice(bubbleIndex + 1, 0, nb);
    set({ kind: "carousel", bubbles });
    setBubbleIndex(bubbleIndex + 1);
  };
  const removeBubble = () => {
    if (doc.bubbles.length <= 1) return;
    set({ ...doc, bubbles: doc.bubbles.filter((_, i) => i !== bubbleIndex) });
    setBubbleIndex(Math.max(0, bubbleIndex - 1));
  };
  const moveBubble = (delta: -1 | 1) => {
    const j = bubbleIndex + delta;
    if (j < 0 || j >= doc.bubbles.length) return;
    const bubbles = [...doc.bubbles];
    [bubbles[bubbleIndex], bubbles[j]] = [bubbles[j]!, bubbles[bubbleIndex]!];
    set({ ...doc, bubbles });
    setBubbleIndex(j);
  };

  // ─── Save / Load ───
  const save = async () => {
    if (!validation.valid) {
      setDialog("validate");
      return toast.error("Flex Message ยังไม่ผ่านการตรวจสอบ กรุณาแก้ไขก่อนบันทึก");
    }
    setSaving(true);
    try {
      const body = { name, altText, description: description || null, contents: json };
      const saved = await apiFetch<{ id: string }>(template ? `/api/flex-templates/${template.id}` : "/api/flex-templates", {
        method: template ? "PUT" : "POST",
        body,
      });
      setSavedSnapshot(JSON.stringify({ c: json, n: name, a: altText, d: description }));
      toast.success("บันทึก Template แล้ว");
      await qc.invalidateQueries({ queryKey: ["flex-templates"] });
      if (!template) router.replace(`/flex-builder/${saved.id}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const loadContents = (contents: unknown, meta?: { altText?: string }) => {
    try {
      const d = docFromJson(contents);
      reset(d);
      if (meta?.altText) setAltText(meta.altText);
      setSelectedId(null);
      setBubbleIndex(0);
      setDialog(null);
      toast.success("โหลด Flex Message แล้ว");
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const selectFromPreview = (id: string) => {
    if (id.startsWith("b_")) {
      const i = doc.bubbles.findIndex((b) => b.id === id);
      if (i >= 0) setBubbleIndex(i);
      setSelectedId(`bubble:${id}`);
      return;
    }
    const loc = locate(doc, id);
    if (loc) setBubbleIndex(loc.bubbleIndex);
    setSelectedId(id);
    setMobileTab((t) => (t === "preview" ? "canvas" : t));
  };

  const selectedLoc = selectedId && !selectedId.startsWith("bubble:") ? locate(doc, selectedId) : null;

  // ─── Panels ───
  const componentPanel = (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm"><Layers className="size-4 text-primary" /> Component Panel</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-4">
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Container</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant={doc.kind === "bubble" ? "default" : "outline"} size="sm" onClick={() => setContainerKind("bubble")}>Bubble</Button>
            <Button variant={doc.kind === "carousel" ? "default" : "outline"} size="sm" onClick={() => setContainerKind("carousel")}>Carousel</Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => addBubble(false)}><Plus /> เพิ่ม Container (Bubble)</Button>
        </div>
        <div className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Components — คลิกเพื่อเพิ่ม หรือลากไปวาง</p>
          {PALETTE.map((item) => (
            <PaletteItem key={item.kind} item={item} onAdd={() => addFromPalette(item.kind)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const editorCanvas = (
    <div className="grid min-w-0 grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="gap-3 py-4">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">Editor Canvas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4">
          {doc.kind === "carousel" && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-gray-50 p-2">
              {doc.bubbles.map((b, i) => (
                <Button key={b.id} variant={i === bubbleIndex ? "default" : "outline"} size="sm" className="h-7 min-w-8 px-2" onClick={() => { setBubbleIndex(i); setSelectedId(null); }}>
                  {i + 1}
                </Button>
              ))}
              <span className="mx-1 h-5 w-px bg-border" />
              <Button variant="ghost" size="icon-sm" onClick={() => moveBubble(-1)} aria-label="เลื่อนซ้าย"><ChevronLeft /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => moveBubble(1)} aria-label="เลื่อนขวา"><ChevronRight /></Button>
              <Button variant="ghost" size="icon-sm" onClick={() => addBubble(true)} aria-label="ทำสำเนา Bubble"><Copy /></Button>
              <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={removeBubble} disabled={doc.bubbles.length <= 1} aria-label="ลบ Bubble"><Trash2 /></Button>
            </div>
          )}
          <BubbleCanvas
            bubble={currentBubble}
            bubbleIndex={bubbleIndex}
            h={handlers}
            onAddSection={addSection}
            onSelectBubble={() => setSelectedId(bubbleSelId)}
            bubbleSelected={selectedId === bubbleSelId}
          />
        </CardContent>
      </Card>
      <Card className="gap-3 py-4 2xl:sticky 2xl:top-4 2xl:self-start">
        <CardHeader className="px-4">
          <CardTitle className="text-sm">คุณสมบัติ</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          {selectedLoc ? (
            <NodeInspector
              key={selectedLoc.node.id}
              node={selectedLoc.node}
              isRoot={!selectedLoc.parent}
              patch={(patch) => set((d) => updateProps(d, selectedLoc.node.id, patch))}
            />
          ) : selectedId === bubbleSelId ? (
            <BubbleInspector bubble={currentBubble} patch={(patch) => set((d) => updateBubbleProps(d, bubbleIndex, patch))} />
          ) : (
            <p className="text-sm text-muted-foreground">เลือกคอมโพเนนต์จาก Canvas หรือคลิกที่ Live Preview เพื่อแก้ไขสี ขนาดตัวอักษร ระยะห่าง Alignment Background Border และ Action</p>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const previewContents = useMemo(() => renderFlexVariables(jsonWithIds, sampleTemplateValues()), [jsonWithIds]);
  const livePreview = (
    <Card className="gap-3 py-4 lg:sticky lg:top-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          Live Preview
          <span className="text-xs font-normal text-muted-foreground">{formatBytes(validation.sizeBytes)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-4">
        <ChatBackdrop className="min-h-64 overflow-hidden">
          <FlexPreview contents={previewContents} selectedId={selectedId?.replace(/^bubble:/, "")} onSelect={selectFromPreview} />
        </ChatBackdrop>
        <button type="button" onClick={() => setDialog("validate")} className="w-full text-left">
          {validation.valid ? (
            <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" /> ผ่านการตรวจสอบ{validation.warnings.length ? ` (คำเตือน ${validation.warnings.length})` : ""}
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="size-4" /> พบข้อผิดพลาด {validation.errors.length} รายการ — คลิกเพื่อดู
            </p>
          )}
        </button>
        <p className="text-[11px] text-muted-foreground">ตัวแปรในตัวอย่างแสดงด้วยค่าตัวอย่าง เช่น {"{{displayName}}"} → สมชาย</p>
      </CardContent>
    </Card>
  );

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveDrag(null)}>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/flex-builder"><ArrowLeft /> Template ทั้งหมด</Link></Button>
          <h1 className="text-lg font-semibold sm:text-xl">Flex Message Builder</h1>
          {dirty && <Badge variant="warning">ยังไม่ได้บันทึก</Badge>}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo} aria-label="ย้อนกลับ (Ctrl+Z)"><Undo2 /></Button>
            <Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo} aria-label="ทำซ้ำ (Ctrl+Y)"><Redo2 /></Button>
            <Button variant="outline" size="sm" onClick={() => setDialog("load")}><FolderOpen /> โหลด Template</Button>
            <Button variant="outline" size="sm" onClick={() => setDialog("import")}><Upload /> นำเข้า JSON</Button>
            <Button variant="outline" size="sm" onClick={() => setDialog("export")}><FileJson /> Export JSON</Button>
            <Button variant="outline" size="sm" onClick={() => setDialog("validate")}><ShieldCheck /> Validate</Button>
            {canEdit && (
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : <Save />} บันทึก Template
              </Button>
            )}
          </div>
        </div>
        <Card className="py-3">
          <CardContent className="grid gap-3 px-4 md:grid-cols-3">
            <Field label="ชื่อ Template" htmlFor="flex-name">
              <Input id="flex-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Alt Text (ข้อความแจ้งเตือน)" htmlFor="flex-alt" hint={`${[...altText].length}/400 — แสดงในการแจ้งเตือนและรายการแชท`}>
              <Input id="flex-alt" value={altText} maxLength={400} onChange={(e) => setAltText(e.target.value)} aria-invalid={!altText.trim()} />
            </Field>
            <Field label="คำอธิบาย" htmlFor="flex-desc">
              <Input id="flex-desc" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Mobile / Tablet: แท็บสลับ 3 ส่วน */}
      <div className="lg:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab}>
          <TabsList className="w-full">
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="canvas">Editor</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="components">{componentPanel}</TabsContent>
          <TabsContent value="canvas">{editorCanvas}</TabsContent>
          <TabsContent value="preview">{livePreview}</TabsContent>
        </Tabs>
      </div>
      {/* Desktop: 3 ส่วน */}
      <div className="hidden items-start gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_320px] xl:grid-cols-[240px_minmax(0,1fr)_360px]">
        <div className="min-w-0 lg:sticky lg:top-4">{componentPanel}</div>
        <div className="min-w-0">{editorCanvas}</div>
        <div className="min-w-0">{livePreview}</div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div className="rounded-md border border-primary bg-white px-3 py-1.5 text-sm shadow-lg">
            {activeDrag.startsWith("palette:")
              ? PALETTE.find((p) => `palette:${p.kind}` === activeDrag)?.label
              : "ย้ายคอมโพเนนต์"}
          </div>
        ) : null}
      </DragOverlay>

      <ExportDialog open={dialog === "export"} onOpenChange={(o) => setDialog(o ? "export" : null)} json={json} altText={altText} name={name} />
      <ImportDialog open={dialog === "import"} onOpenChange={(o) => setDialog(o ? "import" : null)} onImport={loadContents} />
      <LoadDialog open={dialog === "load"} onOpenChange={(o) => setDialog(o ? "load" : null)} onLoad={loadContents} currentId={template?.id} dirty={dirty} />
      <ValidateDialog open={dialog === "validate"} onOpenChange={(o) => setDialog(o ? "validate" : null)} validation={validation} altText={altText} json={json} />
    </DndContext>
  );
}

function ExportDialog({ open, onOpenChange, json, altText, name }: { open: boolean; onOpenChange: (o: boolean) => void; json: unknown; altText: string; name: string }) {
  const [mode, setMode] = useState<"message" | "contents">("message");
  const text = JSON.stringify(mode === "message" ? { type: "flex", altText, contents: json } : json, null, 2);
  const download = () => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\wก-๙-]+/g, "_") || "flex"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export JSON</DialogTitle>
          <DialogDescription>JSON ตาม LINE Flex Message Specification — นำไปใช้กับ Messaging API หรือ Flex Message Simulator ได้</DialogDescription>
        </DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList>
            <TabsTrigger value="message">Message Object</TabsTrigger>
            <TabsTrigger value="contents">Contents เท่านั้น</TabsTrigger>
          </TabsList>
        </Tabs>
        <pre className="max-h-[50dvh] overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100">{text}</pre>
        <DialogFooter>
          <Button variant="outline" onClick={() => navigator.clipboard?.writeText(text).then(() => toast.success("คัดลอก JSON แล้ว"))}><Copy /> คัดลอก</Button>
          <Button onClick={download}><Download /> ดาวน์โหลด .json</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onOpenChange, onImport }: { open: boolean; onOpenChange: (o: boolean) => void; onImport: (contents: unknown, meta?: { altText?: string }) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    setError(null);
    try {
      if (text.length > 200_000) throw new Error("JSON มีขนาดใหญ่เกินไป");
      const parsed = JSON.parse(text) as Record<string, unknown>;
      if (parsed.type === "flex") onImport(parsed.contents, { altText: typeof parsed.altText === "string" ? parsed.altText : undefined });
      else onImport(parsed);
      setText("");
    } catch (err) {
      setError(err instanceof SyntaxError ? `JSON ไม่ถูกต้อง: ${err.message}` : (err as Error).message);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>นำเข้า JSON</DialogTitle>
          <DialogDescription>วาง Flex Container (bubble/carousel) หรือ Message Object {"{ type: \"flex\", altText, contents }"}</DialogDescription>
        </DialogHeader>
        <Textarea rows={14} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" placeholder='{"type": "bubble", "body": {...}}' />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={submit} disabled={!text.trim()}><Upload /> นำเข้า</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoadDialog({
  open,
  onOpenChange,
  onLoad,
  currentId,
  dirty,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onLoad: (contents: unknown, meta?: { altText?: string }) => void;
  currentId?: string;
  dirty: boolean;
}) {
  const router = useRouter();
  const saved = useApiQuery<FlexTemplateData[]>(["flex-templates"], open ? "/api/flex-templates" : null);
  const confirmReplace = () => !dirty || window.confirm("เนื้อหาปัจจุบันยังไม่ได้บันทึก ต้องการแทนที่หรือไม่?");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>โหลด Template</DialogTitle>
          <DialogDescription>เลือกเทมเพลตเริ่มต้น หรือ Template ที่บันทึกไว้เพื่อใช้เป็นต้นแบบ</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60dvh] gap-4 overflow-y-auto">
          <div>
            <p className="mb-2 text-sm font-medium">เทมเพลตเริ่มต้น</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {FLEX_PRESETS.map((p) => (
                <button key={p.key} className="rounded-lg border p-3 text-left hover:border-primary hover:bg-accent/40" onClick={() => confirmReplace() && onLoad(p.contents, { altText: p.altText })}>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Template ที่บันทึกไว้</p>
            {saved.isLoading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : (saved.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">ยังไม่มี Template ที่บันทึกไว้</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {(saved.data ?? []).map((t) => (
                  <li key={t.id} className={cn("flex items-center gap-2 px-3 py-2", t.id === currentId && "bg-accent/40")}>
                    <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                    <Button variant="ghost" size="sm" onClick={() => confirmReplace() && onLoad(t.contents, { altText: t.altText })}>ใช้เป็นต้นแบบ</Button>
                    {t.id !== currentId && (
                      <Button variant="outline" size="sm" onClick={() => confirmReplace() && router.push(`/flex-builder/${t.id}`)}>เปิดแก้ไข</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ValidateDialog({
  open,
  onOpenChange,
  validation,
  altText,
  json,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  validation: ReturnType<typeof validateFlexMessage>;
  altText: string;
  json: unknown;
}) {
  const canRemote = useCan("flex:manage");
  const [remote, setRemote] = useState<{ checked: boolean; ok: boolean; message?: string; details?: { message?: string; property?: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const checkRemote = async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ remote: NonNullable<typeof remote> }>("/api/flex-templates/validate", { method: "POST", body: { altText, contents: json, remote: true } });
      setRemote(r.remote);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "ตรวจสอบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setRemote(null); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Validate Flex Message</DialogTitle>
          <DialogDescription>ตรวจสอบตาม LINE Flex Message Specification และข้อจำกัดของ LINE API ({formatBytes(validation.sizeBytes)})</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55dvh] space-y-3 overflow-y-auto">
          {validation.valid ? (
            <p className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> ผ่านการตรวจสอบในระบบ</p>
          ) : (
            <ul className="space-y-1.5">
              {validation.errors.map((e, i) => (
                <li key={i} className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  <code className="text-xs">{e.path}</code> — {e.message}
                </li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="space-y-1.5">
              {validation.warnings.map((w, i) => (
                <li key={i} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"><code className="text-xs">{w.path}</code> — {w.message}</li>
              ))}
            </ul>
          )}
          {remote && (
            <div className={cn("rounded-md px-3 py-2 text-sm", remote.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              <p className="font-medium">LINE API: {remote.message}</p>
              {remote.details?.map((d, i) => <p key={i} className="text-xs">{d.property}: {d.message}</p>)}
            </div>
          )}
        </div>
        {canRemote && (
          <DialogFooter>
            <Button variant="outline" onClick={checkRemote} disabled={loading || !validation.valid}>
              {loading ? <Loader2 className="animate-spin" /> : <ShieldCheck />} ตรวจสอบกับ LINE API (ไม่ส่งข้อความจริง)
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
