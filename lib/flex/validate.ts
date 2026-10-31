/**
 * ตรวจสอบ Flex Message ตาม LINE Flex Message Specification ก่อนส่งไปยัง LINE
 * ใช้ได้ทั้งฝั่ง Client (Flex Builder) และ Server (API / ก่อนส่งข้อความ)
 */
import { LINE_LIMITS } from "@/lib/line/limits";
import { checkActionUri, checkMediaUrl } from "@/lib/flex/url-safety";

export type FlexIssue = { path: string; message: string };
export type FlexValidationResult = {
  valid: boolean;
  errors: FlexIssue[];
  warnings: FlexIssue[];
  sizeBytes: number;
};

const SPACING = ["none", "xs", "sm", "md", "lg", "xl", "xxl"] as const;
const TEXT_SIZES = ["xxs", "xs", "sm", "md", "lg", "xl", "xxl", "3xl", "4xl", "5xl"] as const;
const IMAGE_SIZES = [...TEXT_SIZES, "full"] as const;
const BORDER_WIDTHS = ["none", "light", "normal", "medium", "semi-bold", "bold"] as const;
const BUBBLE_SIZES = ["nano", "micro", "deca", "hecto", "kilo", "mega", "giga"] as const;

const COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const PX_RE = /^\d+(\.\d+)?px$/;
const PERCENT_RE = /^\d+(\.\d+)?%$/;
const ANGLE_RE = /^-?\d+(\.\d+)?deg$/;

const POSITION_KEYS = ["position", "offsetTop", "offsetBottom", "offsetStart", "offsetEnd"];

const ALLOWED_KEYS: Record<string, string[]> = {
  bubble: ["type", "size", "direction", "header", "hero", "body", "footer", "styles", "action"],
  carousel: ["type", "contents"],
  box: [
    "type", "layout", "contents", "backgroundColor", "borderColor", "borderWidth", "cornerRadius", "width",
    "maxWidth", "height", "maxHeight", "flex", "spacing", "margin", "paddingAll", "paddingTop", "paddingBottom",
    "paddingStart", "paddingEnd", "justifyContent", "alignItems", "background", "action", ...POSITION_KEYS,
  ],
  text: [
    "type", "text", "contents", "size", "weight", "color", "align", "gravity", "wrap", "lineSpacing", "maxLines",
    "flex", "margin", "style", "decoration", "adjustMode", "scaling", "action", ...POSITION_KEYS,
  ],
  span: ["type", "text", "size", "color", "weight", "style", "decoration"],
  image: [
    "type", "url", "size", "aspectRatio", "aspectMode", "backgroundColor", "align", "gravity", "flex", "margin",
    "animated", "action", ...POSITION_KEYS,
  ],
  icon: ["type", "url", "size", "aspectRatio", "margin", "scaling", ...POSITION_KEYS],
  button: [
    "type", "action", "style", "color", "height", "gravity", "flex", "margin", "adjustMode", "scaling", ...POSITION_KEYS,
  ],
  separator: ["type", "margin", "color"],
  spacer: ["type", "size"],
  filler: ["type", "flex"],
  video: ["type", "url", "previewUrl", "altContent", "aspectRatio", "action"],
};

type Ctx = { errors: FlexIssue[]; warnings: FlexIssue[] };

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function err(ctx: Ctx, path: string, message: string) {
  ctx.errors.push({ path, message });
}
function warn(ctx: Ctx, path: string, message: string) {
  ctx.warnings.push({ path, message });
}

function checkKeys(ctx: Ctx, path: string, node: Record<string, unknown>, type: string) {
  const allowed = ALLOWED_KEYS[type];
  if (!allowed) return;
  for (const key of Object.keys(node)) {
    if (!allowed.includes(key)) err(ctx, `${path}.${key}`, `ไม่รองรับ property "${key}" ใน ${type}`);
  }
}

function checkEnum(ctx: Ctx, path: string, value: unknown, allowed: readonly string[], label: string) {
  if (value === undefined) return;
  if (typeof value !== "string" || !allowed.includes(value)) {
    err(ctx, path, `${label} ต้องเป็นค่าใดค่าหนึ่ง: ${allowed.join(", ")}`);
  }
}

