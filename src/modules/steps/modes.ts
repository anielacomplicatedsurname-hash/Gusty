export const MODES = ["simple", "guide", "everything"] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (v: string): v is Mode => (MODES as readonly string[]).includes(v);

export type StepView = {
  id: string;
  title: string;
  detail: string;
  minutes: number | null;
  status: "open" | "done";
  source: "ai" | "user";
  stage_id: string | null;
  position: number;
  explanation: string | null;
  starter: string | null;
};

/** The most "The bigger picture" ever shows: 3 to focus on, then up to 7 further ahead. */
export const BIGGER_PICTURE_LIMIT = 10;
const FOCUS = 3;

/**
 * What each experience mode shows. The data never changes between modes, only how much is visible:
 * Keep It Simple → the one next step · Guide Me Through → up to three · The Bigger Picture → the same
 * three, plus a quieter look further ahead (`ahead`). It only shows what Gusty has already planned and
 * never asks for more, and the whole view stops at BIGGER_PICTURE_LIMIT.
 */
export function visibleSteps(steps: StepView[], mode: Mode) {
  const open = steps.filter((s) => s.status === "open").sort((a, b) => a.position - b.position);
  const done = steps.filter((s) => s.status === "done");
  const limit = mode === "simple" ? 1 : FOCUS;
  const shown = open.slice(0, limit);
  const ahead = mode === "everything" ? open.slice(limit, BIGGER_PICTURE_LIMIT) : [];
  return {
    current: shown[0] ?? null,
    upcoming: shown.slice(1),
    ahead,
    hiddenCount: open.length - shown.length - ahead.length,
    done: mode === "everything" ? done : [],
    doneCount: done.length,
  };
}

type StageLike = { id: string; title: string; status: string };

/**
 * The stage being worked on and its steps. Earlier stages are history; with no stages (older projects),
 * all steps count as the current ones.
 */
export function currentStage<S extends StageLike>(stages: S[], steps: StepView[]) {
  const current = stages.find((st) => st.status === "current") ?? null;
  const stageSteps = current ? steps.filter((st) => st.stage_id === current.id) : steps;
  const open = stageSteps.filter((st) => st.status === "open").sort((a, b) => a.position - b.position);
  return {
    current,
    stageSteps,
    open,
    finished: stageSteps.length > 0 && open.length === 0,
    number: stages.filter((st) => st.status === "done").length + 1,
  };
}
