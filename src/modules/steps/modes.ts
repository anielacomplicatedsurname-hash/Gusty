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
  position: number;
  explanation: string | null;
  starter: string | null;
};

/**
 * What each experience mode shows. The data never changes between modes, only how much is visible:
 * Keep It Simple → the one next step · Guide Me Through → up to three · Let Me See Everything → all.
 */
export function visibleSteps(steps: StepView[], mode: Mode) {
  const open = steps.filter((s) => s.status === "open").sort((a, b) => a.position - b.position);
  const done = steps.filter((s) => s.status === "done");
  const limit = mode === "simple" ? 1 : mode === "guide" ? 3 : open.length;
  const shown = open.slice(0, limit);
  return {
    current: shown[0] ?? null,
    upcoming: shown.slice(1),
    hiddenCount: open.length - shown.length,
    done: mode === "everything" ? done : [],
    doneCount: done.length,
  };
}
