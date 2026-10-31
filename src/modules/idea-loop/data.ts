import type { SuggestKind } from "@/ai/tasks/suggest-facts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

export type FactSuggestion = { id: string; kind: SuggestKind; value: string; reason: string; stepTitle: string | null };

/** Gusty's pending suggestions for the idea, from finished steps. Owner only (RLS). */
export async function getSuggestions(projectId: string): Promise<FactSuggestion[]> {
  if (!isProjectId(projectId)) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("fact_suggestions").select("id, kind, value, reason, next_steps(title)")
    .eq("project_id", projectId).eq("status", "pending").order("created_at");
  return (data ?? []).map((s) => ({
    id: s.id, kind: s.kind as SuggestKind, value: s.value, reason: s.reason,
    stepTitle: (s.next_steps as { title: string } | null)?.title ?? null,
  }));
}
