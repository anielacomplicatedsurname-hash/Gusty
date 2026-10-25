import { describe, expect, it } from "vitest";
import {
  checkEmail, checkIdea, IDEA_MAX_LENGTH, isProjectId, safeNextPath, signInDestination, titleFromIdea,
} from "@/modules/projects/validation";

describe("checkIdea", () => {
  it("trims and accepts a short idea", () => {
    expect(checkIdea("  A community garden  ")).toEqual({ ok: true, idea: "A community garden" });
  });
  it("rejects empty or whitespace-only input", () => {
    expect(checkIdea("   ")).toEqual({ ok: false, error: "empty" });
    expect(checkIdea(null)).toEqual({ ok: false, error: "empty" });
  });
  it("rejects ideas over the limit", () => {
    expect(checkIdea("a".repeat(IDEA_MAX_LENGTH + 1))).toEqual({ ok: false, error: "tooLong" });
  });
});

describe("titleFromIdea", () => {
  it("uses the first line", () => {
    expect(titleFromIdea("Seed library\nfor my street")).toBe("Seed library");
  });
  it("shortens long first lines at a word boundary", () => {
    const title = titleFromIdea(
      "A travelling puppet theatre that tours rural libraries and teaches children about rivers",
    );
    expect(title.length).toBeLessThanOrEqual(61);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });
});

describe("isProjectId", () => {
  it("accepts UUIDs only", () => {
    expect(isProjectId("6f1c2d3e-1111-4abc-8def-0123456789ab")).toBe(true);
    expect(isProjectId("../etc/passwd")).toBe(false);
  });
});

describe("checkEmail", () => {
  it("accepts a normal address and trims it", () => {
    expect(checkEmail(" ana@example.org ")).toBe("ana@example.org");
  });
  it("rejects malformed input", () => {
    expect(checkEmail("not-an-email")).toBeNull();
    expect(checkEmail(undefined)).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("allows same-site paths", () => {
    expect(safeNextPath("/en/projects", "/en")).toBe("/en/projects");
  });
  it("blocks other sites", () => {
    expect(safeNextPath("https://evil.example", "/en")).toBe("/en");
    expect(safeNextPath("//evil.example", "/en")).toBe("/en");
    expect(safeNextPath("/\\evil.example", "/en")).toBe("/en");
    expect(safeNextPath(null, "/en")).toBe("/en");
  });
});

describe("signInDestination", () => {
  const site = "https://gusty-web.onrender.com";

  it("uses the public site address, never the server's internal one", () => {
    expect(signInDestination("/en/projects", true, site, "/en")).toBe("https://gusty-web.onrender.com/en/projects");
  });
  it("flags a failed link so the page can explain it", () => {
    expect(signInDestination("/en/projects", false, site, "/en")).toBe(
      "https://gusty-web.onrender.com/en/projects?signin=failed",
    );
  });
  it("ignores destinations on other sites", () => {
    expect(signInDestination("https://evil.example/x", true, site, "/en/projects")).toBe(
      "https://gusty-web.onrender.com/en/projects",
    );
  });
});
