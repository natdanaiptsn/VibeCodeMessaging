"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** รูปโปรไฟล์ (LINE OA / ผู้ใช้) — ถ้าไม่มีหรือโหลดไม่ได้ ใช้ตัวอักษรแรกของชื่อ */
export function ProjectAvatar({ name, pictureUrl, className }: { name: string; pictureUrl?: string | null; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  // ข้ามสระหน้าของภาษาไทย (เ แ โ ใ ไ) เพื่อให้ได้พยัญชนะตัวแรก เช่น “โปรเจกต์” → “ป”
  const initial = [...name.trim()].find((ch) => !/[เ-ไ\s]/.test(ch))?.toUpperCase() ?? "P";
  const showImage = pictureUrl && failed !== pictureUrl;
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/12 text-sm font-semibold text-primary",
        className,
      )}
    >
      {showImage ? (
        <img src={pictureUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" onError={() => setFailed(pictureUrl)} />
      ) : (
        initial
      )}
    </span>
  );
}
