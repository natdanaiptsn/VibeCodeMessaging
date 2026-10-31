import { describe, expect, it } from "vitest";
import { validateFlexContainer, validateFlexMessage } from "@/lib/flex/validate";
import { FLEX_PRESETS } from "@/lib/flex/presets";

const bubble = (body: unknown) => ({ type: "bubble", body });
const box = (contents: unknown[], extra: Record<string, unknown> = {}) => ({ type: "box", layout: "vertical", contents, ...extra });

describe("validateFlexContainer", () => {
  it("accepts all bundled presets", () => {
    for (const p of FLEX_PRESETS) {
      const r = validateFlexMessage(p.altText, p.contents);
      expect(r.errors, p.key).toEqual([]);
    }
  });

  it("requires altText and limits its length", () => {
    const c = bubble(box([{ type: "text", text: "a" }]));
    expect(validateFlexMessage("", c).valid).toBe(false);
    expect(validateFlexMessage("x".repeat(401), c).valid).toBe(false);
  });

  it("rejects invalid colors, unknown properties and bad enums", () => {
    const r = validateFlexContainer(bubble(box([{ type: "text", text: "a", color: "red", foo: 1, size: "huge" }])));
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(["contents.body.contents[0].color", "contents.body.contents[0].foo", "contents.body.contents[0].size"]),
    );
  });

  it("rejects dangerous action URLs and non-HTTPS images", () => {
    const r = validateFlexContainer(
      bubble(
        box([
          { type: "button", action: { type: "uri", label: "x", uri: "javascript:alert(1)" } },
          { type: "image", url: "http://example.com/a.png" },
          { type: "image", url: "https://127.0.0.1/a.png" },
        ]),
      ),
    );
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("requires button action with label and enforces postback limits", () => {
    expect(validateFlexContainer(bubble(box([{ type: "button" }]))).valid).toBe(false);
    const long = validateFlexContainer(bubble(box([{ type: "button", action: { type: "postback", label: "a", data: "x".repeat(301) } }])));
    expect(long.valid).toBe(false);
  });

  it("enforces baseline box children", () => {
    const r = validateFlexContainer(bubble(box([{ type: "box", layout: "baseline", contents: [{ type: "image", url: "https://example.com/a.png" }] }])));
    expect(r.valid).toBe(false);
  });

  it("limits carousel to 12 bubbles and checks size", () => {
    const b = bubble(box([{ type: "text", text: "hi" }]));
    expect(validateFlexContainer({ type: "carousel", contents: Array(13).fill(b) }).valid).toBe(false);
    const big = bubble(box([{ type: "text", text: "x".repeat(31 * 1024) }]));
    expect(validateFlexContainer(big).valid).toBe(false);
  });

  it("requires at least one block in a bubble and a valid container type", () => {
    expect(validateFlexContainer({ type: "bubble" }).valid).toBe(false);
    expect(validateFlexContainer({ type: "box" }).valid).toBe(false);
    expect(validateFlexContainer(null).valid).toBe(false);
  });

  it("validates aspect ratio rules", () => {
    const img = (aspectRatio: string) => bubble(box([{ type: "image", url: "https://example.com/a.png", aspectRatio }]));
    expect(validateFlexContainer(img("20:13")).valid).toBe(true);
    expect(validateFlexContainer(img("1:4")).valid).toBe(false);
    expect(validateFlexContainer(img("wide")).valid).toBe(false);
  });
});
