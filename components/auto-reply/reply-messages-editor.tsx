"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowDown, ArrowUp, Braces, LayoutTemplate, MessageSquareText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineTextBubble } from "@/components/text-messages/line-text-bubble";
import { ChatBackdrop, FlexPreview } from "@/components/flex/flex-preview";
import { useProjectPath } from "@/hooks/use-app-context";
import { renderFlexVariables } from "@/lib/flex/render";
import { renderTemplate, sampleTemplateValues, TEMPLATE_VARIABLES } from "@/lib/templates/variables";
import { cn } from "@/lib/utils";

/** LINE ตอบกลับได้สูงสุด 5 ข้อความต่อ 1 ครั้ง */
export const MAX_MESSAGES = 5;
const MAX_TEXT = 5000;
const INLINE = "__inline";

export type MessageDraft = {
  key: number;
  type: "TEXT" | "FLEX";
  /** ว่าง = พิมพ์ข้อความเอง */
  textTemplateId: string;
  text: string;
  flexTemplateId: string;
};

export type TextTemplateOption = { id: string; name: string; content: string };
export type FlexTemplateOption = { id: string; name: string; altText: string; contents: unknown };

let seq = 0;
export function newMessage(type: "TEXT" | "FLEX" = "TEXT", init: Partial<MessageDraft> = {}): MessageDraft {
  return { key: ++seq, type, textTemplateId: "", text: "", flexTemplateId: "", ...init };
}

/** แปลงเป็นข้อมูลที่ส่งให้ API */
export function toApiMessages(messages: MessageDraft[]) {
  return messages.map((m) =>
    m.type === "FLEX"
      ? { type: "FLEX" as const, flexTemplateId: m.flexTemplateId || null }
      : m.textTemplateId
        ? { type: "TEXT" as const, textTemplateId: m.textTemplateId, text: null }
        : { type: "TEXT" as const, text: m.text, textTemplateId: null },
  );
}

