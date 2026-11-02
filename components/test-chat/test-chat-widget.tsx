"use client";

/**
 * แชททดสอบ (ปุ่มลอยมุมขวาล่าง) — พิมพ์เหมือนลูกค้าใน LINE แล้วดูว่า LINE OA จะตอบอะไร
 * - ใช้เครื่องมือตอบกลับตัวเดียวกับ Webhook จริง ผ่าน POST /api/rules/test
 * - ไม่ส่งข้อความถึง LINE จริง ไม่บันทึกลูกค้า/ประวัติ และไม่ใช้โควตาข้อความ
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Image as ImageIcon,
  Info,
  Loader2,
  MapPin,
  RotateCcw,
  SendHorizontal,
  Smile,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { FlexPreview, type FlexAction } from "@/components/flex/flex-preview";
import { apiFetch, ApiClientError, useApiQuery } from "@/hooks/use-api";
import { useCan, useProjectPath } from "@/hooks/use-app-context";
import { cn } from "@/lib/utils";

type Trigger = "TEXT" | "POSTBACK" | "FOLLOW" | "IMAGE" | "STICKER" | "LOCATION";
type OutgoingMessage = { type: "text"; text: string } | { type: "flex"; altText: string; contents: unknown };
type TestResult = {
  source: "RULE" | "DEFAULT" | null;
  messages: OutgoingMessage[];
  matchedRules: { id: string; name: string; keyword?: string }[];
  errors: string[];
  skippedReason?: string;
  autoReplyEnabled: boolean;
};
type UserKind = "text" | "image" | "sticker" | "location" | "postback";
type ChatItem =
  | { id: number; role: "user"; kind: UserKind; text: string }
  | { id: number; role: "event"; text: string }
  | { id: number; role: "bot"; message: OutgoingMessage; first: boolean }
  | { id: number; role: "result"; result: TestResult }
  | { id: number; role: "error"; text: string };
type RuleSummary = { isActive: boolean; triggerType: string; matchType: string; keywords: { keyword: string }[] };
type AccountSummary = { displayName: string | null; pictureUrl: string | null };

const OPEN_EVENT = "lineoa:open-test-chat";

/** เปิดแชททดสอบจากส่วนอื่นของหน้าเว็บ (เช่น ขั้นตอนที่ 5 ของหน้า LINE OA Settings) */
export function openTestChat() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

const SKIP_LABEL: Record<string, string> = {
  NO_MATCH: "ไม่มีกฎที่ตรงกับข้อความนี้ และไม่ได้เปิดข้อความตอบกลับเริ่มต้น (Default Reply) — LINE OA จะไม่ตอบ",
  DEFAULT_COOLDOWN: "Default Reply อยู่ในช่วงพัก (cooldown) — LINE OA จะไม่ตอบซ้ำ",
  BUILD_FAILED: "สร้างข้อความตอบกลับไม่สำเร็จ",
  AUTO_REPLY_DISABLED: "ระบบตอบกลับอัตโนมัติถูกปิด",
};

let seq = 0;
const nextId = () => ++seq;

function BotAvatar({ pictureUrl, className }: { pictureUrl?: string | null; className?: string }) {
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary", className)}>
      {pictureUrl ? (
        <img src={pictureUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <Bot className="size-[18px]" />
      )}
    </span>
  );
}

