"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  Box,
  Columns3,
  Copy,
  GripVertical,
  Image as ImageIcon,
  Minus,
  MousePointerClick,
  MoveVertical,
  Plus,
  Rows3,
  Trash2,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeNode, type BBubble, type BNode, type NodeKind, type PaletteKind, type SectionKey } from "@/components/flex-builder/model";

export const KIND_ICONS: Record<NodeKind, typeof Box> = {
  box: Box,
  text: Type,
  image: ImageIcon,
  button: MousePointerClick,
  separator: Minus,
  spacer: MoveVertical,
  icon: ImageIcon,
  filler: MoveVertical,
  video: ImageIcon,
};

export const PALETTE: { kind: PaletteKind; label: string; icon: typeof Box; description: string }[] = [
  { kind: "box-vertical", label: "Box แนวตั้ง", icon: Rows3, description: "จัดเรียงลูกจากบนลงล่าง" },
  { kind: "box-horizontal", label: "Box แนวนอน", icon: Columns3, description: "จัดเรียงลูกจากซ้ายไปขวา" },
  { kind: "box-baseline", label: "Box Baseline", icon: Columns3, description: "แนวนอนจัดตาม baseline ข้อความ" },
  { kind: "text", label: "Text", icon: Type, description: "ข้อความ" },
  { kind: "image", label: "Image", icon: ImageIcon, description: "รูปภาพ (HTTPS)" },
  { kind: "button", label: "Button", icon: MousePointerClick, description: "ปุ่ม + Action" },
  { kind: "separator", label: "Separator", icon: Minus, description: "เส้นคั่น" },
  { kind: "spacer", label: "Spacer", icon: MoveVertical, description: "ช่องว่าง" },
];

export type CanvasHandlers = {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
};

export function PaletteItem({ item, onAdd }: { item: (typeof PALETTE)[number]; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `palette:${item.kind}`, data: { type: "palette", kind: item.kind } });
  const Icon = item.icon;
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={onAdd}
      className={cn(
        "flex w-full touch-none items-center gap-2.5 rounded-lg border bg-white px-2.5 py-2 text-left text-sm shadow-xs transition hover:border-primary hover:bg-accent/40",
        isDragging && "opacity-40",
      )}
      title={`${item.description} — คลิกเพื่อเพิ่ม หรือลากไปวางใน Box`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-primary"><Icon className="size-4" /></span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{item.label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
      </span>
    </button>
  );
}

/** แถบรับการวางที่ท้าย box */
function BoxDropZone({ box, empty }: { box: BNode; empty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `append:${box.id}`, data: { type: "append", boxId: box.id } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded border border-dashed text-center text-[11px] text-muted-foreground transition-colors",
        empty ? "py-3" : "py-1",
        isOver ? "border-primary bg-accent text-accent-foreground" : "border-gray-300",
      )}
    >
      {empty ? "ลากคอมโพเนนต์มาวางที่นี่" : isOver ? "วางที่ท้าย Box" : "+"}
    </div>
  );
}

function TreeNode({ node, depth, isRoot, h }: { node: BNode; depth: number; isRoot: boolean; h: CanvasHandlers }) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `node:${node.id}`,
    data: { type: "node", nodeId: node.id },
    disabled: isRoot,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `before:${node.id}`,
    data: { type: isRoot ? "append" : "before", nodeId: node.id, boxId: node.id },
  });
  const Icon = KIND_ICONS[node.kind] ?? Box;
  const selected = h.selectedId === node.id;
  return (
    <div className={cn(isDragging && "opacity-40")}>
      <div
        ref={setDropRef}
        className={cn(
          "group flex items-center gap-1 rounded-md border px-1.5 py-1 text-sm transition-colors",
          selected ? "border-sky-400 bg-sky-50" : "border-transparent hover:bg-gray-50",
          isOver && (isRoot ? "border-primary bg-accent" : "border-t-2 border-t-primary"),
        )}
        onClick={() => h.onSelect(node.id)}
      >
        {!isRoot ? (
          <span
            ref={setDragRef}
            {...attributes}
            {...listeners}
            className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
            aria-label="ลากเพื่อย้าย"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="size-4" />
          </span>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <Icon className="size-4 shrink-0 text-gray-500" />
        <span className="min-w-0 flex-1 truncate">{describeNode(node)}</span>
        <span className={cn("flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100", selected && "opacity-100")}>
          {!isRoot && (
            <>
              <Button variant="ghost" size="icon-sm" className="size-6" onClick={(e) => { e.stopPropagation(); h.onMove(node.id, -1); }} aria-label="เลื่อนขึ้น"><ArrowUp className="size-3.5" /></Button>
              <Button variant="ghost" size="icon-sm" className="size-6" onClick={(e) => { e.stopPropagation(); h.onMove(node.id, 1); }} aria-label="เลื่อนลง"><ArrowDown className="size-3.5" /></Button>
              <Button variant="ghost" size="icon-sm" className="size-6" onClick={(e) => { e.stopPropagation(); h.onDuplicate(node.id); }} aria-label="ทำสำเนา"><Copy className="size-3.5" /></Button>
            </>
          )}
          <Button variant="ghost" size="icon-sm" className="size-6 text-destructive" onClick={(e) => { e.stopPropagation(); h.onRemove(node.id); }} aria-label="ลบ"><Trash2 className="size-3.5" /></Button>
        </span>
      </div>
      {node.kind === "box" && (
        <div className="ml-3 space-y-0.5 border-l border-dashed border-gray-300 py-0.5 pl-2" style={{ marginLeft: depth > 6 ? 6 : 12 }}>
          {(node.children ?? []).map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} isRoot={false} h={h} />
          ))}
          <BoxDropZone box={node} empty={(node.children ?? []).length === 0} />
        </div>
      )}
    </div>
  );
}

const SECTION_LABEL: Record<SectionKey, string> = { header: "Header", hero: "Hero", body: "Body", footer: "Footer" };

export function BubbleCanvas({
  bubble,
  bubbleIndex,
  h,
  onAddSection,
  onSelectBubble,
  bubbleSelected,
}: {
  bubble: BBubble;
  bubbleIndex: number;
  h: CanvasHandlers;
  onAddSection: (section: SectionKey, kind: "box" | "image") => void;
  onSelectBubble: () => void;
  bubbleSelected: boolean;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onSelectBubble}
        className={cn("w-full rounded-md border px-3 py-1.5 text-left text-sm font-medium", bubbleSelected ? "border-sky-400 bg-sky-50" : "hover:bg-gray-50")}
      >
        Bubble {bubbleIndex + 1} · {String(bubble.props.size ?? "mega")}
        <span className="ml-2 text-xs font-normal text-muted-foreground">(คลิกเพื่อตั้งค่าขนาด สีพื้นหลัง และเส้นคั่น)</span>
      </button>
      {(["header", "hero", "body", "footer"] as SectionKey[]).map((section) => {
        const root = bubble[section];
        return (
          <div key={section} className="rounded-lg border bg-white p-2">
            <div className="mb-1 flex items-center justify-between px-1">
              <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{SECTION_LABEL[section]}</span>
            </div>
            {root ? (
              <TreeNode node={root} depth={0} isRoot h={h} />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {section === "hero" ? (
                  <>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAddSection("hero", "image")}><Plus /> Hero รูปภาพ</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAddSection("hero", "box")}><Plus /> Hero Box</Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onAddSection(section, "box")}><Plus /> เพิ่ม {SECTION_LABEL[section]}</Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
