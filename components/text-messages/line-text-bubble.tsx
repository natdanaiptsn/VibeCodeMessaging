import { cn } from "@/lib/utils";

/** แสดงข้อความแบบ bubble ของ LINE (ฝั่ง OA) — React escape ข้อความให้อัตโนมัติ */
export function LineTextBubble({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">OA</div>
      <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-gray-900 shadow-xs">
        {text || <span className="text-muted-foreground">(ข้อความว่าง)</span>}
      </div>
    </div>
  );
}
