import type { Complexity, Scale } from "@/ai/tasks/opportunity-search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import { SEARCH_STALE_MS, SEARCHES_PER_PERSON_PER_DAY, SEARCHES_PER_PROJECT_PER_DAY } from "./limits";

export type FoundOpportunity = {
  id: string;
  title: string;
  funder: string;
  url: string;
  summary: string;
  whoFor: string;
  amount: string;
  deadline: string | null;
  deadlineNote: string;
  scale: Scale;
  complexity: Complexity;
  complexityReason: string;
  fit: string;
};

export type ExploreState = {
  /** The area to search around: the last one used, or what Gusty understood about the project. */
  place: string;
  latest: { status: "running" | "done" | "failed"; place: string; createdAt: string; results: FoundOpportunity[] } | null;
  /** Why a new search can't start yet, if it can't. */
  limit: "project" | "person" | null;
  demo: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The project's latest search and what it found. RLS limits all of it to the owner. */
export async function getExploreState(projectId: string): Promise<ExploreState | null> {
  if (!isProjectId(projectId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const [searches, placeFact, mine, lastRun] = await Promise.all([
    supabase.from("opportunity_searches").select("id, status, place, created_at").eq("project_id", projectId)
      .order("created_at", { ascending: false }).limit(5),
    supabase.from("project_facts").select("value").eq("project_id", projectId).eq("kind", "place").limit(1).maybeSingle(),
    supabase.from("opportunity_searches").select("id", { count: "exact", head: true }).neq("status", "failed").gte("created_at", since),
    supabase.from("ai_runs").select("status").eq("project_id", projectId).eq("task", "opportunity_search")
      .order("created_at", { ascending: false }).limit(1),
  ]);
  if (searches.error) return null;

  const stale = (s: { status: string; created_at: string }) =>
    s.status === "running" && Date.now() - new Date(s.created_at).getTime() > SEARCH_STALE_MS;
  const rows = searches.data.map((s) => ({ ...s, status: stale(s) ? "failed" : s.status }));
  const latestRow = rows[0] ?? null;
  // Show the newest search that finished, unless one is running or failed after it.
  const shown = latestRow?.status === "done" ? latestRow : rows.find((s) => s.status === "done") ?? null;

  let results: FoundOpportunity[] = [];
  if (shown) {
    const { data } = await supabase
      .from("found_opportunities")
      .select("id, title, funder, url, summary, who_for, amount, deadline, deadline_note, scale, complexity, complexity_reason, fit")
      .eq("search_id", shown.id)
      .order("rank");
    const today = new Date().toISOString().slice(0, 10);
    results = (data ?? [])
      .filter((r) => !r.deadline || r.deadline >= today)
      .map((r) => ({
        id: r.id, title: r.title, funder: r.funder, url: r.url, summary: r.summary, whoFor: r.who_for, amount: r.amount,
        deadline: r.deadline, deadlineNote: r.deadline_note, scale: r.scale as Scale, complexity: r.complexity as Complexity,
        complexityReason: r.complexity_reason, fit: r.fit,
      }));
  }

  const recentForProject = rows.filter((s) => s.status !== "failed" && s.created_at >= since).length;
  const limit = recentForProject >= SEARCHES_PER_PROJECT_PER_DAY ? "project"
    : (mine.count ?? 0) >= SEARCHES_PER_PERSON_PER_DAY ? "person" : null;

  return {
    place: latestRow?.place || placeFact.data?.value || "",
    latest: latestRow
      ? {
          status: latestRow.status as "running" | "done" | "failed",
          place: (shown ?? latestRow).place,
          createdAt: (shown ?? latestRow).created_at,
          results,
        }
      : null,
    limit,
    demo: lastRun.data?.[0]?.status === "demo",
  };
}
