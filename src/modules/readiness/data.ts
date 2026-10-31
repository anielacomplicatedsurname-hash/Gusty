import type { Focus, Need, Route } from "@/ai/tasks/funding-routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

/** What a funder usually wants to see, in the order people tend to get there. */
export const AREAS = ["clear", "who", "where", "amount", "plan", "progress", "opportunities"] as const;
export type Area = (typeof AREAS)[number];

export type FundingRoute = { id: string; route: Route; focus: Focus; fit: "strong" | "possible"; why: string; firstStep: string };
export type Readiness = {
  inPlace: Record<Area, boolean>;
  need: Need | null;
  routes: FundingRoute[];
  demo: boolean;
};

/**
 * How ready a project is for funding, from what's actually in place: no scoring by AI, so it's always clear
 * why. What the person wrote counts, and so does Gusty restating their words; Gusty's own guesses don't,
 * until the person edits them. RLS limits all of it to the owner.
 */
export async function getReadiness(projectId: string): Promise<Readiness | null> {
  if (!isProjectId(projectId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const [project, facts, search, stages, done, saved, routes, lastRun] = await Promise.all([
    supabase.from("projects").select("funding_need").eq("id", projectId).maybeSingle(),
    supabase.from("project_facts").select("kind, source, status").eq("project_id", projectId),
    supabase.from("opportunity_searches").select("place").eq("project_id", projectId).neq("place", "").limit(1),
    supabase.from("project_stages").select("id", { count: "exact", head: true }).eq("project_id", projectId).neq("status", "set_aside"),
    supabase.from("next_steps").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "done"),
    supabase.from("found_opportunities").select("id", { count: "exact", head: true }).eq("project_id", projectId).not("saved_at", "is", null),
    supabase.from("funding_routes").select("id, route, focus, fit, why, first_step").eq("project_id", projectId).order("position"),
    supabase.from("ai_runs").select("status").eq("project_id", projectId).eq("task", "funding_routes")
      .order("created_at", { ascending: false }).limit(1),
  ]);
  if (project.error || !project.data) return null;
  const confirmed = (kind: string) =>
    (facts.data ?? []).some((f) => f.kind === kind && (f.source !== "ai_suggestion" || f.status === "confirmed"));
  const need = (project.data.funding_need as Need | null) ?? null;
  return {
    inPlace: {
      clear: confirmed("summary"),
      who: confirmed("audience"),
      where: confirmed("place") || (search.data ?? []).length > 0,
      amount: need !== null && need !== "unsure",
      plan: (stages.count ?? 0) > 0,
      progress: (done.count ?? 0) > 0,
      opportunities: (saved.count ?? 0) > 0,
    },
    need,
    routes: (routes.data ?? []).map((r) => ({
      id: r.id, route: r.route as Route, focus: r.focus as Focus, fit: r.fit as "strong" | "possible",
      why: r.why, firstStep: r.first_step,
    })),
    demo: lastRun.data?.[0]?.status === "demo",
  };
}
