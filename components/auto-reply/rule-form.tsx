"use client";

import { useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { KeywordInput } from "@/components/auto-reply/keyword-input";
import {
  newMessage,
  ReplyMessagesEditor,
  ReplyMessagesPreview,
  toApiMessages,
  type FlexTemplateOption,
  type MessageDraft,
  type TextTemplateOption,
} from "@/components/auto-reply/reply-messages-editor";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useCan } from "@/hooks/use-app-context";
import { useQueryClient } from "@tanstack/react-query";
import { MATCH_TYPE_LABELS, TRIGGER_LABELS } from "@/lib/labels";
import { checkRegexSafety } from "@/lib/auto-reply/regex-safety";

export type RuleRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  triggerType: string;
  matchType: string;
  keywordLogic: "ANY" | "ALL";
  caseSensitive: boolean;
  replyType: "TEXT" | "FLEX" | "MIXED";
  matchCount: number;
  lastMatchedAt: string | null;
  keywords: { id: string; keyword: string }[];
  messages: RuleMessageRecord[];
};

export type RuleMessageRecord = {
  id: string;
  position: number;
  type: "TEXT" | "FLEX";
  text: string | null;
  textTemplateId: string | null;
  flexTemplateId: string | null;
  textTemplate: { id: string; name: string } | null;
  flexTemplate: { id: string; name: string } | null;
};

type FormState = {
  name: string;
  description: string;
  isActive: boolean;
  priority: number;
  triggerType: string;
  matchType: string;
  keywordLogic: "ANY" | "ALL";
  caseSensitive: boolean;
  keywords: string[];
  messages: MessageDraft[];
};

const empty = (): FormState => ({
  name: "",
  description: "",
  isActive: true,
  priority: 0,
  triggerType: "TEXT",
  matchType: "CONTAINS",
  keywordLogic: "ANY",
  caseSensitive: false,
  keywords: [],
  messages: [newMessage("TEXT")],
});

const KEYWORD_TRIGGERS = new Set(["TEXT", "POSTBACK"]);

function toForm(r: RuleRecord, copy = false): FormState {
  return {
    name: copy ? `${r.name} (สำเนา)` : r.name,
    description: r.description ?? "",
    isActive: copy ? false : r.isActive,
    priority: r.priority,
    triggerType: r.triggerType,
    matchType: r.matchType,
    keywordLogic: r.keywordLogic,
    caseSensitive: r.caseSensitive,
    keywords: r.keywords.map((k) => k.keyword),
    messages: r.messages.length
      ? r.messages.map((m) =>
          newMessage(m.type, { textTemplateId: m.textTemplateId ?? "", text: m.text ?? "", flexTemplateId: m.flexTemplateId ?? "" }),
        )
      : [newMessage("TEXT")],
  };
}

