import { describe, expect, it } from "vitest";
import { chooseNext } from "@/modules/projects/overview";
import { currentStage, type StepView } from "@/modules/steps/modes";

const step = (n: number, status: "open" | "done" = "open", stage: string | null = "s1"): StepView => ({
  id: `p${n}`, title: `Step ${n}`, detail: "", minutes: 10, status, source: "ai", position: n,
  explanation: null, starter: null, stage_id: stage,
});

describe("the project's one next thing", () => {
  it("goes reading → direction → the current step → the next stage → opportunities", () => {
    const base = { hasReading: true, hasDirection: true, open: [] as StepView[], stageFinished: false };
    expect(chooseNext({ ...base, hasReading: false }).kind).toBe("reading");
    expect(chooseNext({ ...base, hasDirection: false }).kind).toBe("directions");
    expect(chooseNext({ ...base, open: [step(2), step(3)] })).toEqual({ kind: "step", step: step(2) });
    expect(chooseNext({ ...base, stageFinished: true }).kind).toBe("nextStage");
    expect(chooseNext(base).kind).toBe("explore");
  });

  it("finds the current stage, its open steps in order, and whether it's finished", () => {
    const stages = [{ id: "s0", title: "First", status: "done" }, { id: "s1", title: "Second", status: "current" }];
    const steps = [step(1, "done", "s0"), step(5, "open"), step(4, "open"), step(3, "done")];
    const view = currentStage(stages, steps);
    expect(view.current?.title).toBe("Second");
    expect(view.number).toBe(2);
    expect(view.open.map((s) => s.id)).toEqual(["p4", "p5"]);
    expect(view.finished).toBe(false);
    expect(currentStage(stages, [step(3, "done")]).finished).toBe(true);
  });
});
