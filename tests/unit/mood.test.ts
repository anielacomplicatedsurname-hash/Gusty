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
    expect(moodOf({ title: "Prepare the hall for Saturday", mood: "making" })).toBe("making");
    expect(moodOf({ title: "Breathe" })).toBeNull();
    expect(moodOf({ title: "Ask for a task" })).toBe("social");
    expect(isMood("writing")).toBe(true);
    expect(isMood("dancing")).toBe(false);
  });

  it("lets a step's own words win when its saved kind clearly doesn't fit", () => {
    // The two the founder spotted: writing an invite isn't talking to people; sketching a route is planning.
    expect(moodOf({ title: "Write a short, friendly invite for the first ride", detail: "Say it is a slow, social ride", mood: "social" })).toBe("writing");
    expect(moodOf({ title: "Sketch a gentle one-hour route with a coffee stop", detail: "Using a map you like, trace a slow, green loop", mood: "making" })).toBe("planning");
    expect(moodOf({ title: "Sketch a poster for the first ride" })).toBe("making");
  });
});
