import { describe, expect, it } from "vitest";
import { canContain, createNode, docFromJson, docToJson, insertNode, locate, moveNode, removeNode } from "@/components/flex-builder/model";
import { FLEX_PRESETS } from "@/lib/flex/presets";

describe("Flex builder model", () => {
  it("round-trips presets through the builder model unchanged", () => {
    for (const p of FLEX_PRESETS) {
      expect(docToJson(docFromJson(p.contents))).toEqual(p.contents);
    }
  });

  it("does not leak builder ids into exported JSON", () => {
    const json = JSON.stringify(docToJson(docFromJson(FLEX_PRESETS[0]!.contents)));
    expect(json).not.toContain("__id");
  });

  it("prevents moving a box into its own descendant", () => {
    const doc = docFromJson({ type: "bubble", body: { type: "box", layout: "vertical", contents: [{ type: "box", layout: "vertical", contents: [{ type: "box", layout: "vertical", contents: [] }] }] } });
    const outer = doc.bubbles[0]!.body!.children![0]!;
    const inner = outer.children![0]!;
    expect(moveNode(doc, outer.id, inner.id)).toBeNull();
  });

  it("respects baseline restrictions and supports insert/remove", () => {
    const baseline = createNode("box-baseline");
    expect(canContain(baseline, "text")).toBe(true);
    expect(canContain(baseline, "image")).toBe(false);
    const doc = docFromJson({ type: "bubble", body: { type: "box", layout: "vertical", contents: [] } });
    const bodyId = doc.bubbles[0]!.body!.id;
    const text = createNode("text");
    const next = insertNode(doc, bodyId, text)!;
    expect(locate(next, text.id)?.parent?.id).toBe(bodyId);
    expect(locate(removeNode(next, text.id), text.id)).toBeNull();
  });
});
