import { describe, expect, it } from "vitest";
import { isMood, moodOf } from "@/modules/steps/mood";

describe("choosing a step by how you feel", () => {
  it("sorts steps by their words, the opening verb counting most", () => {
    expect(moodOf({ title: "Write your idea in three sentences" })).toBe("writing");
    expect(moodOf({ title: "Choose one small thing to try this week" })).toBe("planning");
    expect(moodOf({ title: "Pick one person to tell about your idea", detail: "Message or call them" })).toBe("social");
    expect(moodOf({ title: "Look up one similar project near you" })).toBe("research");
    expect(moodOf({ title: "Sketch what a first session could look like" })).toBe("making");
    expect(moodOf({ title: "Ask two neighbours what they'd want" })).toBe("social");
  });

  it("keeps a kind Gusty gave the step, and admits when nothing fits", () => {
    expect(moodOf({ title: "Write a list", mood: "making" })).toBe("making");
    expect(moodOf({ title: "Breathe" })).toBeNull();
    expect(moodOf({ title: "Ask for a task" })).toBe("social");
    expect(isMood("writing")).toBe(true);
    expect(isMood("dancing")).toBe(false);
  });
});
