import { describe, expect, it } from "vitest";
import { cleanDate, isSafeUrl, normaliseOpportunity } from "@/ai/tasks/opportunity";

describe("reading a funder's page", () => {
  it("keeps only real calendar dates", () => {
    expect(cleanDate("2026-12-12")).toBe("2026-12-12");
    expect(cleanDate("2026-02-30")).toBe("");
    expect(cleanDate("12 December")).toBe("");
    expect(cleanDate("")).toBe("");
  });

  it("keeps only the allowed regions, once each, and trims long text", () => {
    const out = normaliseOpportunity({
      readable: true, isFunding: true, title: "  Village   Arts Fund ", funder: "x".repeat(300), summary: "", whoFor: "",
      amount: "Up to £5,000", deadline: "not a date", deadlineNote: "Rolling", regions: ["UK", "uk", "mars", "europe"],
    });
    expect(out.title).toBe("Village Arts Fund");
    expect(out.funder).toHaveLength(200);
    expect(out.deadline).toBe("");
    expect(out.regions).toEqual(["uk", "europe"]);
  });

  it("only accepts ordinary https links", () => {
    expect(isSafeUrl("https://www.example.org/grants/arts")).toBe(true);
    for (const bad of ["http://example.org", "https://localhost/x", "https://127.0.0.1/x", "https://user:pw@example.org",
      "https://intranet/x", "https://[::1]/x", "javascript:alert(1)", "not a url"]) {
      expect(isSafeUrl(bad)).toBe(false);
    }
  });
});
