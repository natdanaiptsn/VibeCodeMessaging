"use client";

import { Download, MapPin, MousePointerClick, UserMinus, UserPlus } from "lucide-react";
import { FlexPreview } from "@/components/flex/flex-preview";
import { MessageStatusBadge } from "@/components/common/badges";
import { formatTime } from "@/lib/format";
import { MESSAGE_TYPE_LABELS, REPLY_SOURCE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  text: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  timestamp: string;
  lineMessageId: string | null;
  sentBy: { id: string; name: string } | null;
  replyLog: { id: string; status: string; source: string; ruleName: string | null; errorMessage: string | null } | null;
  sourceOf: { id: string; status: string; ruleName: string | null; errorMessage: string | null; source: string }[];
};

function stickerUrl(payload: Record<string, unknown> | null): string | null {
  const id = payload?.stickerId;
  if (typeof id !== "string" || !/^\d+$/.test(id)) return null;
  return `https://stickershop.line-scdn.net/stickershop/v1/sticker/${id}/android/sticker.png`;
}

function Content({ m }: { m: ThreadMessage }) {
  const p = m.payload ?? {};
  switch (m.type) {
    case "TEXT":
      return <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>;
    case "IMAGE":
      return (
        <a href={`/api/messages/${m.id}/content`} target="_blank" rel="noopener noreferrer">
          <img
            src={`/api/messages/${m.id}/content`}
            alt="รูปภาพจากลูกค้า"
            loading="lazy"
            className="max-h-64 max-w-full rounded-lg bg-gray-100 object-contain"
            onError={(e) => ((e.currentTarget as HTMLImageElement).alt = "ไม่สามารถโหลดรูปภาพ (ไฟล์อาจหมดอายุใน LINE แล้ว)")}
          />
        </a>
      );
    case "STICKER": {
      const url = stickerUrl(p);
      return url ? <img src={url} alt="สติกเกอร์" className="size-28 object-contain" referrerPolicy="no-referrer" /> : <p className="text-sm">[สติกเกอร์]</p>;
    }
    case "LOCATION": {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      const ok = Number.isFinite(lat) && Number.isFinite(lng);
      return (
        <div className="text-sm">
          <p className="flex items-center gap-1 font-medium"><MapPin className="size-4 text-red-500" /> {String(p.title ?? "ตำแหน่ง")}</p>
          {typeof p.address === "string" && <p className="text-xs opacity-80">{p.address}</p>}
          {ok && (
            <a className="mt-1 inline-block text-xs text-blue-600 underline" href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer">
              เปิดแผนที่ ({lat.toFixed(5)}, {lng.toFixed(5)})
            </a>
          )}
        </div>
      );
    }
    case "POSTBACK":
      return (
        <p className="flex items-center gap-1.5 text-sm">
          <MousePointerClick className="size-4 shrink-0" />
          <span className="break-all">Postback: <code className="text-xs">{m.text}</code></span>
        </p>
      );
    case "VIDEO":
    case "AUDIO":
    case "FILE":
      return (
        <a href={`/api/messages/${m.id}/content`} className="flex items-center gap-2 text-sm underline" target="_blank" rel="noopener noreferrer">
          <Download className="size-4" /> {MESSAGE_TYPE_LABELS[m.type]} {m.text ? `— ${m.text}` : ""}
        </a>
      );
    case "FLEX": {
      const contents = (p as { contents?: unknown }).contents;
      return (
        <div className="max-w-full overflow-hidden">
          <FlexPreview contents={contents} />
          <p className="mt-1 text-xs text-muted-foreground">altText: {m.text}</p>
        </div>
      );
    }
    default:
      return <p className="text-sm">[{MESSAGE_TYPE_LABELS[m.type] ?? m.type}]</p>;
  }
}

export function MessageBubble({ m, timezone }: { m: ThreadMessage; timezone: string }) {
  if (m.type === "FOLLOW" || m.type === "UNFOLLOW") {
    return (
      <div className="flex justify-center py-1">
        <span className="flex items-center gap-1.5 rounded-full bg-gray-200/80 px-3 py-1 text-xs text-gray-600">
          {m.type === "FOLLOW" ? <UserPlus className="size-3.5" /> : <UserMinus className="size-3.5" />}
          {m.type === "FOLLOW" ? "ลูกค้าเพิ่มเพื่อน / ปลดบล็อก" : "ลูกค้าเลิกติดตาม / บล็อก"} · {formatTime(m.timestamp, timezone)}
        </span>
      </div>
    );
  }
  const outbound = m.direction === "OUTBOUND";
  const reply = m.sourceOf[0];
  const plain = m.type === "STICKER" || m.type === "IMAGE" || m.type === "FLEX";
  return (
    <div className={cn("flex flex-col gap-1", outbound ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[70%]",
          !plain && "rounded-2xl px-3.5 py-2 shadow-xs",
          !plain && (outbound ? "rounded-tr-sm bg-[#06c755] text-white" : "rounded-tl-sm bg-white text-gray-900"),
        )}
      >
        <Content m={m} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <span>{formatTime(m.timestamp, timezone)}</span>
        {outbound && (
          <span>
            · {m.sentBy ? `ส่งโดย ${m.sentBy.name}` : m.replyLog ? `${REPLY_SOURCE_LABELS[m.replyLog.source] ?? ""}${m.replyLog.ruleName ? `: ${m.replyLog.ruleName}` : ""}` : "ระบบ"}
          </span>
        )}
        {!outbound && m.status !== "PENDING" && <MessageStatusBadge status={m.status} />}
        {!outbound && reply?.ruleName && <span>· {reply.ruleName}</span>}
      </div>
      {!outbound && reply?.status === "FAILED" && reply.errorMessage && (
        <p className="max-w-[85%] rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 sm:max-w-[70%]">{reply.errorMessage}</p>
      )}
    </div>
  );
}