function MessageCard({
  index,
  draft,
  total,
  texts,
  flexes,
  error,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  draft: MessageDraft;
  total: number;
  texts: TextTemplateOption[] | undefined;
  flexes: FlexTemplateOption[] | undefined;
  error?: string;
  onChange: (patch: Partial<MessageDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const projectPath = useProjectPath();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const inline = draft.type === "TEXT" && !draft.textTemplateId;

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const el = textRef.current;
    const start = el?.selectionStart ?? draft.text.length;
    const end = el?.selectionEnd ?? draft.text.length;
    const next = `${draft.text.slice(0, start)}${token}${draft.text.slice(end)}`.slice(0, MAX_TEXT);
    onChange({ text: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <li className={cn("rounded-lg border bg-card p-3", error && "border-destructive")}>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
          {index + 1}
        </span>
        <div role="radiogroup" aria-label={`ชนิดของข้อความที่ ${index + 1}`} className="flex rounded-md border bg-muted/60 p-0.5">
          {(
            [
              { value: "TEXT", label: "ข้อความ", icon: MessageSquareText },
              { value: "FLEX", label: "Flex", icon: LayoutTemplate },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={draft.type === value}
              onClick={() => onChange({ type: value })}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                draft.type === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center">
          <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`เลื่อนข้อความที่ ${index + 1} ขึ้น`}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={`เลื่อนข้อความที่ ${index + 1} ลง`}>
            <ArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" disabled={total === 1} onClick={onRemove} aria-label={`ลบข้อความที่ ${index + 1}`}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {draft.type === "TEXT" ? (
        <div className="grid gap-2">
          <Select value={draft.textTemplateId || INLINE} onValueChange={(v) => onChange({ textTemplateId: v === INLINE ? "" : v })}>
            <SelectTrigger size="sm" aria-label={`ที่มาของข้อความที่ ${index + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INLINE}>✏️ พิมพ์ข้อความเอง</SelectItem>
              {(texts ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  Template: {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inline && (
            <>
              <Textarea
                ref={textRef}
                value={draft.text}
                rows={3}
                maxLength={MAX_TEXT}
                aria-label={`ข้อความที่ ${index + 1}`}
                placeholder="พิมพ์ข้อความ เช่น สวัสดีคุณ {{displayName}} 😊"
                onChange={(e) => onChange({ text: e.target.value })}
              />
              <div className="flex flex-wrap items-center gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    title={v.label}
                    onClick={() => insertVariable(v.key)}
                    className="flex items-center gap-0.5 rounded border bg-card px-1.5 py-0.5 text-[11px] hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <Braces className="size-3" /> {v.key}
                  </button>
                ))}
                <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                  {draft.text.length.toLocaleString()} / {MAX_TEXT.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      ) : (
        <Select value={draft.flexTemplateId} onValueChange={(v) => onChange({ flexTemplateId: v })}>
          <SelectTrigger size="sm" aria-label={`Flex Message ของข้อความที่ ${index + 1}`}>
            <SelectValue placeholder={flexes ? "เลือก Flex Message" : "กำลังโหลด..."} />
          </SelectTrigger>
          <SelectContent>
            {(flexes ?? []).map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {draft.type === "FLEX" && flexes?.length === 0 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          ยังไม่มี Flex Message —{" "}
          <Link className="text-primary underline" href={projectPath("/flex-builder/new")}>
            สร้างใหม่
          </Link>
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </li>
  );
}

/** แก้ไขรายการข้อความตอบกลับของกฎ (สูงสุด 5 ข้อความ ส่งตามลำดับ) */
export function ReplyMessagesEditor({
  messages,
  onChange,
  texts,
  flexes,
  errors,
  maxPerReply,
}: {
  messages: MessageDraft[];
  onChange: (messages: MessageDraft[]) => void;
  texts: TextTemplateOption[] | undefined;
  flexes: FlexTemplateOption[] | undefined;
  errors: Record<string, string>;
  /** การตั้งค่าโปรเจกต์ “จำนวนข้อความสูงสุดต่อการตอบกลับ” */
  maxPerReply?: number;
}) {
  const update = (i: number, patch: Partial<MessageDraft>) => onChange(messages.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...messages];
    const [item] = next.splice(i, 1);
    next.splice(i + dir, 0, item!);
    onChange(next);
  };
  const errorFor = (i: number) =>
    errors[`messages.${i}.text`] ?? errors[`messages.${i}.textTemplateId`] ?? errors[`messages.${i}.flexTemplateId`] ?? errors[`messages.${i}`];

  return (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-2">
        <Label>
          ข้อความตอบกลับ<span className="text-destructive">*</span>
        </Label>
        <span className="text-xs text-muted-foreground">
          {messages.length} / {MAX_MESSAGES} ข้อความ · ส่งเรียงตามลำดับ
        </span>
      </div>
      <ol className="grid gap-2">
        {messages.map((m, i) => (
          <MessageCard
            key={m.key}
            index={i}
            draft={m}
            total={messages.length}
            texts={texts}
            flexes={flexes}
            error={errorFor(i)}
            onChange={(patch) => update(i, patch)}
            onMove={(dir) => move(i, dir)}
            onRemove={() => onChange(messages.filter((_, j) => j !== i))}
          />
        ))}
      </ol>
      {errors.messages && <p className="text-xs text-destructive">{errors.messages}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={messages.length >= MAX_MESSAGES} onClick={() => onChange([...messages, newMessage("TEXT")])}>
          <Plus /> เพิ่มข้อความ
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={messages.length >= MAX_MESSAGES} onClick={() => onChange([...messages, newMessage("FLEX")])}>
          <Plus /> เพิ่ม Flex Message
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        แบ่งข้อความยาวเป็นหลายข้อความสั้น ๆ ได้ LINE ส่งได้สูงสุด {MAX_MESSAGES} ข้อความต่อการตอบกลับ 1 ครั้ง
      </p>
      {maxPerReply !== undefined && messages.length > maxPerReply && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          ตั้งค่าโปรเจกต์จำกัดไว้ {maxPerReply} ข้อความต่อการตอบกลับ — ข้อความลำดับที่ {maxPerReply + 1} เป็นต้นไปจะไม่ถูกส่ง (แก้ได้ที่ ตั้งค่าโปรเจกต์ → ทั่วไป)
        </p>
      )}
    </div>
  );
}

/** ตัวอย่างการตอบกลับทั้งหมดแบบแชท LINE (ใช้ค่าตัวอย่างของตัวแปร) */
export function ReplyMessagesPreview({
  messages,
  texts,
  flexes,
}: {
  messages: MessageDraft[];
  texts: TextTemplateOption[] | undefined;
  flexes: FlexTemplateOption[] | undefined;
}) {
  const values = sampleTemplateValues();
  const bubbles: { key: number; text?: string; flex?: unknown }[] = [];
  for (const m of messages) {
    if (m.type === "FLEX") {
      const f = flexes?.find((t) => t.id === m.flexTemplateId);
      if (f) bubbles.push({ key: m.key, flex: renderFlexVariables(f.contents, values) });
      continue;
    }
    const content = m.textTemplateId ? texts?.find((t) => t.id === m.textTemplateId)?.content : m.text;
    if (content?.trim()) bubbles.push({ key: m.key, text: renderTemplate(content, values) });
  }
  if (bubbles.length === 0) return null;
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">ตัวอย่างการตอบกลับ (ใช้ค่าตัวอย่างของตัวแปร)</Label>
      <ChatBackdrop className="space-y-2">
        {bubbles.map((b) =>
          b.flex ? (
            <div key={b.key} className="thin-scrollbar overflow-x-auto">
              <div className="origin-top-left scale-90">
                <FlexPreview contents={b.flex} />
              </div>
            </div>
          ) : (
            <LineTextBubble key={b.key} text={b.text ?? ""} />
          ),
        )}
      </ChatBackdrop>
    </div>
  );
}
