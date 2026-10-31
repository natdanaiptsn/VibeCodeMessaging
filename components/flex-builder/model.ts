/**
 * โมเดลภายในของ Flex Builder — แปลงไป/กลับจาก LINE Flex JSON
 * แต่ละ component มี id สำหรับการเลือก/ลากวาง (ไม่ถูกส่งไปยัง LINE)
 */

export type NodeKind = "box" | "text" | "image" | "button" | "separator" | "spacer" | "icon" | "filler" | "video";
export type SectionKey = "header" | "hero" | "body" | "footer";
export const SECTIONS: SectionKey[] = ["header", "hero", "body", "footer"];

export type BNode = {
  id: string;
  kind: NodeKind;
  props: Record<string, unknown>;
  children?: BNode[];
};

export type BBubble = {
  id: string;
  props: Record<string, unknown>; // size, direction, styles, action
  header?: BNode;
  hero?: BNode;
  body?: BNode;
  footer?: BNode;
};

export type BuilderDoc = { kind: "bubble" | "carousel"; bubbles: BBubble[] };

let counter = 0;
export function uid(prefix = "n"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export const SAMPLE_IMAGE = "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_1_cafe.png";

export const KIND_LABELS: Record<NodeKind, string> = {
  box: "Box",
  text: "Text",
  image: "Image",
  button: "Button",
  separator: "Separator",
  spacer: "Spacer",
  icon: "Icon",
  filler: "Filler",
  video: "Video",
};

export type PaletteKind = "box-vertical" | "box-horizontal" | "box-baseline" | "text" | "image" | "button" | "separator" | "spacer";

export function createNode(kind: PaletteKind | NodeKind): BNode {
  switch (kind) {
    case "box":
    case "box-vertical":
      return { id: uid(), kind: "box", props: { layout: "vertical", spacing: "sm" }, children: [] };
    case "box-horizontal":
      return { id: uid(), kind: "box", props: { layout: "horizontal", spacing: "sm" }, children: [] };
    case "box-baseline":
      return { id: uid(), kind: "box", props: { layout: "baseline", spacing: "sm" }, children: [] };
    case "text":
      return { id: uid(), kind: "text", props: { text: "ข้อความ", size: "md", wrap: true, color: "#111111" } };
    case "image":
      return { id: uid(), kind: "image", props: { url: SAMPLE_IMAGE, size: "full", aspectRatio: "20:13", aspectMode: "cover" } };
    case "button":
      return {
        id: uid(),
        kind: "button",
        props: { style: "primary", color: "#06C755", height: "sm", action: { type: "uri", label: "ดูรายละเอียด", uri: "https://example.com" } },
      };
    case "separator":
      return { id: uid(), kind: "separator", props: { margin: "md" } };
    case "spacer":
      return { id: uid(), kind: "spacer", props: { size: "md" } };
    default:
      return { id: uid(), kind: kind as NodeKind, props: {} };
  }
}

export function createBubble(): BBubble {
  const body = createNode("box-vertical");
  const title = createNode("text");
  title.props = { text: "หัวข้อ", weight: "bold", size: "xl", wrap: true, color: "#111111" };
  const desc = createNode("text");
  desc.props = { text: "รายละเอียด", size: "sm", color: "#666666", wrap: true };
  body.children = [title, desc];
  return { id: uid("b"), props: { size: "mega" }, body };
}

export function emptyDoc(): BuilderDoc {
  return { kind: "bubble", bubbles: [createBubble()] };
}

/** ชนิดที่ใส่ใน box แต่ละ layout ได้ */
export function canContain(box: BNode, kind: NodeKind): boolean {
  if (box.kind !== "box") return false;
  if (box.props.layout === "baseline") return ["text", "icon", "filler", "spacer"].includes(kind);
  return ["box", "text", "image", "button", "separator", "spacer", "filler"].includes(kind);
}

// ─────────────── JSON conversion ───────────────

function cleanProps(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) continue;
    out[k] = v;
  }
  return out;
}

export function nodeToJson(node: BNode, withIds = false): Record<string, unknown> {
  const json: Record<string, unknown> = { type: node.kind, ...cleanProps(node.props) };
  if (node.kind === "box") json.contents = (node.children ?? []).map((c) => nodeToJson(c, withIds));
  if (withIds) json.__id = node.id;
  return json;
}

export function bubbleToJson(b: BBubble, withIds = false): Record<string, unknown> {
  const json: Record<string, unknown> = { type: "bubble", ...cleanProps(b.props) };
  for (const s of SECTIONS) if (b[s]) json[s] = nodeToJson(b[s]!, withIds);
  if (withIds) json.__id = b.id;
  return json;
}

export function docToJson(doc: BuilderDoc, withIds = false): Record<string, unknown> {
  if (doc.kind === "carousel") return { type: "carousel", contents: doc.bubbles.map((b) => bubbleToJson(b, withIds)) };
  return bubbleToJson(doc.bubbles[0] ?? createBubble(), withIds);
}

function nodeFromJson(json: unknown): BNode | undefined {
  if (!json || typeof json !== "object") return undefined;
  const { type, contents, __id: _id, ...props } = json as Record<string, unknown>;
  const kind = String(type) as NodeKind;
  if (kind === "box") {
    return {
      id: uid(),
      kind,
      props,
      children: Array.isArray(contents) ? (contents.map(nodeFromJson).filter(Boolean) as BNode[]) : [],
    };
  }
  // text อาจมี contents (span) — เก็บไว้ใน props
  return { id: uid(), kind, props: contents !== undefined ? { ...props, contents } : props };
}

