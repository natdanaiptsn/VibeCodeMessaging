"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "สว่าง", icon: Sun },
  { value: "dark", label: "มืด", icon: Moon },
  { value: "system", label: "ตามเครื่อง", icon: Monitor },
];

/** ปุ่มสลับธีม สว่าง / มืด / ตามเครื่อง */
export function ThemeToggle({ className }: { className?: string }) {
  const pref = useThemePreference();
  return (
    <div role="radiogroup" aria-label="ธีมสี" className={cn("grid grid-cols-3 gap-1 rounded-lg border bg-muted/60 p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setThemePreference(value)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] leading-tight font-medium whitespace-nowrap transition-colors",
              active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
