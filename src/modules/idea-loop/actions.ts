"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

/** "Use this": the suggestion becomes part of "Here's what I understood", confirmed by the person. */
export async function acceptSuggestion(id: string): Promise<{ ok: boolean }> {
  if (!isProjectId(id)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: s } = await supabase.from("fact_suggestions").select("id, project_id, kind, value, status").eq("id", id).maybeSingle();
  if (!s || s.status !== "pending") return { ok: false };
  const { data: facts } = await supabase.from("project_facts").select("id, kind, position").eq("project_id", s.project_id);
  // Lists ("who it's for", "what it might need") get a new item; single items are replaced.
  const existing = ["summary", "place", "stage"].includes(s.kind) ? (facts ?? []).find((f) => f.kind === s.kind) : undefined;
  const { error } = existing
    ? await supabase.from("project_facts").update({ value: s.value, source: "ai_from_user", status: "confirmed" }).eq("id", existing.id)
    : await supabase.from("project_facts").insert({
        project_id: s.project_id, kind: s.kind, value: s.value, source: "ai_from_user", status: "confirmed",
        position: Math.max(0, ...(facts ?? []).map((f) => f.position + 1)),
      });
  if (error) return { ok: false };
  await supabase.from("fact_suggestions").update({ status: "accepted" }).eq("id", id);
  return { ok: true };
}

/** "Not now": the suggestion goes away; nothing changes. */
export async function dismissSuggestion(id: string): Promise<{ ok: boolean }> {
  if (!isProjectId(id)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("fact_suggestions").update({ status: "dismissed" }).eq("id", id).eq("status", "pending");
  return { ok: !error };
}

/**
 * "Undo" on a change Gusty made from a step: the item goes back to what it was (or away, if Gusty added it),
 * and an answered question comes back. Only while the item still says what Gusty wrote.
 */
export async function undoChange(id: string): Promise<{ ok: boolean }> {
  if (!isProjectId(id)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: s } = await supabase.from("fact_suggestions")
    .select("id, kind, value, status, fact_id, previous, previous_source").eq("id", id).maybeSingle();
  if (!s || s.status !== "applied" || !s.fact_id) return { ok: false };
  if (s.kind !== "question") {
    const { data: fact } = await supabase.from("project_facts").select("id, value, status").eq("id", s.fact_id).maybeSingle();
    if (!fact || fact.value !== s.value || fact.status !== "proposed") return { ok: false };
    const { error } = s.previous === null
      ? await supabase.from("project_facts").delete().eq("id", fact.id)
      : await supabase.from("project_facts")
          .update({ value: s.previous, source: (s.previous_source ?? "ai_suggestion") as "ai_suggestion" }).eq("id", fact.id);
    if (error) return { ok: false };
  }
  // A deleted item takes its change record with it; otherwise mark it undone.
  await supabase.from("fact_suggestions").update({ status: "undone" }).eq("id", id);
  return { ok: true };
}
