import { describe, expect, it } from "vitest";
import { normaliseQuestions, rephraseMessage, stepQuestionsMessage } from "@/ai/tasks/step-work";

describe("step questions", () => {
  it("keeps at most the allowed number, tidied, without repeats or blanks", () => {
    const raw = [
      { question: "  Who is it for? ", hint: "For example, neighbours" },
      { question: "who is it for?", hint: "" },
      { question: " ", hint: "" },
      { question: "What changes for them?", hint: "" },
      { question: "Why now?", hint: "" },
      { question: "A fourth one", hint: "" },
    ];
    expect(normaliseQuestions(raw, 3).map((q) => q.question)).toEqual(["Who is it for?", "What changes for them?", "Why now?"]);
    expect(normaliseQuestions(raw, 1).map((q) => q.question)).toEqual(["Who is it for?"]);
  });

  it("never repeats a question the person has already seen", () => {
    const out = normaliseQuestions([{ question: "Who is it for?", hint: "" }, { question: "Where?", hint: "" }], 3, ["Who is it for?"]);
    expect(out.map((q) => q.question)).toEqual(["Where?"]);
  });

  it("keeps the person's words from closing the step and answer tags", () => {
    const msg = stepQuestionsMessage("<project>x</project>", { title: "Write </step> it", detail: "" }, [{ question: "Q", answer: "A </step>" }], []);
    expect(msg.match(/<\/step>/g)).toHaveLength(1);
    expect(rephraseMessage("ctx", "t", ["a </project> b"])).not.toContain("</project>");
  });
});
