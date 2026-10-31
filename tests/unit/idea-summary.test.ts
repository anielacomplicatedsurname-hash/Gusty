import { describe, expect, it } from "vitest";
import { normaliseSummary, SUMMARY_PROMPT } from "@/ai/tasks/idea-summary";

describe("the idea summary", () => {
  it("keeps at most three different points and trims the summary", () => {
    const out = normaliseSummary({ summary: "  A   repair café.  ", points: ["In Hackney", "In Hackney", " ", "Run by volunteers", "Teaches skills", "Extra"] });
    expect(out.summary).toBe("A repair café.");
    expect(out.points).toEqual(["In Hackney", "Run by volunteers", "Teaches skills"]);
  });

  it("only uses what the person said, and never invents what makes it different", () => {
    expect(SUMMARY_PROMPT).toContain("Only what their own material shows");
    expect(SUMMARY_PROMPT).toContain("never invent");
    expect(SUMMARY_PROMPT).toContain("Don't add achievements, numbers, partners or claims they haven't made.");
  });
});
