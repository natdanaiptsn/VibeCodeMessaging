"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function KeywordInput({
  value,
  onChange,
  placeholder,
  invalid,
  errors,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  invalid?: boolean;
  errors?: Record<number, string>;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/\n|,(?![^{]*\})/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && next.length < 50) next.push(p.slice(0, 200));
    onChange(next);
    setDraft("");
  };
  return (
    <div className={cn("rounded-md border border-input bg-white p-2 shadow-xs", invalid && "border-destructive")}>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((k, i) => (
            <span
              key={`${k}-${i}`}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground",
                errors?.[i] && "bg-red-50 text-red-700 ring-1 ring-red-300",
              )}
              title={errors?.[i]}
            >
              <span className="truncate font-mono">{k}</span>
              <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`ลบ ${k}`} className="opacity-60 hover:opacity-100">
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[\n,]/.test(text)) {
            e.preventDefault();
            add(text);
          }
        }}
        placeholder={placeholder ?? "พิมพ์ Keyword แล้วกด Enter"}
        className="h-8 border-0 px-1 shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
