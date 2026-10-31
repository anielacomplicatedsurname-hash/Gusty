import type { ExistingFact, FactKind, FactSource } from "@/ai/tasks/interpret-idea";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** A change Gusty made from a finished step, which the person can undo. */
export type StepChange = { id: string; stepTitle: string | null; answer: string };
export type Fact = ExistingFact & {
  position: number;
  /** Gusty updated or added this item from a step, and it still says what Gusty wrote. */
  fromStep?: StepChange;
  /** An open question that a step answered. */
  answered?: StepChange;
};
export type ReadingState = {
  facts: Fact[];
  lastRun: "ok" | "demo" | "error" | "declined" | null;
  /** The reading couldn't be loaded (e.g. a database change not yet applied). The page still works. */
  unavailable?: boolean;
};

/** Gusty's reading for a project, and how the last reading went. RLS limits this to the owner. */
export async function getReading(projectId: string): Promise<ReadingState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { facts: [], lastRun: null };
  const [facts, runs, changes] = await Promise.all([
    supabase
      .from("project_facts")
      .select("id, kind, value, source, status, position")
      .eq("project_id", projectId)
      .order("position")
      .order("created_at"),
    supabase
      .from("ai_runs")
      .select("status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("fact_suggestions")
      .select("id, kind, value, fact_id, next_steps(title)")
      .eq("project_id", projectId)
      .eq("status", "applied")
      .order("created_at"),
  ]);
  if (facts.error) {
    console.error("Could not load Gusty's reading:", facts.error.message);
    return { facts: [], lastRun: null, unavailable: true };
  }
  // Before the database change is applied, changes simply don't show.
  const byFact = new Map<string, StepChange & { kind: string; value: string }>();
  for (const c of changes.data ?? []) {
    if (!c.fact_id) continue;
    byFact.set(c.fact_id, {
      id: c.id, kind: c.kind, value: c.value, answer: c.value,
      stepTitle: (c.next_steps as { title: string } | null)?.title ?? null,
    });
  }
  return {
    facts: (facts.data ?? []).map((f) => {
      const change = byFact.get(f.id);
      const step = change ? { id: change.id, stepTitle: change.stepTitle, answer: change.answer } : undefined;
      return {
        id: f.id,
        kind: f.kind as FactKind,
        value: f.value,
        source: f.source as FactSource,
        status: f.status as Fact["status"],
        position: f.position,
        fromStep: change && change.kind !== "question" && change.value === f.value && f.status === "proposed" ? step : undefined,
        answered: change && change.kind === "question" && f.kind === "question" ? step : undefined,
      };
    }),
    lastRun: (runs.data?.[0]?.status as ReadingState["lastRun"]) ?? null,
  };
}
