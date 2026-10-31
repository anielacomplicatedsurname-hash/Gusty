import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

export type IdeaSummary = {
  summary: string | null;
  points: string[];
  updatedAt: string | null;
  /** Something new has been said since the summary was written. */
  stale: boolean;
  /** There's enough to summarise: Gusty has read the idea. */
  ready: boolean;
  demo: boolean;
};

/** Gusty's summary of the project and whether it's behind what the person has added since. Owner only (RLS). */
export async function getIdeaSummary(projectId: string): Promise<IdeaSummary | null> {
  if (!isProjectId(projectId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const latest = (table: "project_facts" | "step_questions" | "next_steps", column = "updated_at") =>
    supabase.from(table).select(column).eq("project_id", projectId).order(column, { ascending: false }).limit(1);
  const [summary, project, facts, answers, steps, docs, lastRun] = await Promise.all([
    supabase.from("project_summaries").select("summary, points, updated_at").eq("project_id", projectId).maybeSingle(),
    supabase.from("projects").select("updated_at").eq("id", projectId).maybeSingle(),
    latest("project_facts"),
    latest("step_questions"),
    latest("next_steps"),
    supabase.from("project_documents").select("created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
    supabase.from("ai_runs").select("status").eq("project_id", projectId).eq("task", "idea_summary")
      .order("created_at", { ascending: false }).limit(1),
  ]);
  if (summary.error || !project.data) return null;
  const changes = [
    project.data.updated_at,
    (facts.data?.[0] as { updated_at?: string } | undefined)?.updated_at,
    (answers.data?.[0] as { updated_at?: string } | undefined)?.updated_at,
    (steps.data?.[0] as { updated_at?: string } | undefined)?.updated_at,
    docs.data?.[0]?.created_at,
  ].filter((d): d is string => !!d);
  const lastChange = changes.sort().at(-1) ?? null;
  const updatedAt = summary.data?.updated_at ?? null;
  return {
    summary: summary.data?.summary ?? null,
    points: summary.data?.points ?? [],
    updatedAt,
    stale: !!updatedAt && !!lastChange && lastChange > updatedAt,
    ready: (facts.data ?? []).length > 0,
    demo: lastRun.data?.[0]?.status === "demo",
  };
}
