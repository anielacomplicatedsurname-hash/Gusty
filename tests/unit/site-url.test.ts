import { describe, expect, it } from "vitest";
import { canonicalRedirect, resolveSiteUrl } from "@/config/site-url";

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

describe("canonicalRedirect", () => {
  const site = "https://heygusty.com";
  it("sends the Render address and www to the real domain", () => {
    expect(canonicalRedirect("gusty-web.onrender.com", site)).toBe("https://heygusty.com");
    expect(canonicalRedirect("www.heygusty.com", site)).toBe("https://heygusty.com");
  });
  it("leaves the real domain, local development and unknown hosts alone", () => {
    expect(canonicalRedirect("heygusty.com", site)).toBeNull();
    expect(canonicalRedirect("localhost:3100", "http://localhost:3100")).toBeNull();
    expect(canonicalRedirect("evil.example", site)).toBeNull();
    expect(canonicalRedirect(null, site)).toBeNull();
  });
  it("does nothing while the Render address is still the real one", () => {
    expect(canonicalRedirect("gusty-web.onrender.com", "https://gusty-web.onrender.com")).toBeNull();
  });
});
