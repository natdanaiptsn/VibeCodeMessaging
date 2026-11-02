import { cn } from "@/lib/utils";

/** รูป LINE OA ของโปรเจกต์ (ถ้ายังไม่เชื่อมต่อ ใช้ตัวอักษรแรกของชื่อ) */
export function ProjectAvatar({ name, pictureUrl, className }: { name: string; pictureUrl?: string | null; className?: string }) {
  // ข้ามสระหน้าของภาษาไทย (เ แ โ ใ ไ) เพื่อให้ได้พยัญชนะตัวแรก เช่น “โปรเจกต์” → “ป”
  const initial = [...name.trim()].find((ch) => !/[\u0e40-\u0e44\s]/.test(ch))?.toUpperCase() ?? "P";
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/12 text-sm font-semibold text-primary",
        className,
      )}
    >
      {pictureUrl ? (
        <img src={pictureUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initial
      )}
    </span>
  );
}
