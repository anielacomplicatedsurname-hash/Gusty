import { describe, expect, it } from "vitest";
import { resolveSiteUrl } from "@/config/site-url";

describe("resolveSiteUrl", () => {
  it("keeps a full address, without a trailing slash", () => {
    expect(resolveSiteUrl("https://gusty.example/", undefined)).toBe("https://gusty.example");
  });

  it("adds https:// when it was left out", () => {
    expect(resolveSiteUrl("gusty-web.onrender.com", undefined)).toBe("https://gusty-web.onrender.com");
  });

  it("ignores surrounding spaces", () => {
    expect(resolveSiteUrl("  https://gusty.example  ", undefined)).toBe("https://gusty.example");
  });

  it("uses Render's address when the setting is blank", () => {
    expect(resolveSiteUrl("", "https://gusty-web.onrender.com")).toBe("https://gusty-web.onrender.com");
  });

  it("falls back to localhost when nothing usable is set", () => {
    expect(resolveSiteUrl("", undefined)).toBe("http://localhost:3000");
    expect(resolveSiteUrl("not a url at all", undefined)).toBe("http://localhost:3000");
  });
});
