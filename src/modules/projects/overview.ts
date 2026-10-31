import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReading } from "@/modules/interpretation/data";
import { AREAS, getReadiness } from "@/modules/readiness/data";
import { getStepsState } from "@/modules/steps/data";
import { currentStage, type StepView } from "@/modules/steps/modes";
import { isProjectId } from "./validation";

/** The one thing to do next on a project. */
export type NextThing =
  | { kind: "reading" }
  | { kind: "directions" }
  | { kind: "step"; step: StepView }
  | { kind: "nextStage" }
  | { kind: "explore" };

/**
 * Picks the single most useful next thing: let Gusty read the idea, then choose a direction, then the
 * current step, then the next stage. Funding stays quiet until there's nothing more pressing.
 */
export function chooseNext(input: {
  hasReading: boolean; hasDirection: boolean; open: StepView[]; stageFinished: boolean;
}): NextThing {
  if (!input.hasReading) return { kind: "reading" };
  if (!input.hasDirection) return { kind: "directions" };
  if (input.open.length > 0) return { kind: "step", step: input.open[0] };
  if (input.stageFinished) return { kind: "nextStage" };
  return { kind: "explore" };
}

export type ProjectOverview = {
  next: NextThing;
  stage: { number: number; title: string } | null;
  ready: { done: number; total: number };
  saved: number;
  /** Gusty's pending suggestions for the idea, from finished steps. */
  suggestions: number;
  /** Changes Gusty made to the idea from steps in the last few days. */
  grew: number;
  lastSearch: string | null;
  hasReading: boolean;
  hasDirection: boolean;
  /** Open steps in the current stage, in order: for choosing one by how the person feels today. */
  open: StepView[];
};

/** Everything the project's top card, the welcome-back card and My Projects need. RLS keeps it to the owner. */
export async function getProjectOverview(projectId: string): Promise<ProjectOverview | null> {
  if (!isProjectId(projectId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const [reading, steps, readiness, saved, search, suggestions, grew] = await Promise.all([
    getReading(projectId),
    getStepsState(projectId),
    getReadiness(projectId),
    supabase.from("found_opportunities").select("id", { count: "exact", head: true }).eq("project_id", projectId).not("saved_at", "is", null),
    supabase.from("opportunity_searches").select("created_at").eq("project_id", projectId).eq("status", "done")
      .order("created_at", { ascending: false }).limit(1),
    supabase.from("fact_suggestions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "pending"),
    supabase.from("fact_suggestions").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "applied")
      .gte("created_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
  ]);
  const stage = currentStage(steps.stages, steps.steps);
  const hasReading = reading.facts.length > 0;
  const hasDirection = steps.directions.some((d) => d.chosen);
  return {
    next: chooseNext({
      hasReading,
      hasDirection,
      open: stage.open,
      stageFinished: stage.finished,
    }),
    stage: stage.current ? { number: stage.number, title: stage.current.title } : null,
    ready: { done: readiness ? AREAS.filter((a) => readiness.inPlace[a]).length : 0, total: AREAS.length },
    saved: saved.count ?? 0,
    suggestions: suggestions.count ?? 0,
    grew: grew.count ?? 0,
    lastSearch: search.data?.[0]?.created_at ?? null,
    hasReading,
    hasDirection,
    open: stage.open,
  };
}
