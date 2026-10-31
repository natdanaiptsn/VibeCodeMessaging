/** แทนค่าตัวแปรใน Flex Message โดยทำงานกับค่า string ทีละ field (ไม่แทนค่าใน JSON ดิบ) */
import { renderTemplate } from "@/lib/templates/variables";

const URI_KEYS = new Set(["uri", "desktop"]);
const SKIP_KEYS = new Set(["type", "layout", "size", "color", "url", "previewUrl", "backgroundColor"]);

export function renderFlexVariables<T>(value: T, values: Partial<Record<string, string>>, key?: string): T {
  if (typeof value === "string") {
    if (key && SKIP_KEYS.has(key)) return value;
    const encode = key && URI_KEYS.has(key) ? encodeURIComponent : undefined;
    return renderTemplate(value, values, encode) as T;
  }
  if (Array.isArray(value)) return value.map((v) => renderFlexVariables(v, values)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = renderFlexVariables(v, values, k);
    return out as T;
  }
  return value;
}
