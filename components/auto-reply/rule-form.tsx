"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { KeywordInput } from "@/components/auto-reply/keyword-input";
import { LineTextBubble } from "@/components/text-messages/line-text-bubble";
import { ChatBackdrop, FlexPreview } from "@/components/flex/flex-preview";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { MATCH_TYPE_LABELS, TRIGGER_LABELS } from "@/lib/labels";
import { renderTemplate, sampleTemplateValues } from "@/lib/templates/variables";
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
  replyType: "TEXT" | "FLEX";
  textTemplateId: string | null;
  flexTemplateId: string | null;
  matchCount: number;
  lastMatchedAt: string | null;
  keywords: { id: string; keyword: string }[];
  textTemplate: { id: string; name: string; content: string } | null;
  flexTemplate: { id: string; name: string; altText: string } | null;
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
  replyType: "TEXT" | "FLEX";
  textTemplateId: string;
  flexTemplateId: string;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  isActive: true,
  priority: 0,
  triggerType: "TEXT",
  matchType: "CONTAINS",
  keywordLogic: "ANY",
  caseSensitive: false,
  keywords: [],
  replyType: "TEXT",
  textTemplateId: "",
  flexTemplateId: "",
};

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
    replyType: r.replyType,
    textTemplateId: r.textTemplateId ?? "",
    flexTemplateId: r.flexTemplateId ?? "",
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
  const [form, setForm] = useState<FormState>(() => (rule ? toForm(rule, duplicate) : EMPTY));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const texts = useApiQuery<{ id: string; name: string; content: string }[]>(["text-templates"], "/api/text-templates");
  const flexes = useApiQuery<{ id: string; name: string; altText: string; contents: unknown }[]>(["flex-templates"], "/api/flex-templates");

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

  const selectedText = texts.data?.find((t) => t.id === form.textTemplateId);
  const selectedFlex = flexes.data?.find((t) => t.id === form.flexTemplateId);

  const submit = async () => {
    setSaving(true);
    setErrors({});
    try {
      const body = {
        ...form,
        description: form.description || null,
        keywords: usesKeywords ? form.keywords : [],
        textTemplateId: form.replyType === "TEXT" ? form.textTemplateId || null : null,
        flexTemplateId: form.replyType === "FLEX" ? form.flexTemplateId || null : null,
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
            <div className="grid gap-4 rounded-lg border bg-gray-50/60 p-3">
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
            <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              กฎนี้จะทำงานทุกครั้งที่เกิดเหตุการณ์ “{TRIGGER_LABELS[form.triggerType]}” โดยไม่ต้องใช้ Keyword
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="รูปแบบการตอบกลับ">
              <Select value={form.replyType} onValueChange={(v) => set({ replyType: v as "TEXT" | "FLEX" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">Text Message</SelectItem>
                  <SelectItem value="FLEX">Flex Message</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {form.replyType === "TEXT" ? (
              <Field label="ข้อความตอบกลับ" required error={errors.textTemplateId}>
                <Select value={form.textTemplateId} onValueChange={(v) => set({ textTemplateId: v })}>
                  <SelectTrigger><SelectValue placeholder={texts.isLoading ? "กำลังโหลด..." : "เลือกข้อความ"} /></SelectTrigger>
                  <SelectContent>
                    {(texts.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Flex Message" required error={errors.flexTemplateId}>
                <Select value={form.flexTemplateId} onValueChange={(v) => set({ flexTemplateId: v })}>
                  <SelectTrigger><SelectValue placeholder={flexes.isLoading ? "กำลังโหลด..." : "เลือก Flex Message"} /></SelectTrigger>
                  <SelectContent>
                    {(flexes.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          {((form.replyType === "TEXT" && texts.data?.length === 0) || (form.replyType === "FLEX" && flexes.data?.length === 0)) && (
            <p className="text-sm text-muted-foreground">
              ยังไม่มี Template —{" "}
              <Link className="text-primary underline" href={form.replyType === "TEXT" ? "/text-messages" : "/flex-builder/new"}>
                สร้าง{form.replyType === "TEXT" ? "ข้อความ" : " Flex Message"}ใหม่
              </Link>
            </p>
          )}
          {(selectedText || selectedFlex) && (
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">ตัวอย่างการตอบกลับ (ใช้ค่าตัวอย่างของตัวแปร)</Label>
              <ChatBackdrop>
                {form.replyType === "TEXT" && selectedText ? (
                  <LineTextBubble text={renderTemplate(selectedText.content, sampleTemplateValues())} />
                ) : selectedFlex ? (
                  <div className="origin-top-left scale-90"><FlexPreview contents={selectedFlex.contents} /></div>
                ) : null}
              </ChatBackdrop>
            </div>
          )}
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
