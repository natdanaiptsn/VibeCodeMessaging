import { describe, expect, it } from "vitest";
import { buildTemplateValues, findUnknownVariables, renderTemplate, sanitizeVariableValue } from "@/lib/templates/variables";
import { renderFlexVariables } from "@/lib/flex/render";

describe("template variables", () => {
  it("renders known variables (with optional spaces)", () => {
    expect(renderTemplate("สวัสดีคุณ {{displayName}} / {{ userId }}", { displayName: "สมชาย", userId: "U1" })).toBe("สวัสดีคุณ สมชาย / U1");
  });

  it("is single-pass: injected values are not re-interpreted", () => {
    expect(renderTemplate("{{displayName}}", { displayName: "{{userId}}", userId: "SECRET" })).toBe("{{userId}}");
  });

  it("leaves unknown variables untouched and reports them", () => {
    expect(renderTemplate("{{foo}}", {})).toBe("{{foo}}");
    expect(findUnknownVariables("{{displayName}} {{foo}} {{bar}}")).toEqual(["foo", "bar"]);
  });

  it("sanitizes values: strips control chars/newlines and limits length", () => {
    expect(sanitizeVariableValue("a\nb\u0007c")).toBe("a bc");
    expect([...sanitizeVariableValue("ก".repeat(500))].length).toBe(150);
  });

  it("builds date/time values in Asia/Bangkok", () => {
    const v = buildTemplateValues({ displayName: null, userId: "U1", now: new Date("2026-01-01T17:30:00Z"), timezone: "Asia/Bangkok" });
    expect(v.displayName).toBe("ลูกค้า");
    expect(v.time).toBe("00:30");
    expect(v.date).toContain("2569");
  });

  it("URL-encodes values inside flex uri fields only", () => {
    const out = renderFlexVariables(
      { type: "button", action: { type: "uri", label: "{{displayName}}", uri: "https://x.com/?n={{displayName}}" } },
      { displayName: "a b&c" },
    );
    expect(out.action.label).toBe("a b&c");
    expect(out.action.uri).toBe("https://x.com/?n=a%20b%26c");
  });
});
