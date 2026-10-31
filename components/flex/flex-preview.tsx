"use client";

/**
 * แสดงตัวอย่าง Flex Message แบบใกล้เคียงกับการแสดงผลบนแอป LINE
 * - ไม่สร้างลิงก์จริงจาก action (ป้องกัน javascript: / URL อันตราย) — แสดงเป็น title เท่านั้น
 * - รองรับการเลือก component (ใช้ใน Flex Builder) ผ่าน key "__id"
 */
import type { CSSProperties, ReactNode } from "react";
import { ImageOff, Play } from "lucide-react";
import { cn } from "@/lib/utils";

type Json = Record<string, unknown>;

const TEXT_SIZE: Record<string, number> = { xxs: 11, xs: 13, sm: 14, md: 16, lg: 19, xl: 22, xxl: 29, "3xl": 35, "4xl": 48, "5xl": 74 };
const SPACING: Record<string, number> = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };
const SPACER: Record<string, number> = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
const IMAGE_SIZE: Record<string, string> = {
  xxs: "40px", xs: "60px", sm: "80px", md: "100px", lg: "120px", xl: "140px", xxl: "160px",
  "3xl": "180px", "4xl": "200px", "5xl": "240px", full: "100%",
};
const BUBBLE_WIDTH: Record<string, number> = { nano: 120, micro: 160, deca: 220, hecto: 241, kilo: 260, mega: 300, giga: 500 };
const BORDER_WIDTH: Record<string, number> = { none: 0, light: 0.5, normal: 1, medium: 2, "semi-bold": 3, bold: 4 };
const CORNER: Record<string, number> = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };

function px(v: unknown, map: Record<string, number>): string | undefined {
  if (typeof v !== "string") return undefined;
  if (v in map) return `${map[v]}px`;
  if (/^\d+(\.\d+)?(px|%)$/.test(v)) return v;
  return undefined;
}

function color(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v) ? v : undefined;
}

function safeImageUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function describeAction(action: unknown): string | undefined {
  if (!action || typeof action !== "object") return undefined;
  const a = action as Json;
  switch (a.type) {
    case "uri":
      return `เปิดลิงก์: ${String(a.uri ?? "")}`;
    case "message":
      return `ส่งข้อความ: ${String(a.text ?? "")}`;
    case "postback":
      return `Postback: ${String(a.data ?? "")}`;
    case "datetimepicker":
      return `เลือกวันเวลา (${String(a.mode ?? "")})`;
    case "clipboard":
      return `คัดลอก: ${String(a.clipboardText ?? "")}`;
    default:
      return undefined;
  }
}

type Ctx = {
  selectedId?: string | null;
  onSelect?: (id: string) => void;
};

function selectable(node: Json, ctx: Ctx) {
  const id = typeof node.__id === "string" ? node.__id : null;
  if (!id || !ctx.onSelect) return {};
  return {
    "data-flex-id": id,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      ctx.onSelect?.(id);
    },
    className: cn(
      "cursor-pointer outline-offset-[-1px] hover:outline hover:outline-1 hover:outline-sky-400",
      ctx.selectedId === id && "outline outline-2 outline-sky-500",
    ),
  };
}

function positionStyle(node: Json): CSSProperties {
  const style: CSSProperties = {};
  if (node.position === "absolute") style.position = "absolute";
  const off = (k: string) => px(node[k], SPACING);
  if (off("offsetTop")) style.top = off("offsetTop");
  if (off("offsetBottom")) style.bottom = off("offsetBottom");
  if (off("offsetStart")) style.left = off("offsetStart");
  if (off("offsetEnd")) style.right = off("offsetEnd");
  if (node.position !== "absolute" && Object.keys(style).length) style.position = "relative";
  return style;
}

function flexStyle(node: Json, parentLayout: string | null): CSSProperties {
  const type = node.type;
  const defaultFlex = parentLayout === "horizontal" || parentLayout === "baseline" ? (type === "separator" || type === "spacer" ? 0 : 1) : 0;
  const flex = typeof node.flex === "number" ? node.flex : defaultFlex;
  if (parentLayout === "horizontal" || parentLayout === "baseline") {
    return flex > 0 ? { flex: `${flex} 1 0px`, minWidth: 0 } : { flex: "0 0 auto" };
  }
  return flex > 0 ? { flexGrow: flex, flexShrink: 0 } : { flex: "0 0 auto" };
}