export function RuleFormSheet({
  open,
  onOpenChange,
  rule,
  duplicate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: RuleRecord | null;
  duplicate?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Sheet open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <RuleFormBody
          key={`${rule?.id ?? "new"}-${duplicate ? "dup" : ""}`}
          rule={rule}
          duplicate={duplicate}
          saving={saving}
          setSaving={setSaving}
          onClose={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function RuleFormBody({
  rule,
  duplicate,
  saving,
  setSaving,
  onClose,
}: {
  rule: RuleRecord | null;
  duplicate?: boolean;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => (rule ? toForm(rule, duplicate) : empty()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const texts = useApiQuery<TextTemplateOption[]>(["text-templates"], "/api/text-templates");
  const flexes = useApiQuery<FlexTemplateOption[]>(["flex-templates"], "/api/flex-templates");
  const canSettings = useCan("settings:view");
  const settings = useApiQuery<{ general: { maxMessagesPerReply: number } }>(["settings"], canSettings ? "/api/settings" : null);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const usesKeywords = KEYWORD_TRIGGERS.has(form.triggerType);
  const isEdit = Boolean(rule && !duplicate);

  const regexErrors = useMemo(() => {
    const out: Record<number, string> = {};
    if (form.matchType === "REGEX" && usesKeywords) {
      form.keywords.forEach((k, i) => {
        const r = checkRegexSafety(k);
        if (!r.ok) out[i] = r.reason;
      });
    }
    return out;
  }, [form.keywords, form.matchType, usesKeywords]);

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      const body = {
        ...form,
        description: form.description || null,
        keywords: usesKeywords ? form.keywords : [],
        messages: toApiMessages(form.messages),
      };
      await apiFetch(isEdit ? `/api/rules/${rule!.id}` : "/api/rules", { method: isEdit ? "PUT" : "POST", body });
      toast.success(isEdit ? "บันทึกการแก้ไขกฎแล้ว" : "สร้างกฎตอบกลับแล้ว");
      await qc.invalidateQueries({ queryKey: ["rules"] });
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setErrors(err.fieldErrors);
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const keywordErr = errors.keywords ?? Object.entries(errors).find(([k]) => k.startsWith("keywords."))?.[1];

  return (
    <>
        <SheetHeader>
          <SheetTitle>{isEdit ? "แก้ไขกฎตอบกลับ" : "เพิ่มกฎตอบกลับ"}</SheetTitle>
          <SheetDescription>กำหนด Keyword, เงื่อนไขการจับคู่ และข้อความที่จะตอบกลับ</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-4">
          <Field label="ชื่อกฎ" htmlFor="rule-name" required error={errors.name}>
            <Input id="rule-name" value={form.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} placeholder="เช่น สอบถามราคา" />
          </Field>
          <Field label="คำอธิบาย" htmlFor="rule-desc" error={errors.description}>
            <Textarea id="rule-desc" value={form.description} maxLength={500} rows={2} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="เหตุการณ์ที่ทริกเกอร์" error={errors.triggerType}>
              <Select value={form.triggerType} onValueChange={(v) => set({ triggerType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="ลำดับความสำคัญ (Priority)" htmlFor="rule-priority" hint="ค่ามากกว่าจะถูกตรวจก่อน" error={errors.priority}>
              <Input id="rule-priority" type="number" min={-1000} max={1000} value={form.priority} onChange={(e) => set({ priority: Number(e.target.value) || 0 })} />
            </Field>
          </div>

          {usesKeywords ? (
            <div className="grid gap-4 rounded-lg border bg-gray-50/60 dark:bg-white/5 p-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="เงื่อนไขการจับคู่" error={errors.matchType}>
                  <Select value={form.matchType} onValueChange={(v) => set({ matchType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MATCH_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="หลาย Keyword (Multiple Keywords)">
                  <Select value={form.keywordLogic} onValueChange={(v) => set({ keywordLogic: v as "ANY" | "ALL" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">ตรงคำใดคำหนึ่ง (OR)</SelectItem>
                      <SelectItem value="ALL">ต้องตรงทุกคำ (AND)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field
                label={form.matchType === "REGEX" ? "Regular Expression" : form.triggerType === "POSTBACK" ? "Keyword (เทียบกับ Postback data)" : "Keyword"}
                required
                error={keywordErr}
                hint={
                  form.matchType === "REGEX"
                    ? "ระบบตรวจสอบ ReDoS อัตโนมัติ (ห้าม quantifier ซ้อน/backreference) และจำกัดเวลาประมวลผล"
                    : "กด Enter เพื่อเพิ่ม หรือวางหลายคำคั่นด้วยเครื่องหมายจุลภาค"
                }
              >
                <KeywordInput
                  value={form.keywords}
                  onChange={(keywords) => set({ keywords })}
                  invalid={Boolean(keywordErr)}
                  errors={regexErrors}
                  placeholder={form.matchType === "REGEX" ? "เช่น ^(ราคา|เท่าไหร่)" : "พิมพ์ Keyword แล้วกด Enter"}
                />
                {Object.values(regexErrors)[0] && <p className="text-xs text-destructive">{Object.values(regexErrors)[0]}</p>}
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={form.caseSensitive} onCheckedChange={(v) => set({ caseSensitive: v })} />
                แยกตัวพิมพ์เล็ก/ใหญ่ (Case sensitive)
              </label>
            </div>
          ) : (
            <p className="rounded-lg bg-blue-50 dark:bg-blue-500/15 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
              กฎนี้จะทำงานทุกครั้งที่เกิดเหตุการณ์ “{TRIGGER_LABELS[form.triggerType]}” โดยไม่ต้องใช้ Keyword
            </p>
          )}

          <ReplyMessagesEditor
            messages={form.messages}
            onChange={(messages) => set({ messages })}
            texts={texts.data}
            flexes={flexes.data}
            errors={errors}
            maxPerReply={settings.data?.general.maxMessagesPerReply}
          />
          <ReplyMessagesPreview messages={form.messages} texts={texts.data} flexes={flexes.data} />
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} /> เปิดใช้งานกฎนี้
          </label>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>ยกเลิก</Button>
          <Button onClick={submit} disabled={saving || Object.keys(regexErrors).length > 0}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />} บันทึก
          </Button>
        </SheetFooter>
    </>
  );
}
