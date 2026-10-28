import { describe, expect, it } from "vitest";
import { cleanAnswer, cleanPage } from "@/modules/feedback/validation";

describe("feedback", () => {
  it("trims answers, caps their length and treats blanks as empty", () => {
    expect(cleanAnswer("  Loved the steps  ")).toBe("Loved the steps");
    expect(cleanAnswer("   ")).toBeNull();
    expect(cleanAnswer(null)).toBeNull();
    expect(cleanAnswer("a".repeat(3000))).toHaveLength(2000);
  });

  it("keeps only the page path, without project ids or query strings", () => {
    expect(cleanPage("/en/projects/0b8f1c2e-1234-4abc-9def-0123456789ab")).toBe("/en/projects/:id");
    expect(cleanPage("/en/support?x=1#help")).toBe("/en/support");
    expect(cleanPage("https://evil.example")).toBeNull();
    expect(cleanPage("//evil.example")).toBeNull();
  });
});
