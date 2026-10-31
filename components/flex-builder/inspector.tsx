"use client";

import { useRef, useState } from "react";
import { Braces, ImageUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useCan } from "@/hooks/use-app-context";
import { checkActionUri, checkMediaUrl } from "@/lib/flex/url-safety";
import { TEMPLATE_VARIABLES } from "@/lib/templates/variables";
import type { BBubble, BNode } from "@/components/flex-builder/model";
import { KIND_LABELS } from "@/components/flex-builder/model";

const DEFAULT = "__default";
const CUSTOM = "__custom";
const SPACING = ["none", "xs", "sm", "md", "lg", "xl", "xxl"];
const TEXT_SIZES = ["xxs", "xs", "sm", "md", "lg", "xl", "xxl", "3xl", "4xl", "5xl"];
const IMAGE_SIZES = [...TEXT_SIZES, "full"];

type Patch = (patch: Record<string, unknown>) => void;

function Row({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SelectProp({
  label,
  value,
  options,
  onChange,
  allowDefault = true,
}: {
  label: string;
  value: unknown;
  options: (string | { value: string; label: string })[];
  onChange: (v: string | undefined) => void;
  allowDefault?: boolean;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <Row label={label}>
      <Select value={typeof value === "string" ? value : DEFAULT} onValueChange={(v) => onChange(v === DEFAULT ? undefined : v)}>
        <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          {allowDefault && <SelectItem value={DEFAULT}>ค่าเริ่มต้น</SelectItem>}
          {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </Row>
  );
}

/** เลือกค่า keyword หรือกำหนดเองเป็น px/% */
function KeywordOrPx({ label, value, keywords, onChange, allowPercent = false }: { label: string; value: unknown; keywords: string[]; onChange: (v: string | undefined) => void; allowPercent?: boolean }) {
  const str = typeof value === "string" ? value : "";
  const isCustom = str !== "" && !keywords.includes(str);
  const [custom, setCustom] = useState(isCustom);
  const mode = custom || isCustom ? CUSTOM : str || DEFAULT;
  return (
    <Row label={label}>
      <div className="flex gap-1.5">
        <Select
          value={mode}
          onValueChange={(v) => {
            if (v === CUSTOM) {
              setCustom(true);
              onChange(isCustom ? str : "10px");
            } else {
              setCustom(false);
              onChange(v === DEFAULT ? undefined : v);
            }
          }}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>ค่าเริ่มต้น</SelectItem>
            {keywords.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            <SelectItem value={CUSTOM}>กำหนดเอง (px{allowPercent ? "/%" : ""})</SelectItem>
          </SelectContent>
        </Select>
        {mode === CUSTOM && (
          <Input className="h-8 w-20" value={str} onChange={(e) => onChange(e.target.value.trim() || undefined)} placeholder={allowPercent ? "10px / 50%" : "10px"} />
        )}
      </div>
    </Row>
  );
}

function ColorProp({ label, value, onChange }: { label: string; value: unknown; onChange: (v: string | undefined) => void }) {
  const str = typeof value === "string" ? value : "";
  const valid = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(str);
  return (
    <Row label={label}>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={valid ? str.slice(0, 7) : "#ffffff"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-8 w-9 shrink-0 cursor-pointer rounded border bg-white p-0.5"
          aria-label={label}
        />
        <Input className="h-8 font-mono text-xs" value={str} onChange={(e) => onChange(e.target.value.trim() || undefined)} placeholder="#RRGGBB" aria-invalid={str !== "" && !valid} />
        {str && (
          <Button variant="ghost" size="icon-sm" onClick={() => onChange(undefined)} aria-label="ล้างสี"><X /></Button>
        )}
      </div>
    </Row>
  );
}

function NumberProp({ label, value, onChange, min = 0, max = 100 }: { label: string; value: unknown; onChange: (v: number | undefined) => void; min?: number; max?: number }) {
  return (
    <Row label={label}>
      <Input
        type="number"
        className="h-8"
        min={min}
        max={max}
        value={typeof value === "number" ? value : ""}
        placeholder="ค่าเริ่มต้น"
        onChange={(e) => onChange(e.target.value === "" ? undefined : Math.max(min, Math.min(max, Math.round(Number(e.target.value)))))}
      />
    </Row>
  );
}

function SwitchProp({ label, value, onChange }: { label: string; value: unknown; onChange: (v: boolean | undefined) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch checked={value === true} onCheckedChange={(v) => onChange(v ? true : undefined)} />
    </label>
  );
}

type Action = Record<string, unknown> & { type?: string };

export function ActionEditor({ value, onChange, required = false }: { value: unknown; onChange: (v: Action | undefined) => void; required?: boolean }) {
  const action = (value && typeof value === "object" ? value : {}) as Action;
  const type = action.type ?? (required ? "uri" : DEFAULT);
  const set = (patch: Record<string, unknown>) => {
    const next: Action = { ...action, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined || v === "") delete next[k];
    onChange(next);
  };
  const uriCheck = type === "uri" && typeof action.uri === "string" ? checkActionUri(action.uri) : null;
  return (
    <div className="grid gap-2 rounded-md border bg-gray-50/70 p-2">
      <Row label="Action">
        <Select
          value={type}
          onValueChange={(t) => {
            if (t === DEFAULT) return onChange(undefined);
            const label = typeof action.label === "string" ? action.label : required ? "ปุ่ม" : undefined;
            if (t === "uri") onChange({ type: "uri", ...(label ? { label } : {}), uri: "https://example.com" });
            if (t === "message") onChange({ type: "message", ...(label ? { label } : {}), text: label ?? "ข้อความ" });
            if (t === "postback") onChange({ type: "postback", ...(label ? { label } : {}), data: "action=example" });
          }}
        >
          <SelectTrigger size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {!required && <SelectItem value={DEFAULT}>ไม่มี Action</SelectItem>}
            <SelectItem value="uri">เปิดลิงก์ (URI)</SelectItem>
            <SelectItem value="message">ส่งข้อความ (Message)</SelectItem>
            <SelectItem value="postback">Postback</SelectItem>
            {type === "datetimepicker" && <SelectItem value="datetimepicker">Datetime picker</SelectItem>}
            {type === "clipboard" && <SelectItem value="clipboard">Clipboard</SelectItem>}
          </SelectContent>
        </Select>
      </Row>
      {type !== DEFAULT && (
        <>
          <Row label={required ? "ข้อความบนปุ่ม (label)" : "Label (ไม่บังคับ)"}>
            <Input className="h-8" maxLength={40} value={String(action.label ?? "")} onChange={(e) => set({ label: e.target.value })} />
          </Row>
          {type === "uri" && (
            <Row label="Action URL" hint="อนุญาต https://, line://, tel: เท่านั้น">
              <Input className="h-8 font-mono text-xs" maxLength={1000} value={String(action.uri ?? "")} onChange={(e) => set({ uri: e.target.value.trim() })} aria-invalid={uriCheck ? !uriCheck.ok : false} />
              {uriCheck && !uriCheck.ok && <p className="text-[11px] text-destructive">{uriCheck.reason}</p>}
            </Row>
          )}
          {type === "message" && (
            <Row label="ข้อความที่ส่งเมื่อกด">
              <Input className="h-8" maxLength={300} value={String(action.text ?? "")} onChange={(e) => set({ text: e.target.value })} />
            </Row>
          )}
          {type === "postback" && (
            <>
              <Row label="Postback Data" hint="สูงสุด 300 ตัวอักษร — ใช้กับกฎที่ทริกเกอร์แบบ Postback ได้">
                <Input className="h-8 font-mono text-xs" maxLength={300} value={String(action.data ?? "")} onChange={(e) => set({ data: e.target.value })} />
              </Row>
              <Row label="ข้อความที่แสดงในแชท (displayText)">
                <Input className="h-8" maxLength={300} value={String(action.displayText ?? "")} onChange={(e) => set({ displayText: e.target.value })} />
              </Row>
            </>
          )}
        </>
      )}
    </div>
  );
}

function VariableButtons({ onInsert }: { onInsert: (token: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {TEMPLATE_VARIABLES.map((v) => (
        <button key={v.key} type="button" onClick={() => onInsert(`{{${v.key}}}`)} className="flex items-center gap-0.5 rounded border bg-white px-1.5 py-0.5 text-[11px] hover:bg-gray-50" title={v.label}>
          <Braces className="size-3" /> {v.key}
        </button>
      ))}
    </div>
  );
}

function ImageUrlEditor({ value, onChange }: { value: unknown; onChange: (url: string) => void }) {
  const canUpload = useCan("media:upload");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const library = useApiQuery<{ id: string; url: string; fileName: string }[]>(["media"], showLibrary ? "/api/media" : null);
  const str = String(value ?? "");
  const check = str ? checkMediaUrl(str) : null;
  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("ไฟล์มีขนาดใหญ่เกิน 5 MB");
    if (!["image/jpeg", "image/png"].includes(file.type)) return toast.error("รองรับเฉพาะ JPEG และ PNG");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await apiFetch<{ url: string; warning: string | null }>("/api/media", { method: "POST", formData: fd });
      onChange(r.url);
      toast.success("อัปโหลดรูปภาพแล้ว");
      if (r.warning) toast.warning(r.warning);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  };
  return (
    <Row label="URL รูปภาพ (HTTPS, JPEG/PNG)">
      <Input className="h-8 font-mono text-xs" value={str} onChange={(e) => onChange(e.target.value.trim())} aria-invalid={check ? !check.ok : false} />
      {check && !check.ok && <p className="text-[11px] text-destructive">{check.reason}</p>}
      {canUpload && (
        <div className="flex gap-1.5">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <ImageUp />} อัปโหลด (≤ 5 MB)
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowLibrary((s) => !s)}>คลังรูป</Button>
        </div>
      )}
      {showLibrary && (
        <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto rounded border p-1.5">
          {(library.data ?? []).length === 0 && <p className="col-span-4 text-xs text-muted-foreground">ยังไม่มีรูปที่อัปโหลด</p>}
          {(library.data ?? []).map((m) => (
            <button key={m.id} onClick={() => onChange(m.url)} className="aspect-square overflow-hidden rounded border hover:ring-2 hover:ring-primary" title={m.fileName}>
              <img src={`/api/media/${m.id}`} alt={m.fileName} className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </Row>
  );
}

function CommonLayout({ node, patch }: { node: BNode; patch: Patch }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <KeywordOrPx label="Margin (ระยะห่างด้านบน/ซ้าย)" value={node.props.margin} keywords={SPACING} onChange={(v) => patch({ margin: v })} />
      <NumberProp label="Flex (สัดส่วนพื้นที่)" value={node.props.flex} onChange={(v) => patch({ flex: v })} />
    </div>
  );
}

export function NodeInspector({ node, patch, isRoot }: { node: BNode; patch: Patch; isRoot: boolean }) {
  const p = node.props;
  const [showAdvanced, setShowAdvanced] = useState(false);
  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold">{KIND_LABELS[node.kind]}</p>
      {node.kind === "text" && (
        <>
          <Row label="ข้อความ">
            <Textarea rows={3} value={String(p.text ?? "")} onChange={(e) => patch({ text: e.target.value })} />
            <VariableButtons onInsert={(t) => patch({ text: `${String(p.text ?? "")}${t}` })} />
          </Row>
          <div className="grid grid-cols-2 gap-2">
            <KeywordOrPx label="ขนาดตัวอักษร" value={p.size} keywords={TEXT_SIZES} onChange={(v) => patch({ size: v })} />
            <SelectProp label="น้ำหนัก" value={p.weight} options={[{ value: "regular", label: "ปกติ" }, { value: "bold", label: "ตัวหนา" }]} onChange={(v) => patch({ weight: v })} />
            <SelectProp label="จัดแนวนอน (align)" value={p.align} options={[{ value: "start", label: "ซ้าย" }, { value: "center", label: "กลาง" }, { value: "end", label: "ขวา" }]} onChange={(v) => patch({ align: v })} />
            <SelectProp label="จัดแนวตั้ง (gravity)" value={p.gravity} options={[{ value: "top", label: "บน" }, { value: "center", label: "กลาง" }, { value: "bottom", label: "ล่าง" }]} onChange={(v) => patch({ gravity: v })} />
            <SelectProp label="ตกแต่ง" value={p.decoration} options={[{ value: "none", label: "ไม่มี" }, { value: "underline", label: "ขีดเส้นใต้" }, { value: "line-through", label: "ขีดฆ่า" }]} onChange={(v) => patch({ decoration: v })} />
            <SelectProp label="รูปแบบ" value={p.style} options={[{ value: "normal", label: "ปกติ" }, { value: "italic", label: "ตัวเอียง" }]} onChange={(v) => patch({ style: v })} />
          </div>
          <ColorProp label="สีตัวอักษร" value={p.color} onChange={(v) => patch({ color: v })} />
          <div className="grid grid-cols-2 items-end gap-2">
            <SwitchProp label="ตัดบรรทัด (wrap)" value={p.wrap} onChange={(v) => patch({ wrap: v })} />
            <NumberProp label="จำนวนบรรทัดสูงสุด" value={p.maxLines} onChange={(v) => patch({ maxLines: v })} max={50} />
          </div>
          <CommonLayout node={node} patch={patch} />
          <ActionEditor value={p.action} onChange={(a) => patch({ action: a })} />
        </>
      )}
      {node.kind === "image" && (
        <>
          <ImageUrlEditor value={p.url} onChange={(url) => patch({ url })} />
          <div className="grid grid-cols-2 gap-2">
            <KeywordOrPx label="ขนาด" value={p.size} keywords={IMAGE_SIZES} onChange={(v) => patch({ size: v })} allowPercent />
            <SelectProp label="อัตราส่วน" value={p.aspectRatio} options={["1:1", "20:13", "16:9", "4:3", "3:4", "2:1", "1.51:1"]} onChange={(v) => patch({ aspectRatio: v })} />
            <SelectProp label="การแสดงผล" value={p.aspectMode} options={[{ value: "cover", label: "เต็มพื้นที่ (cover)" }, { value: "fit", label: "พอดีภาพ (fit)" }]} onChange={(v) => patch({ aspectMode: v })} />
            <SelectProp label="จัดแนว" value={p.align} options={[{ value: "start", label: "ซ้าย" }, { value: "center", label: "กลาง" }, { value: "end", label: "ขวา" }]} onChange={(v) => patch({ align: v })} />
          </div>
          <ColorProp label="สีพื้นหลัง" value={p.backgroundColor} onChange={(v) => patch({ backgroundColor: v })} />
          {!isRoot && <CommonLayout node={node} patch={patch} />}
          <ActionEditor value={p.action} onChange={(a) => patch({ action: a })} />
        </>
      )}
      {node.kind === "button" && (
        <>
          <ActionEditor value={p.action} onChange={(a) => patch({ action: a ?? { type: "uri", label: "ปุ่ม", uri: "https://example.com" } })} required />
          <div className="grid grid-cols-2 gap-2">
            <SelectProp label="สไตล์" value={p.style} options={[{ value: "primary", label: "Primary" }, { value: "secondary", label: "Secondary" }, { value: "link", label: "Link" }]} onChange={(v) => patch({ style: v })} />
            <SelectProp label="ความสูง" value={p.height} options={[{ value: "sm", label: "เล็ก (sm)" }, { value: "md", label: "ปกติ (md)" }]} onChange={(v) => patch({ height: v })} />
            <SelectProp label="จัดแนวตั้ง" value={p.gravity} options={[{ value: "top", label: "บน" }, { value: "center", label: "กลาง" }, { value: "bottom", label: "ล่าง" }]} onChange={(v) => patch({ gravity: v })} />
          </div>
          <ColorProp label={p.style === "link" ? "สีตัวอักษร" : "สีปุ่ม"} value={p.color} onChange={(v) => patch({ color: v })} />
          <CommonLayout node={node} patch={patch} />
        </>
      )}
      {node.kind === "separator" && (
        <>
          <KeywordOrPx label="Margin" value={p.margin} keywords={SPACING} onChange={(v) => patch({ margin: v })} />
          <ColorProp label="สีเส้น" value={p.color} onChange={(v) => patch({ color: v })} />
        </>
      )}
      {node.kind === "spacer" && (
        <SelectProp label="ขนาดช่องว่าง" value={p.size} options={SPACING.filter((s) => s !== "none")} onChange={(v) => patch({ size: v })} />
      )}
      {node.kind === "box" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SelectProp
              label="Layout"
              value={p.layout}
              allowDefault={false}
              options={[{ value: "vertical", label: "แนวตั้ง (vertical)" }, { value: "horizontal", label: "แนวนอน (horizontal)" }, { value: "baseline", label: "Baseline" }]}
              onChange={(v) => patch({ layout: v ?? "vertical" })}
            />
            <KeywordOrPx label="ระยะห่างระหว่างลูก (spacing)" value={p.spacing} keywords={SPACING} onChange={(v) => patch({ spacing: v })} />
            <KeywordOrPx label="Padding ทั้งหมด" value={p.paddingAll} keywords={SPACING} onChange={(v) => patch({ paddingAll: v })} allowPercent />
            <KeywordOrPx label="มุมโค้ง (cornerRadius)" value={p.cornerRadius} keywords={SPACING} onChange={(v) => patch({ cornerRadius: v })} />
            <SelectProp
              label="จัดแนวแกนหลัก"
              value={p.justifyContent}
              options={[{ value: "flex-start", label: "ชิดต้น" }, { value: "center", label: "กลาง" }, { value: "flex-end", label: "ชิดท้าย" }, { value: "space-between", label: "กระจาย (between)" }, { value: "space-around", label: "กระจาย (around)" }, { value: "space-evenly", label: "กระจาย (evenly)" }]}
              onChange={(v) => patch({ justifyContent: v })}
            />
            <SelectProp label="จัดแนวแกนรอง" value={p.alignItems} options={[{ value: "flex-start", label: "ชิดต้น" }, { value: "center", label: "กลาง" }, { value: "flex-end", label: "ชิดท้าย" }]} onChange={(v) => patch({ alignItems: v })} />
          </div>
          <ColorProp label="สีพื้นหลัง (Background)" value={p.backgroundColor} onChange={(v) => patch({ backgroundColor: v })} />
          <div className="grid grid-cols-2 gap-2">
            <ColorProp label="สีขอบ (Border)" value={p.borderColor} onChange={(v) => patch({ borderColor: v })} />
            <KeywordOrPx label="ความหนาขอบ" value={p.borderWidth} keywords={["none", "light", "normal", "medium", "semi-bold", "bold"]} onChange={(v) => patch({ borderWidth: v })} />
          </div>
          {!isRoot && <CommonLayout node={node} patch={patch} />}
          <button type="button" className="text-left text-xs text-primary underline" onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? "ซ่อน" : "แสดง"}ตัวเลือกขั้นสูง (padding แยกด้าน, ขนาด, gradient)
          </button>
          {showAdvanced && (
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                {(["paddingTop", "paddingBottom", "paddingStart", "paddingEnd"] as const).map((k) => (
                  <KeywordOrPx key={k} label={k} value={p[k]} keywords={SPACING} onChange={(v) => patch({ [k]: v })} allowPercent />
                ))}
                {(["width", "height"] as const).map((k) => (
                  <Row key={k} label={k === "width" ? "ความกว้าง (px/%)" : "ความสูง (px/%)"}>
                    <Input className="h-8" value={String(p[k] ?? "")} placeholder="อัตโนมัติ" onChange={(e) => patch({ [k]: e.target.value.trim() || undefined })} />
                  </Row>
                ))}
              </div>
              <SwitchProp
                label="พื้นหลังแบบ Gradient"
                value={Boolean(p.background)}
                onChange={(v) => patch({ background: v ? { type: "linearGradient", angle: "90deg", startColor: "#06C755", endColor: "#00A040" } : undefined })}
              />
              {Boolean(p.background) && (() => {
                const bg = p.background as Record<string, string>;
                const setBg = (k: string, val: string | undefined) => patch({ background: { ...bg, [k]: val ?? bg[k] } });
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <ColorProp label="สีเริ่มต้น" value={bg.startColor} onChange={(v) => setBg("startColor", v)} />
                    <ColorProp label="สีสิ้นสุด" value={bg.endColor} onChange={(v) => setBg("endColor", v)} />
                    <Row label="มุม (เช่น 90deg)">
                      <Input className="h-8" value={bg.angle ?? ""} onChange={(e) => setBg("angle", e.target.value.trim())} />
                    </Row>
                  </div>
                );
              })()}
            </div>
          )}
          <ActionEditor value={p.action} onChange={(a) => patch({ action: a })} />
        </>
      )}
      {["icon", "filler", "video"].includes(node.kind) && (
        <p className="text-xs text-muted-foreground">คอมโพเนนต์นี้มาจาก JSON ที่นำเข้า — แก้ไขได้ผ่าน Export/Import JSON</p>
      )}
    </div>
  );
}

export function BubbleInspector({ bubble, patch }: { bubble: BBubble; patch: Patch }) {
  const p = bubble.props;
  const styles = (p.styles ?? {}) as Record<string, Record<string, unknown>>;
  const setStyle = (block: string, key: string, value: unknown) => {
    const blockStyle = { ...(styles[block] ?? {}) };
    if (value === undefined || value === "") delete blockStyle[key];
    else blockStyle[key] = value;
    const next = { ...styles, [block]: blockStyle };
    if (Object.keys(blockStyle).length === 0) delete next[block];
    patch({ styles: Object.keys(next).length ? next : undefined });
  };
  return (
    <div className="grid gap-3">
      <p className="text-sm font-semibold">Bubble (Container)</p>
      <div className="grid grid-cols-2 gap-2">
        <SelectProp label="ขนาด Bubble" value={p.size} options={["nano", "micro", "deca", "hecto", "kilo", "mega", "giga"]} onChange={(v) => patch({ size: v })} />
        <SelectProp label="ทิศทาง" value={p.direction} options={[{ value: "ltr", label: "ซ้าย→ขวา" }, { value: "rtl", label: "ขวา→ซ้าย" }]} onChange={(v) => patch({ direction: v })} />
      </div>
      {(["header", "hero", "body", "footer"] as const).map((block) => (
        <div key={block} className="grid gap-2 rounded-md border p-2">
          <p className="text-xs font-medium capitalize">{block}</p>
          <ColorProp label="สีพื้นหลัง" value={styles[block]?.backgroundColor} onChange={(v) => setStyle(block, "backgroundColor", v)} />
          {block !== "header" && (
            <div className="grid grid-cols-2 items-end gap-2">
              <SwitchProp label="เส้นคั่นด้านบน" value={styles[block]?.separator} onChange={(v) => setStyle(block, "separator", v)} />
              {Boolean(styles[block]?.separator) && <ColorProp label="สีเส้นคั่น" value={styles[block]?.separatorColor} onChange={(v) => setStyle(block, "separatorColor", v)} />}
            </div>
          )}
        </div>
      ))}
      <ActionEditor value={p.action} onChange={(a) => patch({ action: a })} />
    </div>
  );
}
