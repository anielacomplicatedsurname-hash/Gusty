import type { Complexity, Kind, Scale } from "@/ai/tasks/opportunity-search";
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
  kind: Kind;
  scale: Scale;
  complexity: Complexity;
  complexityReason: string;
  fit: string;
  saved: boolean;
};

export type ExploreState = {
  /** The area to search around: the last one used, or what Gusty understood about the project. */
  place: string;
  latest: { status: "running" | "done" | "failed"; place: string; createdAt: string; results: FoundOpportunity[] } | null;
  /** Why a new search can't start yet, if it can't. */
  limit: "project" | "person" | null;
  /** Deep searches this person has left today, across all projects. */
  left: number;
  demo: boolean;
};

const COLUMNS =
  "id, title, funder, url, summary, who_for, amount, deadline, deadline_note, kind, scale, complexity, complexity_reason, fit, saved_at";

type Row = {
  id: string; title: string; funder: string; url: string; summary: string; who_for: string; amount: string;
  deadline: string | null; deadline_note: string; kind: string; scale: string; complexity: string;
  complexity_reason: string; fit: string; saved_at: string | null;
};

const toFound = (r: Row): FoundOpportunity => ({
  id: r.id, title: r.title, funder: r.funder, url: r.url, summary: r.summary, whoFor: r.who_for, amount: r.amount,
  deadline: r.deadline, deadlineNote: r.deadline_note, kind: r.kind as Kind, scale: r.scale as Scale,
  complexity: r.complexity as Complexity, complexityReason: r.complexity_reason, fit: r.fit, saved: r.saved_at !== null,
});

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
    const { data } = await supabase.from("found_opportunities").select(COLUMNS).eq("search_id", shown.id).order("rank");
    const today = new Date().toISOString().slice(0, 10);
    results = ((data ?? []) as Row[]).filter((r) => !r.deadline || r.deadline >= today).map(toFound);
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
    left: Math.max(0, SEARCHES_PER_PERSON_PER_DAY - (mine.count ?? 0)),
    demo: lastRun.data?.[0]?.status === "demo",
  };
}

/** Opportunities the person saved for a project, newest first, from any of its searches. */
export async function getSavedOpportunities(projectId: string): Promise<FoundOpportunity[]> {
  if (!isProjectId(projectId)) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("found_opportunities").select(COLUMNS).eq("project_id", projectId).not("saved_at", "is", null)
    .order("saved_at", { ascending: false });
  return ((data ?? []) as Row[]).map(toFound);
}

export type Freshness = "fresh" | "aging" | "old" | "never";

/** Up to date within a week, worth refreshing up to four weeks, out of date after that. */
export function freshness(lastSearch: string | null, now = Date.now()): Freshness {
  if (!lastSearch) return "never";
  const days = (now - new Date(lastSearch).getTime()) / DAY_MS;
  return days <= 7 ? "fresh" : days < 28 ? "aging" : "old";
}

/** When each of the person's projects last had a finished deep search. RLS keeps it to their own. */
export async function getLastSearches(): Promise<Map<string, string>> {
  const supabase = await createSupabaseServerClient();
  const last = new Map<string, string>();
  if (!supabase) return last;
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return last;
  const { data } = await supabase
    .from("opportunity_searches").select("project_id, created_at").eq("status", "done").order("created_at", { ascending: false });
  for (const s of data ?? []) if (!last.has(s.project_id)) last.set(s.project_id, s.created_at);
  return last;
}