function checkColor(ctx: Ctx, path: string, value: unknown) {
  if (value === undefined) return;
  if (typeof value !== "string" || !COLOR_RE.test(value)) err(ctx, path, "สีต้องอยู่ในรูปแบบ #RRGGBB หรือ #RRGGBBAA");
}

function checkSpacing(ctx: Ctx, path: string, value: unknown, allowPercent = false) {
  if (value === undefined) return;
  const ok =
    typeof value === "string" &&
    ((SPACING as readonly string[]).includes(value) || PX_RE.test(value) || (allowPercent && PERCENT_RE.test(value)));
  if (!ok) err(ctx, path, `ค่าต้องเป็น ${SPACING.join("/")} หรือหน่วย px${allowPercent ? " / %" : ""}`);
}

function checkLength(ctx: Ctx, path: string, value: unknown) {
  if (value === undefined) return;
  if (typeof value !== "string" || !(PX_RE.test(value) || PERCENT_RE.test(value))) {
    err(ctx, path, "ค่าต้องอยู่ในหน่วย px หรือ % เช่น 100px, 50%");
  }
}

function checkFlex(ctx: Ctx, path: string, value: unknown) {
  if (value === undefined) return;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) err(ctx, path, "flex ต้องเป็นจำนวนเต็มตั้งแต่ 0");
}

function checkBool(ctx: Ctx, path: string, value: unknown) {
  if (value === undefined) return;
  if (typeof value !== "boolean") err(ctx, path, "ต้องเป็น true หรือ false");
}

function checkAspectRatio(ctx: Ctx, path: string, value: unknown) {
  if (value === undefined) return;
  const m = typeof value === "string" ? value.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/) : null;
  if (!m) return err(ctx, path, "aspectRatio ต้องอยู่ในรูปแบบ กว้าง:สูง เช่น 20:13");
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (w < 1 || h < 1 || w > 100000 || h > 100000) return err(ctx, path, "aspectRatio ต้องมีค่าระหว่าง 1 ถึง 100000");
  if (h > w * 3) err(ctx, path, "ความสูงของ aspectRatio ต้องไม่เกิน 3 เท่าของความกว้าง");
}

function checkPositioning(ctx: Ctx, path: string, node: Record<string, unknown>) {
  checkEnum(ctx, `${path}.position`, node.position, ["relative", "absolute"], "position");
  for (const key of ["offsetTop", "offsetBottom", "offsetStart", "offsetEnd"]) {
    checkSpacing(ctx, `${path}.${key}`, node[key], true);
  }
}

function checkText(ctx: Ctx, path: string, value: unknown, label: string, max: number, required = true) {
  if (value === undefined || value === null) {
    if (required) err(ctx, path, `ต้องระบุ ${label}`);
    return;
  }
  if (typeof value !== "string") return err(ctx, path, `${label} ต้องเป็นข้อความ`);
  if (required && value.trim().length === 0) return err(ctx, path, `${label} ต้องไม่เป็นค่าว่าง`);
  if ([...value].length > max) err(ctx, path, `${label} ยาวเกิน ${max} ตัวอักษร`);
}