function gravity(v: unknown): CSSProperties["alignSelf"] | undefined {
  return v === "center" ? "center" : v === "bottom" ? "flex-end" : v === "top" ? "flex-start" : undefined;
}

function renderComponent(node: unknown, parentLayout: string | null, ctx: Ctx, key: string | number, marginStyle?: CSSProperties): ReactNode {
  if (!node || typeof node !== "object") return null;
  const n = node as Json;
  const sel = selectable(n, ctx);
  const base: CSSProperties = { ...flexStyle(n, parentLayout), ...positionStyle(n), ...marginStyle };
  const title = describeAction(n.action);

  switch (n.type) {
    case "box": {
      const layout = (n.layout as string) ?? "vertical";
      const contents = Array.isArray(n.contents) ? (n.contents as Json[]) : [];
      const horizontal = layout !== "vertical";
      const bg = n.background as Json | undefined;
      const style: CSSProperties = {
        ...base,
        display: "flex",
        flexDirection: horizontal ? "row" : "column",
        alignItems: layout === "baseline" ? "baseline" : (n.alignItems as CSSProperties["alignItems"]) ?? (horizontal ? "stretch" : "stretch"),
        justifyContent: (n.justifyContent as CSSProperties["justifyContent"]) ?? undefined,
        backgroundColor: color(n.backgroundColor),
        borderColor: color(n.borderColor),
        borderStyle: n.borderWidth || n.borderColor ? "solid" : undefined,
        borderWidth: n.borderWidth ? px(n.borderWidth, BORDER_WIDTH) : n.borderColor ? "1px" : undefined,
        borderRadius: px(n.cornerRadius, CORNER),
        width: px(n.width, {}),
        maxWidth: px(n.maxWidth, {}),
        height: px(n.height, {}),
        maxHeight: px(n.maxHeight, {}),
        padding: px(n.paddingAll, SPACING),
        paddingTop: px(n.paddingTop, SPACING),
        paddingBottom: px(n.paddingBottom, SPACING),
        paddingLeft: px(n.paddingStart, SPACING),
        paddingRight: px(n.paddingEnd, SPACING),
        overflow: "hidden",
        backgroundImage:
          bg?.type === "linearGradient"
            ? `linear-gradient(${String(bg.angle ?? "0deg")}, ${color(bg.startColor) ?? "#fff"} 0%, ${
                color(bg.centerColor) ? `${color(bg.centerColor)} ${String(bg.centerPosition ?? "50%")},` : ""
              } ${color(bg.endColor) ?? "#fff"} 100%)`
            : undefined,
        position: n.position === "absolute" ? "absolute" : "relative",
      };
      const spacing = px(n.spacing, SPACING);
      return (
        <div key={key} style={style} title={title} {...sel}>
          {contents.length === 0 && ctx.onSelect ? (
            <div className="flex min-h-8 flex-1 items-center justify-center border border-dashed border-gray-300 text-[10px] text-gray-400">
              box ว่าง
            </div>
          ) : (
            contents.map((child, i) => {
              const m = child && typeof child === "object" ? px((child as Json).margin, SPACING) : undefined;
              const gap = i === 0 ? undefined : (m ?? spacing);
              const ms: CSSProperties | undefined = gap ? (horizontal ? { marginLeft: gap } : { marginTop: gap }) : undefined;
              return renderComponent(child, layout, ctx, i, ms);
            })
          )}
        </div>
      );
    }
    case "text": {
      const size = TEXT_SIZE[(n.size as string) ?? "md"] ?? (typeof n.size === "string" ? parseFloat(n.size) : 16);
      const wrap = n.wrap === true;
      const maxLines = typeof n.maxLines === "number" && n.maxLines > 0 ? n.maxLines : undefined;
      const style: CSSProperties = {
        ...base,
        fontSize: `${size}px`,
        lineHeight: typeof n.lineSpacing === "string" ? `calc(1.4em + ${n.lineSpacing})` : 1.4,
        fontWeight: n.weight === "bold" ? 700 : 400,
        color: color(n.color) ?? "#111111",
        textAlign: n.align === "center" ? "center" : n.align === "end" ? "right" : "left",
        alignSelf: gravity(n.gravity),
        fontStyle: n.style === "italic" ? "italic" : undefined,
        textDecoration: n.decoration === "underline" ? "underline" : n.decoration === "line-through" ? "line-through" : undefined,
        whiteSpace: wrap ? "pre-wrap" : "nowrap",
        overflow: "hidden",
        textOverflow: wrap ? undefined : "ellipsis",
        wordBreak: wrap ? "break-word" : undefined,
        ...(maxLines && wrap ? { display: "-webkit-box", WebkitLineClamp: maxLines, WebkitBoxOrient: "vertical" as const } : {}),
      };
      const spans = Array.isArray(n.contents) ? (n.contents as Json[]) : null;
      return (
        <div key={key} style={style} title={title} {...sel}>
          {spans && spans.length
            ? spans.map((s, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: s.size ? `${TEXT_SIZE[s.size as string] ?? size}px` : undefined,
                    color: color(s.color),
                    fontWeight: s.weight === "bold" ? 700 : undefined,
                    fontStyle: s.style === "italic" ? "italic" : undefined,
                    textDecoration: s.decoration === "underline" ? "underline" : s.decoration === "line-through" ? "line-through" : undefined,
                  }}
                >
                  {String(s.text ?? "")}
                </span>
              ))
            : String(n.text ?? "")}
        </div>
      );
    }
    case "image": {
      const url = safeImageUrl(n.url);
      const width = IMAGE_SIZE[(n.size as string) ?? "md"] ?? (typeof n.size === "string" ? n.size : "100px");
      const [w, h] = typeof n.aspectRatio === "string" ? n.aspectRatio.split(":").map(Number) : [1, 1];
      const align = n.align === "start" ? "flex-start" : n.align === "end" ? "flex-end" : "center";
      return (
        <div key={key} style={{ ...base, display: "flex", justifyContent: align, alignSelf: gravity(n.gravity) }} title={title} {...sel}>
          <div
            style={{
              width,
              maxWidth: "100%",
              aspectRatio: `${w || 1} / ${h || 1}`,
              backgroundColor: color(n.backgroundColor) ?? "#f3f4f6",
              overflow: "hidden",
            }}
          >
            {url ? (
              <img
                src={url}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{ width: "100%", height: "100%", objectFit: n.aspectMode === "cover" ? "cover" : "contain" }}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-gray-400">
                <ImageOff className="size-5" />
              </div>
            )}
          </div>
        </div>
      );
    }
    case "icon": {
      const url = safeImageUrl(n.url);
      const size = TEXT_SIZE[(n.size as string) ?? "md"] ?? 16;
      return (
        <span key={key} style={{ ...base, flex: "0 0 auto", display: "inline-flex" }} {...sel}>
          {url ? <img src={url} alt="" style={{ height: size, width: "auto" }} referrerPolicy="no-referrer" /> : <span style={{ width: size, height: size }} className="bg-gray-200" />}
        </span>
      );
    }
    case "button": {
      const action = (n.action ?? {}) as Json;
      const style = (n.style as string) ?? "link";
      const c = color(n.color);
      const bg = style === "primary" ? (c ?? "#17c950") : style === "secondary" ? (c ?? "#dcdfe5") : "transparent";
      const fg = style === "primary" ? "#ffffff" : style === "secondary" ? "#111111" : (c ?? "#42659a");
      return (
        <div
          key={key}
          style={{
            ...base,
            alignSelf: gravity(n.gravity),
            height: n.height === "sm" ? 40 : 52,
            backgroundColor: bg,
            color: fg,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 8px",
            fontSize: 16,
            fontWeight: style === "link" ? 400 : 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={describeAction(action)}
          {...sel}
        >
          <span className="truncate">{String(action.label ?? "ปุ่ม")}</span>
        </div>
      );
    }
    case "separator": {
      const horizontal = parentLayout === "horizontal" || parentLayout === "baseline";
      return (
        <div
          key={key}
          style={{
            ...marginStyle,
            flex: "0 0 auto",
            alignSelf: "stretch",
            backgroundColor: color(n.color) ?? "#d4d6da",
            ...(horizontal ? { width: 1 } : { height: 1 }),
          }}
          {...sel}
        />
      );
    }
    case "spacer": {
      const size = SPACER[(n.size as string) ?? "md"] ?? 12;
      const horizontal = parentLayout === "horizontal" || parentLayout === "baseline";
      return <div key={key} style={{ flex: "0 0 auto", ...(horizontal ? { width: size } : { height: size }) }} {...sel} />;
    }
    case "filler":
      return <div key={key} style={{ flex: `${typeof n.flex === "number" ? n.flex : 1} 1 0px` }} {...sel} />;
    case "video": {
      const preview = safeImageUrl(n.previewUrl);
      return (
        <div key={key} className="relative flex aspect-video w-full items-center justify-center bg-black/80" {...sel}>
          {preview && <img src={preview} alt="" className="absolute inset-0 size-full object-cover opacity-80" referrerPolicy="no-referrer" />}
          <Play className="relative size-10 text-white" />
        </div>
      );
    }
    default:
      return (
        <div key={key} className="text-xs text-red-500">
          [{String(n.type)}]
        </div>
      );
  }
}