function ResultNote({ result }: { result: TestResult }) {
  const projectPath = useProjectPath();
  let icon: ReactNode;
  let body: ReactNode;
  if (result.source === "RULE") {
    icon = <CheckCircle2 className="mt-px size-3.5 shrink-0 text-primary" />;
    body = (
      <>
        ตรงกับกฎ{" "}
        {result.matchedRules.map((r, i) => (
          <span key={r.id}>
            {i > 0 && ", "}
            <b className="font-medium text-foreground">“{r.name}”</b>
            {r.keyword && <> (คีย์เวิร์ด <code className="font-mono">{r.keyword}</code>)</>}
          </span>
        ))}
      </>
    );
  } else if (result.source === "DEFAULT") {
    icon = <Info className="mt-px size-3.5 shrink-0 text-sky-600 dark:text-sky-400" />;
    body = <>ไม่มีกฎที่ตรง จึงตอบด้วยข้อความตอบกลับเริ่มต้น (Default Reply)</>;
  } else {
    icon = <CircleSlash className="mt-px size-3.5 shrink-0" />;
    body = (
      <>
        {SKIP_LABEL[result.skippedReason ?? ""] ?? "ไม่มีการตอบกลับ"}{" "}
        <Link href={projectPath("/auto-reply")} className="font-medium text-primary hover:underline">สร้างกฎ</Link>
      </>
    );
  }
  return (
    <div className="space-y-1 pl-10">
      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
        {icon}
        <span>{body}</span>
      </p>
      {result.errors.map((e) => (
        <p key={e} className="rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700 dark:bg-red-500/15 dark:text-red-300">{e}</p>
      ))}
    </div>
  );
}

function UserBubble({ item }: { item: Extract<ChatItem, { role: "user" }> }) {
  if (item.kind === "sticker") {
    return (
      <div className="flex justify-end">
        <div className="flex flex-col items-center text-[11px] text-muted-foreground">
          <span className="text-5xl leading-none">😊</span>
          สติกเกอร์ (จำลอง)
        </div>
      </div>
    );
  }
  const icon = item.kind === "image" ? <ImageIcon className="size-4" /> : item.kind === "location" ? <MapPin className="size-4" /> : null;
  return (
    <div className="flex justify-end">
      <div className="flex max-w-[80%] items-center gap-1.5 rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-white shadow-xs">
        {icon}
        {item.text}
      </div>
    </div>
  );
}