export function validateAction(ctx: Ctx, path: string, action: unknown, labelRequired = false) {
  if (!isObj(action)) return err(ctx, path, "action ไม่ถูกต้อง");
  const type = action.type;
  if (labelRequired || action.label !== undefined) {
    checkText(ctx, `${path}.label`, action.label, "label", LINE_LIMITS.ACTION_LABEL_MAX, labelRequired);
    if (typeof action.label === "string" && [...action.label].length > 20) {
      warn(ctx, `${path}.label`, "label ที่ยาวกว่า 20 ตัวอักษรอาจถูกตัดในบางอุปกรณ์");
    }
  }
  switch (type) {
    case "uri": {
      const allowed = ["type", "label", "uri", "altUri"];
      for (const k of Object.keys(action)) if (!allowed.includes(k)) err(ctx, `${path}.${k}`, `ไม่รองรับ property "${k}" ใน uri action`);
      const r = checkActionUri(String(action.uri ?? ""), LINE_LIMITS.ACTION_URI_MAX);
      if (!r.ok) err(ctx, `${path}.uri`, r.reason);
      if (action.altUri !== undefined) {
        if (!isObj(action.altUri)) err(ctx, `${path}.altUri`, "altUri ไม่ถูกต้อง");
        else {
          const r2 = checkActionUri(String(action.altUri.desktop ?? ""), LINE_LIMITS.ACTION_URI_MAX);
          if (!r2.ok) err(ctx, `${path}.altUri.desktop`, r2.reason);
        }
      }
      break;
    }
    case "message": {
      const allowed = ["type", "label", "text"];
      for (const k of Object.keys(action)) if (!allowed.includes(k)) err(ctx, `${path}.${k}`, `ไม่รองรับ property "${k}" ใน message action`);
      checkText(ctx, `${path}.text`, action.text, "ข้อความ", LINE_LIMITS.MESSAGE_ACTION_TEXT_MAX);
      break;
    }
    case "postback": {
      const allowed = ["type", "label", "data", "displayText", "inputOption", "fillInText"];
      for (const k of Object.keys(action)) if (!allowed.includes(k)) err(ctx, `${path}.${k}`, `ไม่รองรับ property "${k}" ใน postback action`);
      checkText(ctx, `${path}.data`, action.data, "Postback data", LINE_LIMITS.POSTBACK_DATA_MAX);
      if (action.displayText !== undefined) {
        checkText(ctx, `${path}.displayText`, action.displayText, "displayText", LINE_LIMITS.POSTBACK_DISPLAY_TEXT_MAX);
      }
      checkEnum(ctx, `${path}.inputOption`, action.inputOption, ["closeRichMenu", "openRichMenu", "openKeyboard", "openVoice"], "inputOption");
      break;
    }
    case "datetimepicker": {
      checkText(ctx, `${path}.data`, action.data, "Postback data", LINE_LIMITS.POSTBACK_DATA_MAX);
      checkEnum(ctx, `${path}.mode`, action.mode, ["date", "time", "datetime"], "mode");
      if (action.mode === undefined) err(ctx, `${path}.mode`, "ต้องระบุ mode");
      break;
    }
    case "clipboard": {
      checkText(ctx, `${path}.clipboardText`, action.clipboardText, "clipboardText", LINE_LIMITS.CLIPBOARD_TEXT_MAX);
      break;
    }
    default:
      err(ctx, `${path}.type`, "ประเภท action ต้องเป็น uri, message, postback, datetimepicker หรือ clipboard");
  }
}

function validateSpan(ctx: Ctx, path: string, node: unknown) {
  if (!isObj(node) || node.type !== "span") return err(ctx, path, "contents ของ text ต้องเป็น span เท่านั้น");
  checkKeys(ctx, path, node, "span");
  checkText(ctx, `${path}.text`, node.text, "ข้อความ span", 5000);
  checkEnum(ctx, `${path}.size`, node.size, TEXT_SIZES, "size");
  checkColor(ctx, `${path}.color`, node.color);
  checkEnum(ctx, `${path}.weight`, node.weight, ["regular", "bold"], "weight");
  checkEnum(ctx, `${path}.style`, node.style, ["normal", "italic"], "style");
  checkEnum(ctx, `${path}.decoration`, node.decoration, ["none", "underline", "line-through"], "decoration");
}

function checkTextSize(ctx: Ctx, path: string, value: unknown) {
  if (value === undefined) return;
  if (typeof value !== "string" || !((TEXT_SIZES as readonly string[]).includes(value) || PX_RE.test(value))) {
    err(ctx, path, `size ต้องเป็น ${TEXT_SIZES.join("/")} หรือหน่วย px`);
  }
}