const BLOCK_PADDING: Record<string, string> = { header: "20px", body: "20px", footer: "10px" };

function Bubble({ bubble, ctx }: { bubble: Json; ctx: Ctx }) {
  const width = BUBBLE_WIDTH[(bubble.size as string) ?? "mega"] ?? 300;
  const styles = (bubble.styles ?? {}) as Record<string, Json>;
  const blocks = ["header", "hero", "body", "footer"].filter((b) => bubble[b]);
  const sel = selectable(bubble, ctx);
  return (
    <div
      dir={bubble.direction === "rtl" ? "rtl" : "ltr"}
      style={{ width, maxWidth: "100%" }}
      title={describeAction(bubble.action)}
      {...sel}
      className={cn("flex shrink-0 flex-col overflow-hidden rounded-[17px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]", sel.className)}
    >
      {blocks.map((block, i) => {
        const st = styles[block] ?? {};
        const node = bubble[block] as Json;
        const isBox = node?.type === "box";
        const padding = isBox && node.paddingAll === undefined && block !== "hero" ? BLOCK_PADDING[block] : undefined;
        return (
          <div
            key={block}
            style={{
              backgroundColor: color(st.backgroundColor),
              borderTop: i > 0 && st.separator ? `1px solid ${color(st.separatorColor) ?? "#e5e7eb"}` : undefined,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {renderComponent(isBox && padding ? { ...node, paddingAll: padding } : node, null, ctx, block)}
          </div>
        );
      })}
    </div>
  );
}

export function FlexPreview({
  contents,
  selectedId,
  onSelect,
  className,
}: {
  contents: unknown;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const ctx: Ctx = { selectedId, onSelect };
  if (!contents || typeof contents !== "object") {
    return <p className="text-sm text-muted-foreground">ไม่มีข้อมูล Flex Message</p>;
  }
  const c = contents as Json;
  if (c.type === "carousel") {
    const bubbles = Array.isArray(c.contents) ? (c.contents as Json[]) : [];
    return (
      <div className={cn("thin-scrollbar flex items-start gap-2.5 overflow-x-auto pb-2", className)}>
        {bubbles.map((b, i) => (
          <Bubble key={i} bubble={b} ctx={ctx} />
        ))}
      </div>
    );
  }
  if (c.type === "bubble") {
    return (
      <div className={className}>
        <Bubble bubble={c} ctx={ctx} />
      </div>
    );
  }
  return <p className="text-sm text-destructive">รูปแบบ Flex Message ไม่ถูกต้อง</p>;
}

/** พื้นหลังจำลองหน้าแชท LINE */
export function ChatBackdrop({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl bg-[#8cabd9]/90 p-3 sm:p-4", className)}>{children}</div>;
}
