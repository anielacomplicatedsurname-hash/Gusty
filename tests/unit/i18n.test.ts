import { describe, expect, it } from "vitest";
import { defaultLocale, hasLocale, locales, textDirection } from "@/i18n/config";
import en from "@/i18n/messages/en.json";

function leaves(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(leaves);
  if (value && typeof value === "object") return Object.values(value).flatMap(leaves);
  return [];
}

describe("i18n config", () => {
  it("includes the default locale", () => {
    expect(locales).toContain(defaultLocale);
  });

  it("recognises supported locales only", () => {
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("xx")).toBe(false);
  });

  it("detects right-to-left scripts", () => {
    expect(textDirection("en")).toBe("ltr");
    expect(textDirection("ar")).toBe("rtl");
    expect(textDirection("he-IL")).toBe("rtl");
  });

  it("has no empty interface strings", () => {
    expect(leaves(en).every((s) => s.trim().length > 0)).toBe(true);
  });

  it("uses the brand name Gusty, never the retired spelling", () => {
    expect(JSON.stringify(en)).not.toMatch(/gustyyy/i);
  });
});