function validateComponent(ctx: Ctx, path: string, node: unknown, parentLayout: string | null) {
  if (!isObj(node)) return err(ctx, path, "component ไม่ถูกต้อง");
  const type = node.type;
  if (typeof type !== "string" || !ALLOWED_KEYS[type] || type === "bubble" || type === "carousel" || type === "span") {
    return err(ctx, `${path}.type`, `ไม่รองรับ component ประเภท "${String(type)}"`);
  }
  if (parentLayout === "baseline" && !["text", "icon", "filler", "spacer"].includes(type)) {
    err(ctx, path, `box แบบ baseline ใส่ได้เฉพาะ text, icon, filler, spacer (พบ ${type})`);
  }
  if (parentLayout && parentLayout !== "baseline" && type === "icon") {
    err(ctx, path, "icon ใช้ได้เฉพาะใน box แบบ baseline");
  }
  if (parentLayout && type === "video") err(ctx, path, "video ใช้ได้เฉพาะใน hero ของ bubble");
  checkKeys(ctx, path, node, type);

  switch (type) {
    case "box": {
      checkEnum(ctx, `${path}.layout`, node.layout, ["horizontal", "vertical", "baseline"], "layout");
      if (node.layout === undefined) err(ctx, `${path}.layout`, "ต้องระบุ layout ของ box");
      if (!Array.isArray(node.contents)) {
        err(ctx, `${path}.contents`, "box ต้องมี contents เป็น array");
      } else {
        node.contents.forEach((child, i) =>
          validateComponent(ctx, `${path}.contents[${i}]`, child, typeof node.layout === "string" ? node.layout : "vertical"),
        );
      }
      checkColor(ctx, `${path}.backgroundColor`, node.backgroundColor);
      checkColor(ctx, `${path}.borderColor`, node.borderColor);
      if (node.borderWidth !== undefined) {
        const v = node.borderWidth;
        if (typeof v !== "string" || !((BORDER_WIDTHS as readonly string[]).includes(v) || PX_RE.test(v))) {
          err(ctx, `${path}.borderWidth`, `borderWidth ต้องเป็น ${BORDER_WIDTHS.join("/")} หรือหน่วย px`);
        }
      }
      if (node.cornerRadius !== undefined) {
        const v = node.cornerRadius;
        if (typeof v !== "string" || !((SPACING as readonly string[]).includes(v) || PX_RE.test(v))) {
          err(ctx, `${path}.cornerRadius`, `cornerRadius ต้องเป็น ${SPACING.join("/")} หรือหน่วย px`);
        }
      }
      for (const k of ["width", "maxWidth", "height", "maxHeight"]) checkLength(ctx, `${path}.${k}`, node[k]);
      checkFlex(ctx, `${path}.flex`, node.flex);
      checkSpacing(ctx, `${path}.spacing`, node.spacing);
      checkSpacing(ctx, `${path}.margin`, node.margin);
      for (const k of ["paddingAll", "paddingTop", "paddingBottom", "paddingStart", "paddingEnd"]) {
        checkSpacing(ctx, `${path}.${k}`, node[k], true);
      }
      checkEnum(ctx, `${path}.justifyContent`, node.justifyContent, ["center", "flex-start", "flex-end", "space-between", "space-around", "space-evenly"], "justifyContent");
      checkEnum(ctx, `${path}.alignItems`, node.alignItems, ["center", "flex-start", "flex-end"], "alignItems");
      if (node.background !== undefined) {
        const bg = node.background;
        if (!isObj(bg) || bg.type !== "linearGradient") err(ctx, `${path}.background`, "background รองรับเฉพาะ linearGradient");
        else {
          if (typeof bg.angle !== "string" || !ANGLE_RE.test(bg.angle)) err(ctx, `${path}.background.angle`, "angle ต้องอยู่ในรูปแบบ เช่น 90deg");
          checkColor(ctx, `${path}.background.startColor`, bg.startColor ?? "");
          checkColor(ctx, `${path}.background.endColor`, bg.endColor ?? "");
          checkColor(ctx, `${path}.background.centerColor`, bg.centerColor);
          if (bg.centerPosition !== undefined && (typeof bg.centerPosition !== "string" || !PERCENT_RE.test(bg.centerPosition))) {
            err(ctx, `${path}.background.centerPosition`, "centerPosition ต้องเป็นหน่วย %");
          }
        }
      }
      if (node.action !== undefined) validateAction(ctx, `${path}.action`, node.action);
      checkPositioning(ctx, path, node);
      break;
    }
    case "text": {
      const hasSpans = Array.isArray(node.contents) && node.contents.length > 0;
      if (!hasSpans) checkText(ctx, `${path}.text`, node.text, "ข้อความ", 5000);
      else (node.contents as unknown[]).forEach((s, i) => validateSpan(ctx, `${path}.contents[${i}]`, s));
      checkTextSize(ctx, `${path}.size`, node.size);
      checkEnum(ctx, `${path}.weight`, node.weight, ["regular", "bold"], "weight");
      checkColor(ctx, `${path}.color`, node.color);
      checkEnum(ctx, `${path}.align`, node.align, ["start", "end", "center"], "align");
      checkEnum(ctx, `${path}.gravity`, node.gravity, ["top", "bottom", "center"], "gravity");
      checkBool(ctx, `${path}.wrap`, node.wrap);
      checkBool(ctx, `${path}.scaling`, node.scaling);
      if (node.lineSpacing !== undefined && (typeof node.lineSpacing !== "string" || !PX_RE.test(node.lineSpacing))) {
        err(ctx, `${path}.lineSpacing`, "lineSpacing ต้องเป็นหน่วย px");
      }
      if (node.maxLines !== undefined && (typeof node.maxLines !== "number" || !Number.isInteger(node.maxLines) || node.maxLines < 0)) {
        err(ctx, `${path}.maxLines`, "maxLines ต้องเป็นจำนวนเต็มตั้งแต่ 0");
      }
      checkFlex(ctx, `${path}.flex`, node.flex);
      checkSpacing(ctx, `${path}.margin`, node.margin);
      checkEnum(ctx, `${path}.style`, node.style, ["normal", "italic"], "style");
      checkEnum(ctx, `${path}.decoration`, node.decoration, ["none", "underline", "line-through"], "decoration");
      checkEnum(ctx, `${path}.adjustMode`, node.adjustMode, ["shrink-to-fit"], "adjustMode");
      if (node.action !== undefined) validateAction(ctx, `${path}.action`, node.action);
      checkPositioning(ctx, path, node);
      break;
    }
    case "image":
    case "icon": {
      const r = checkMediaUrl(String(node.url ?? ""), LINE_LIMITS.IMAGE_URL_MAX);
      if (!r.ok) err(ctx, `${path}.url`, r.reason);
      if (node.size !== undefined) {
        const v = node.size;
        const sizes = type === "image" ? IMAGE_SIZES : TEXT_SIZES;
        const ok =
          typeof v === "string" &&
          ((sizes as readonly string[]).includes(v) || PX_RE.test(v) || (type === "image" && PERCENT_RE.test(v)));
        if (!ok) err(ctx, `${path}.size`, `size ต้องเป็น ${sizes.join("/")} หรือหน่วย px${type === "image" ? " / %" : ""}`);
      }
      checkAspectRatio(ctx, `${path}.aspectRatio`, node.aspectRatio);
      checkSpacing(ctx, `${path}.margin`, node.margin);
      checkBool(ctx, `${path}.scaling`, node.scaling);
      if (type === "image") {
        checkEnum(ctx, `${path}.aspectMode`, node.aspectMode, ["fit", "cover"], "aspectMode");
        checkColor(ctx, `${path}.backgroundColor`, node.backgroundColor);
        checkEnum(ctx, `${path}.align`, node.align, ["start", "end", "center"], "align");
        checkEnum(ctx, `${path}.gravity`, node.gravity, ["top", "bottom", "center"], "gravity");
        checkFlex(ctx, `${path}.flex`, node.flex);
        checkBool(ctx, `${path}.animated`, node.animated);
        if (node.action !== undefined) validateAction(ctx, `${path}.action`, node.action);
      }
      checkPositioning(ctx, path, node);
      break;
    }
    case "button": {
      if (node.action === undefined) err(ctx, `${path}.action`, "ปุ่มต้องมี action");
      else validateAction(ctx, `${path}.action`, node.action, true);
      checkEnum(ctx, `${path}.style`, node.style, ["primary", "secondary", "link"], "style");
      checkColor(ctx, `${path}.color`, node.color);
      checkEnum(ctx, `${path}.height`, node.height, ["sm", "md"], "height");
      checkEnum(ctx, `${path}.gravity`, node.gravity, ["top", "bottom", "center"], "gravity");
      checkFlex(ctx, `${path}.flex`, node.flex);
      checkSpacing(ctx, `${path}.margin`, node.margin);
      checkEnum(ctx, `${path}.adjustMode`, node.adjustMode, ["shrink-to-fit"], "adjustMode");
      checkBool(ctx, `${path}.scaling`, node.scaling);
      checkPositioning(ctx, path, node);
      break;
    }
    case "separator":
      checkSpacing(ctx, `${path}.margin`, node.margin);
      checkColor(ctx, `${path}.color`, node.color);
      break;
    case "spacer":
      checkEnum(ctx, `${path}.size`, node.size, SPACING.filter((s) => s !== "none"), "size");
      warn(ctx, path, "LINE แนะนำให้ใช้ margin/spacing แทน spacer (ยังส่งได้ตามปกติ)");
      break;
    case "filler":
      checkFlex(ctx, `${path}.flex`, node.flex);
      break;
    case "video": {
      const r1 = checkMediaUrl(String(node.url ?? ""));
      if (!r1.ok) err(ctx, `${path}.url`, r1.reason);
      const r2 = checkMediaUrl(String(node.previewUrl ?? ""));
      if (!r2.ok) err(ctx, `${path}.previewUrl`, r2.reason);
      if (node.altContent === undefined) err(ctx, `${path}.altContent`, "video ต้องมี altContent");
      else validateComponent(ctx, `${path}.altContent`, node.altContent, null);
      checkAspectRatio(ctx, `${path}.aspectRatio`, node.aspectRatio);
      if (node.action !== undefined) validateAction(ctx, `${path}.action`, node.action);
      break;
    }
  }
}

