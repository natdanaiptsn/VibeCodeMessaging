import { describe, expect, it } from "vitest";
import { checkActionUri, checkMediaUrl } from "@/lib/flex/url-safety";

describe("URL safety", () => {
  it("allows https, line and tel action URIs", () => {
    expect(checkActionUri("https://example.com/path?q=1").ok).toBe(true);
    expect(checkActionUri("line://ti/p/@example").ok).toBe(true);
    expect(checkActionUri("tel:+6621234567").ok).toBe(true);
  });
  it("blocks dangerous schemes, credentials, private hosts and whitespace", () => {
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "file:///etc/passwd",
      "http://example.com",
      "https://user:pass@example.com",
      "https://localhost/x",
      "https://192.168.1.1/x",
      "https://10.0.0.5",
      "https://[::1]/",
      "https://exa mple.com",
    ]) {
      expect(checkActionUri(u).ok, u).toBe(false);
    }
  });
  it("requires https for media", () => {
    expect(checkMediaUrl("https://cdn.example.com/a.png").ok).toBe(true);
    expect(checkMediaUrl("http://cdn.example.com/a.png").ok).toBe(false);
  });
});