export function TestChatWidget() {
  const projectPath = useProjectPath();
  const canTest = useCan("rules:view");
  const canViewLine = useCan("line:view");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const account = useApiQuery<AccountSummary>(["line-account"], open && canViewLine ? "/api/line/account" : null);
  const rules = useApiQuery<RuleSummary[]>(["rules", "test-chat"], open ? "/api/rules?status=active" : null);
  const name = account.data?.displayName || "LINE OA ของคุณ";
  const picture = account.data?.pictureUrl ?? null;

  const suggestions = Array.from(
    new Set(
      (rules.data ?? [])
        .filter((r) => r.isActive && r.triggerType === "TEXT" && r.matchType !== "REGEX")
        .map((r) => r.keywords[0]?.keyword)
        .filter((k): k is string => Boolean(k && k.length <= 30)),
    ),
  ).slice(0, 6);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [items, pending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!canTest) return null;

  const send = async (trigger: Trigger, payload: string, shown: ChatItem | null) => {
    if (pending) return;
    if (shown) setItems((prev) => [...prev, shown]);
    setPending(true);
    try {
      const result = await apiFetch<TestResult>("/api/rules/test", { method: "POST", body: { text: payload, triggerType: trigger } });
      setAutoReplyEnabled(result.autoReplyEnabled);
      setItems((prev) => [
        ...prev,
        ...result.messages.map((message, i): ChatItem => ({ id: nextId(), role: "bot", message, first: i === 0 })),
        { id: nextId(), role: "result", result },
      ]);
    } catch (err) {
      setItems((prev) => [...prev, { id: nextId(), role: "error", text: err instanceof ApiClientError ? err.message : "ทดสอบไม่สำเร็จ กรุณาลองใหม่" }]);
    } finally {
      setPending(false);
    }
  };

  const sendText = (value: string) => {
    const t = value.trim();
    if (!t || pending) return;
    setText("");
    void send("TEXT", t, { id: nextId(), role: "user", kind: "text", text: t });
  };

  const onFlexAction = (action: FlexAction) => {
    const a = action as Record<string, unknown>;
    switch (a.type) {
      case "message":
        sendText(String(a.text ?? ""));
        return;
      case "postback": {
        const data = String(a.data ?? "");
        const display = typeof a.displayText === "string" && a.displayText ? a.displayText : null;
        void send(
          "POSTBACK",
          data,
          display ? { id: nextId(), role: "user", kind: "postback", text: display } : { id: nextId(), role: "event", text: `กดปุ่ม (Postback: ${data})` },
        );
        return;
      }
      case "uri": {
        const uri = String(a.uri ?? "");
        if (/^https?:\/\//i.test(uri)) window.open(uri, "_blank", "noopener,noreferrer");
        else toast.info(`ปุ่มนี้เปิดลิงก์ ${uri} (ทำงานในแอป LINE)`);
        return;
      }
      case "clipboard":
        void navigator.clipboard?.writeText(String(a.clipboardText ?? "")).then(() => toast.success("คัดลอกแล้ว"), () => undefined);
        return;
      default:
        toast.info("ปุ่มประเภทนี้ทำงานได้เฉพาะในแอป LINE");
    }
  };

  const reset = () => {
    setItems([]);
    setText("");
    inputRef.current?.focus();
  };

  const lifted = /^\/p\/[^/]+\/inbox(\/|$)/.test(pathname);

  return (
    <>
      {open && (
        <section
          aria-label="แชททดสอบ"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          className={cn(
            "fixed inset-x-2 top-16 z-40 flex flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4",
            "sm:inset-x-auto sm:top-auto sm:right-5 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[390px]",
            lifted ? "bottom-36 sm:bottom-40" : "bottom-20 sm:bottom-24",
          )}
        >
          <header className="flex items-center gap-2.5 border-b px-3.5 py-3 shadow-xs">
            <BotAvatar pictureUrl={picture} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="size-2 rounded-full bg-primary" />
                แชททดสอบ · ไม่ส่งถึง LINE จริง
              </p>
            </div>
            <button
              type="button"
              title="จำลองลูกค้าเพิ่มเพื่อน (Follow)"
              aria-label="จำลองลูกค้าเพิ่มเพื่อน"
              disabled={pending}
              onClick={() => void send("FOLLOW", "", { id: nextId(), role: "event", text: "ลูกค้าเพิ่ม LINE OA เป็นเพื่อน (จำลอง)" })}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <UserPlus className="size-4" />
            </button>
            <button type="button" title="ล้างแชท" aria-label="ล้างแชท" onClick={reset} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <RotateCcw className="size-4" />
            </button>
            <button type="button" title="ปิด" aria-label="ปิดแชททดสอบ" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <X className="size-4" />
            </button>
          </header>

          {!autoReplyEnabled && (
            <p className="flex items-start gap-1.5 border-b bg-amber-50 px-3.5 py-2 text-[11px] text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              ระบบตอบกลับอัตโนมัติปิดอยู่ ลูกค้าจริงจะไม่ได้รับคำตอบ (หน้านี้ยังแสดงผลให้ดูเหมือนเปิดอยู่) — เปิดได้ที่เมนูตั้งค่าระบบ
            </p>
          )}

          <div ref={scrollRef} className="thin-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto bg-chat-bg p-3.5">
            {items.length === 0 && !pending && (
              <div className="flex flex-col items-center px-3 pt-6 text-center">
                <BotAvatar pictureUrl={picture} className="size-14" />
                <p className="mt-3 text-sm font-medium">ทดสอบการตอบกลับในเว็บ</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  พิมพ์ข้อความเหมือนเป็นลูกค้าใน LINE แล้วดูว่า LINE OA จะตอบอะไร ใช้กฎตอบกลับชุดเดียวกับของจริง แต่ไม่ส่งข้อความถึง LINE
                </p>
                {suggestions.length > 0 ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => sendText(s)}
                        className="rounded-full border border-primary/40 bg-card px-3 py-1 text-xs text-primary transition hover:bg-primary hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  rules.data && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      ยังไม่มีกฎแบบคีย์เวิร์ด —{" "}
                      <Link href={projectPath("/auto-reply")} className="font-medium text-primary hover:underline">สร้างกฎตอบกลับ</Link>
                    </p>
                  )
                )}
              </div>
            )}

            {items.map((item) => {
              switch (item.role) {
                case "user":
                  return <UserBubble key={item.id} item={item} />;
                case "event":
                  return (
                    <div key={item.id} className="flex justify-center">
                      <span className="rounded-full bg-black/10 px-3 py-0.5 text-[11px] text-gray-700 dark:bg-white/10 dark:text-gray-300">{item.text}</span>
                    </div>
                  );
                case "bot":
                  return (
                    <div key={item.id} className="flex items-start gap-2">
                      {item.first ? <BotAvatar pictureUrl={picture} /> : <span className="w-8 shrink-0" />}
                      {item.message.type === "text" ? (
                        <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-chat-bubble px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-chat-bubble-foreground shadow-xs">
                          {item.message.text}
                        </div>
                      ) : (
                        <div className="thin-scrollbar min-w-0 flex-1 overflow-x-auto">
                          <FlexPreview contents={item.message.contents} onAction={onFlexAction} />
                        </div>
                      )}
                    </div>
                  );
                case "result":
                  return <ResultNote key={item.id} result={item.result} />;
                case "error":
                  return (
                    <p key={item.id} className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300">{item.text}</p>
                  );
              }
            })}

            {pending && (
              <div className="flex items-center gap-2" aria-live="polite">
                <BotAvatar pictureUrl={picture} />
                <span className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-chat-bubble px-3.5 py-3 shadow-xs">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-1 border-t px-2.5 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendText(text);
            }}
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              placeholder="พิมพ์ข้อความเพื่อทดสอบ..."
              aria-label="ข้อความทดสอบ"
              className="h-9 min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            {(
              [
                { icon: ImageIcon, label: "ส่งรูปภาพ (จำลอง)", trigger: "IMAGE", kind: "image", shown: "รูปภาพ" },
                { icon: Smile, label: "ส่งสติกเกอร์ (จำลอง)", trigger: "STICKER", kind: "sticker", shown: "สติกเกอร์" },
                { icon: MapPin, label: "ส่งตำแหน่งที่ตั้ง (จำลอง)", trigger: "LOCATION", kind: "location", shown: "ตำแหน่งที่ตั้ง" },
              ] as const
            ).map(({ icon: Icon, label, trigger, kind, shown }) => (
              <button
                key={trigger}
                type="button"
                title={label}
                aria-label={label}
                disabled={pending}
                onClick={() => void send(trigger, "", { id: nextId(), role: "user", kind, text: shown })}
                className="rounded-md p-1.5 text-primary/60 transition hover:bg-muted hover:text-primary disabled:opacity-40"
              >
                <Icon className="size-[18px]" />
              </button>
            ))}
            <button
              type="submit"
              title="ส่ง"
              aria-label="ส่ง"
              disabled={pending || !text.trim()}
              className="ml-0.5 flex size-8 items-center justify-center rounded-full bg-primary text-white transition hover:bg-primary-hover disabled:bg-primary/30"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "ปิดแชททดสอบ" : "เปิดแชททดสอบ"}
        title={open ? "ปิดแชททดสอบ" : "แชททดสอบการตอบกลับ"}
        className={cn(
          "fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-lg ring-4 ring-primary/15 transition hover:scale-105 hover:bg-primary-hover sm:right-5",
          lifted ? "bottom-20 sm:bottom-24" : "bottom-4 sm:bottom-5",
        )}
      >
        {open ? <ChevronDown className="size-7" /> : <Bot className="size-7" />}
      </button>
    </>
  );
}