function validateBlockBox(ctx: Ctx, path: string, node: unknown, label: string) {
  if (!isObj(node) || node.type !== "box") return err(ctx, path, `${label} ต้องเป็น box`);
  validateComponent(ctx, path, node, null);
}

function validateBubble(ctx: Ctx, path: string, node: unknown) {
  if (!isObj(node) || node.type !== "bubble") return err(ctx, path, "ต้องเป็น bubble");
  checkKeys(ctx, path, node, "bubble");
  checkEnum(ctx, `${path}.size`, node.size, BUBBLE_SIZES, "size");
  checkEnum(ctx, `${path}.direction`, node.direction, ["ltr", "rtl"], "direction");
  if (!node.header && !node.hero && !node.body && !node.footer) {
    err(ctx, path, "bubble ต้องมีอย่างน้อยหนึ่งส่วน (header, hero, body หรือ footer)");
  }
  if (node.header !== undefined) validateBlockBox(ctx, `${path}.header`, node.header, "header");
  if (node.body !== undefined) validateBlockBox(ctx, `${path}.body`, node.body, "body");
  if (node.footer !== undefined) validateBlockBox(ctx, `${path}.footer`, node.footer, "footer");
  if (node.hero !== undefined) {
    const hero = node.hero;
    if (!isObj(hero) || !["box", "image", "video"].includes(String(hero.type))) {
      err(ctx, `${path}.hero`, "hero ต้องเป็น box, image หรือ video");
    } else validateComponent(ctx, `${path}.hero`, hero, null);
  }
  if (node.styles !== undefined) {
    if (!isObj(node.styles)) err(ctx, `${path}.styles`, "styles ไม่ถูกต้อง");
    else {
      for (const [block, style] of Object.entries(node.styles)) {
        const p = `${path}.styles.${block}`;
        if (!["header", "hero", "body", "footer"].includes(block)) {
          err(ctx, p, `ไม่รองรับ styles.${block}`);
          continue;
        }
        if (!isObj(style)) {
          err(ctx, p, "style ไม่ถูกต้อง");
          continue;
        }
        for (const k of Object.keys(style)) {
          if (!["backgroundColor", "separator", "separatorColor"].includes(k)) err(ctx, `${p}.${k}`, `ไม่รองรับ property "${k}"`);
        }
        checkColor(ctx, `${p}.backgroundColor`, style.backgroundColor);
        checkBool(ctx, `${p}.separator`, style.separator);
        checkColor(ctx, `${p}.separatorColor`, style.separatorColor);
      }
    }
  }
  if (node.action !== undefined) validateAction(ctx, `${path}.action`, node.action);
}

