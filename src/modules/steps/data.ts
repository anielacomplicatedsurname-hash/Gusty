import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMode, type Mode, type StepView } from "./modes";

export type DirectionView = { id: string; label: string; reason: string; recommended: boolean; chosen: boolean };
export type StepsState = {
  directions: DirectionView[];
  steps: StepView[];
  mode: Mode;
  demo: boolean;
  unavailable?: boolean;
};

/** Directions, steps and the person's preferred mode for a project. RLS limits all of it to the owner. */
export async function getStepsState(projectId: string): Promise<StepsState> {
  const empty: StepsState = { directions: [], steps: [], mode: "guide", demo: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return empty;
  const [directions, steps, prefs, lastRun] = await Promise.all([
    supabase.from("project_directions").select("id, label, reason, recommended, chosen").eq("project_id", projectId).order("position"),
    supabase
      .from("next_steps")
      .select("id, title, detail, minutes, status, source, position, explanation, starter")
      .eq("project_id", projectId)
      .in("status", ["open", "done"])
      .order("position")
      .order("created_at"),
    supabase.from("user_preferences").select("experience_mode").maybeSingle(),
    supabase
      .from("ai_runs")
      .select("status")
      .eq("project_id", projectId)
      .in("task", ["suggest_directions", "plan_steps"])
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  if (directions.error || steps.error) {
    console.error("Could not load next steps:", directions.error?.message ?? steps.error?.message);
    return { ...empty, unavailable: true };
  }
  const mode = prefs.data?.experience_mode;
  return {
    directions: directions.data,
    steps: steps.data as StepView[],
    mode: mode && isMode(mode) ? mode : "guide",
    demo: lastRun.data?.[0]?.status === "demo",
  };
}