function bubbleFromJson(json: unknown): BBubble {
  const { type: _t, header, hero, body, footer, __id: _id, ...props } = (json ?? {}) as Record<string, unknown>;
  return {
    id: uid("b"),
    props,
    header: nodeFromJson(header),
    hero: nodeFromJson(hero),
    body: nodeFromJson(body),
    footer: nodeFromJson(footer),
  };
}

export function docFromJson(json: unknown): BuilderDoc {
  const c = (json ?? {}) as Record<string, unknown>;
  if (c.type === "carousel") {
    const bubbles = Array.isArray(c.contents) ? c.contents.map(bubbleFromJson) : [];
    return { kind: "carousel", bubbles: bubbles.length ? bubbles : [createBubble()] };
  }
  if (c.type === "bubble") return { kind: "bubble", bubbles: [bubbleFromJson(c)] };
  throw new Error('JSON ต้องเป็น Flex Container ที่มี type "bubble" หรือ "carousel"');
}

// ─────────────── Tree operations (immutable via structuredClone) ───────────────

export type Located = {
  node: BNode;
  parent: BNode | null;
  index: number;
  bubbleIndex: number;
  section: SectionKey;
};

export function locate(doc: BuilderDoc, id: string): Located | null {
  for (const [bi, bubble] of doc.bubbles.entries()) {
    for (const section of SECTIONS) {
      const root = bubble[section];
      if (!root) continue;
      if (root.id === id) return { node: root, parent: null, index: 0, bubbleIndex: bi, section };
      const stack: BNode[] = [root];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const [i, child] of (cur.children ?? []).entries()) {
          if (child.id === id) return { node: child, parent: cur, index: i, bubbleIndex: bi, section };
          if (child.children) stack.push(child);
        }
      }
    }
  }
  return null;
}

export function isDescendant(node: BNode, id: string): boolean {
  if (node.id === id) return true;
  return (node.children ?? []).some((c) => isDescendant(c, id));
}

function regenerateIds(node: BNode): BNode {
  return { ...node, id: uid(), props: structuredClone(node.props), children: node.children?.map(regenerateIds) };
}

export function updateProps(doc: BuilderDoc, id: string, patch: Record<string, unknown>): BuilderDoc {
  const next = structuredClone(doc);
  const loc = locate(next, id);
  if (!loc) return doc;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") delete loc.node.props[k];
    else loc.node.props[k] = v;
  }
  return next;
}

export function removeNode(doc: BuilderDoc, id: string): BuilderDoc {
  const next = structuredClone(doc);
  const loc = locate(next, id);
  if (!loc) return doc;
  if (!loc.parent) delete next.bubbles[loc.bubbleIndex]![loc.section];
  else loc.parent.children!.splice(loc.index, 1);
  return next;
}

export function duplicateNode(doc: BuilderDoc, id: string): { doc: BuilderDoc; newId: string | null } {
  const next = structuredClone(doc);
  const loc = locate(next, id);
  if (!loc || !loc.parent) return { doc, newId: null };
  const copy = regenerateIds(loc.node);
  loc.parent.children!.splice(loc.index + 1, 0, copy);
  return { doc: next, newId: copy.id };
}

export function insertNode(doc: BuilderDoc, parentId: string, node: BNode, index?: number): BuilderDoc | null {
  const next = structuredClone(doc);
  const loc = locate(next, parentId);
  if (!loc || loc.node.kind !== "box" || !canContain(loc.node, node.kind)) return null;
  const children = (loc.node.children ??= []);
  children.splice(index ?? children.length, 0, node);
  return next;
}

export function moveNode(doc: BuilderDoc, id: string, parentId: string, index?: number): BuilderDoc | null {
  const source = locate(doc, id);
  const target = locate(doc, parentId);
  if (!source || !source.parent || !target) return null;
  if (isDescendant(source.node, parentId)) return null;
  if (!canContain(target.node, source.node.kind)) return null;
  let next = structuredClone(doc);
  const s = locate(next, id)!;
  s.parent!.children!.splice(s.index, 1);
  const t = locate(next, parentId)!;
  let insertAt = index ?? t.node.children!.length;
  if (s.parent!.id === t.node.id && index !== undefined && s.index < index) insertAt -= 1;
  t.node.children!.splice(Math.max(0, insertAt), 0, s.node);
  next = { ...next };
  return next;
}

export function moveSibling(doc: BuilderDoc, id: string, delta: -1 | 1): BuilderDoc {
  const next = structuredClone(doc);
  const loc = locate(next, id);
  if (!loc || !loc.parent) return doc;
  const arr = loc.parent.children!;
  const j = loc.index + delta;
  if (j < 0 || j >= arr.length) return doc;
  [arr[loc.index], arr[j]] = [arr[j]!, arr[loc.index]!];
  return next;
}

export function setSection(doc: BuilderDoc, bubbleIndex: number, section: SectionKey, node: BNode | undefined): BuilderDoc {
  const next = structuredClone(doc);
  const b = next.bubbles[bubbleIndex];
  if (!b) return doc;
  if (node) b[section] = node;
  else delete b[section];
  return next;
}

export function updateBubbleProps(doc: BuilderDoc, bubbleIndex: number, patch: Record<string, unknown>): BuilderDoc {
  const next = structuredClone(doc);
  const b = next.bubbles[bubbleIndex];
  if (!b) return doc;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") delete b.props[k];
    else b.props[k] = v;
  }
  return next;
}

export function describeNode(node: BNode): string {
  const p = node.props;
  switch (node.kind) {
    case "box":
      return `Box (${String(p.layout ?? "vertical")})`;
    case "text":
      return typeof p.text === "string" && p.text ? p.text : "Text";
    case "button":
      return `Button: ${String((p.action as { label?: string } | undefined)?.label ?? "")}`;
    case "image":
      return "Image";
    default:
      return KIND_LABELS[node.kind] ?? node.kind;
  }
}
