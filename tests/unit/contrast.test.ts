import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i + 1, i + 3), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(path.join(__dirname, "../../src/app/globals.css"), "utf8");
function token(name: string) {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
}

describe("palette contrast (WCAG 2.2 AA)", () => {
  const backgrounds = ["paper", "oat", "white", "signal", "sky", "lilac", "sage"];

  it.each(backgrounds)("ink text on %s is at least 4.5:1", (bg) => {
    expect(contrast(token("ink"), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["paper", "oat", "white"])("muted text (stone-strong) on %s is at least 4.5:1", (bg) => {
    expect(contrast(token("stone-strong"), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it("paper text on the ink button is at least 4.5:1", () => {
    expect(contrast(token("paper"), token("ink"))).toBeGreaterThanOrEqual(4.5);
  });

  it("stone input borders meet the 3:1 non-text minimum on paper and white", () => {
    expect(contrast(token("stone"), token("paper"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("stone"), token("white"))).toBeGreaterThanOrEqual(3);
  });
});
