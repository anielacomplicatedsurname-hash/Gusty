import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import {
  type EvidenceKind, RESEARCH_PER_PERSON_PER_DAY, RESEARCH_PER_PROJECT_PER_DAY, RESEARCH_STALE_MS,
} from "./limits";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export type Evidence = { id: string; kind: EvidenceKind; text: string; url: string };
export type Source = {
  id: string; title: string; publisher: string; year: string; url: string; finding: string; relevance: string; foundAt: string;
};
export type Bank = {
  evidence: Evidence[];
  research: Source[];
  /** How the research search stands: running now, the last one failed, or today's allowance is used. */
  researchState: { running: boolean; failed: boolean; limit: "project" | "person" | null; left: number; max: number; demo: boolean };
};

/** The person's own writing about the project: never Gusty's drafts, tidied copies or helped answers. */
export async function loadOwnWriting(supabase: Supabase, projectId: string): Promise<string[]> {
  const [{ data: project }, { data: answers }, { data: steps }, { data: facts }, { data: evidence }] = await Promise.all([
    supabase.from("projects").select("idea").eq("id", projectId).maybeSingle(),
    supabase.from("step_questions").select("answer").eq("project_id", projectId).eq("status", "active").eq("assisted", false).neq("answer", ""),
    supabase.from("next_steps").select("notes").eq("project_id", projectId).neq("notes", ""),
    supabase.from("project_facts").select("value").eq("project_id", projectId).eq("source", "user").neq("kind", "stage"),
    supabase.from("project_evidence").select("text").eq("project_id", projectId).eq("origin", "person"),
  ]);
  return [
    project?.idea ?? "",
    ...(answers ?? []).map((a) => a.answer),
    ...(steps ?? []).map((s) => s.notes),
    ...(facts ?? []).map((f) => f.value),
    ...(evidence ?? []).map((e) => e.text),
  ].map((t) => t.trim()).filter(Boolean);
}

/** Everything in the project bank. Owner only (RLS). Before the database change, it's simply empty. */
export async function getBank(projectId: string): Promise<Bank | null> {
  if (!isProjectId(projectId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [evidence, runs, mine, lastRun] = await Promise.all([
    supabase.from("project_evidence")
      .select("id, origin, kind, text, title, publisher, year, relevance, url, found_at")
      .eq("project_id", projectId).order("position").order("created_at"),
    supabase.from("research_runs").select("status, created_at").eq("project_id", projectId).gte("created_at", since)
      .order("created_at", { ascending: false }),
    supabase.from("research_runs").select("id", { count: "exact", head: true }).neq("status", "failed").gte("created_at", since),
    supabase.from("ai_runs").select("status").eq("project_id", projectId).eq("task", "research")
      .order("created_at", { ascending: false }).limit(1),
  ]);
  if (evidence.error) return null;
  const rows = evidence.data ?? [];
  const latest = runs.data?.[0];
  const running = latest?.status === "running" && Date.now() - new Date(latest.created_at).getTime() < RESEARCH_STALE_MS;
  const usedForProject = (runs.data ?? []).filter((r) => r.status !== "failed").length;
  const usedByPerson = mine.count ?? 0;
  return {
    evidence: rows.filter((r) => r.origin === "person").map((r) => ({ id: r.id, kind: r.kind as EvidenceKind, text: r.text, url: r.url })),
    research: rows.filter((r) => r.origin === "research").map((r) => ({
      id: r.id, title: r.title, publisher: r.publisher, year: r.year, url: r.url, finding: r.text, relevance: r.relevance,
      foundAt: r.found_at ?? "",
    })),
    researchState: {
      running,
      failed: !running && latest?.status === "failed",
      limit: usedForProject >= RESEARCH_PER_PROJECT_PER_DAY ? "project" : usedByPerson >= RESEARCH_PER_PERSON_PER_DAY ? "person" : null,
      left: Math.max(0, RESEARCH_PER_PERSON_PER_DAY - usedByPerson),
      max: RESEARCH_PER_PERSON_PER_DAY,
      demo: lastRun.data?.[0]?.status === "demo",
    },
  };
}