function byteLength(value: unknown): number {
  const json = JSON.stringify(value) ?? "";
  return new TextEncoder().encode(json).length;
}

/** ตรวจสอบ Flex Container (bubble หรือ carousel) */
export function validateFlexContainer(container: unknown): FlexValidationResult {
  const ctx: Ctx = { errors: [], warnings: [] };
  const sizeBytes = byteLength(container);
  if (!isObj(container)) {
    err(ctx, "contents", "Flex Message ต้องเป็น object");
    return { valid: false, errors: ctx.errors, warnings: ctx.warnings, sizeBytes };
  }
  if (container.type === "bubble") {
    validateBubble(ctx, "contents", container);
    if (sizeBytes > LINE_LIMITS.BUBBLE_MAX_BYTES) {
      err(ctx, "contents", `ขนาด bubble ${(sizeBytes / 1024).toFixed(1)} KB เกินขีดจำกัด 30 KB`);
    }
  } else if (container.type === "carousel") {
    checkKeys(ctx, "contents", container, "carousel");
    if (!Array.isArray(container.contents) || container.contents.length === 0) {
      err(ctx, "contents.contents", "carousel ต้องมี bubble อย่างน้อย 1 รายการ");
    } else {
      if (container.contents.length > LINE_LIMITS.CAROUSEL_MAX_BUBBLES) {
        err(ctx, "contents.contents", `carousel มี bubble ได้ไม่เกิน ${LINE_LIMITS.CAROUSEL_MAX_BUBBLES} รายการ`);
      }
      container.contents.forEach((b, i) => {
        validateBubble(ctx, `contents.contents[${i}]`, b);
        const size = byteLength(b);
        if (size > LINE_LIMITS.BUBBLE_MAX_BYTES) err(ctx, `contents.contents[${i}]`, `bubble ที่ ${i + 1} มีขนาดเกิน 30 KB`);
      });
    }
    if (sizeBytes > LINE_LIMITS.CAROUSEL_MAX_BYTES) {
      err(ctx, "contents", `ขนาด carousel ${(sizeBytes / 1024).toFixed(1)} KB เกินขีดจำกัด 50 KB`);
    }
  } else {
    err(ctx, "contents.type", 'type ต้องเป็น "bubble" หรือ "carousel"');
  }
  return { valid: ctx.errors.length === 0, errors: ctx.errors, warnings: ctx.warnings, sizeBytes };
}

/** ตรวจสอบ Flex Message ทั้งข้อความ (altText + contents) */
export function validateFlexMessage(altText: unknown, contents: unknown): FlexValidationResult {
  const result = validateFlexContainer(contents);
  const errors = [...result.errors];
  if (typeof altText !== "string" || altText.trim().length === 0) {
    errors.unshift({ path: "altText", message: "ต้องระบุข้อความแจ้งเตือน (altText)" });
  } else if ([...altText].length > LINE_LIMITS.ALT_TEXT_MAX_CHARS) {
    errors.unshift({ path: "altText", message: `altText ยาวเกิน ${LINE_LIMITS.ALT_TEXT_MAX_CHARS} ตัวอักษร` });
  }
  return { ...result, errors, valid: errors.length === 0 };
}
