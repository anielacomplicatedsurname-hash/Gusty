import type { ExistingFact, FactKind, FactSource } from "@/ai/tasks/interpret-idea";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Fact = ExistingFact & { position: number };
export type ReadingState = { facts: Fact[]; lastRun: "ok" | "demo" | "error" | "declined" | null };

/** Gusty's reading for a project, and how the last reading went. RLS limits this to the owner. */
export async function getReading(projectId: string): Promise<ReadingState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { facts: [], lastRun: null };
  const [facts, runs] = await Promise.all([
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
  ]);
  if (facts.error) throw new Error(`Could not load Gusty's reading: ${facts.error.message}`);
  return {
    facts: (facts.data ?? []).map((f) => ({
      id: f.id,
      kind: f.kind as FactKind,
      value: f.value,
      source: f.source as FactSource,
      status: f.status as Fact["status"],
      position: f.position,
    })),
    lastRun: (runs.data?.[0]?.status as ReadingState["lastRun"]) ?? null,
  };
}
