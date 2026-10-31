import { aiProvider } from "@/ai";
import type { ExistingFact } from "@/ai/tasks/interpret-idea";
import {
  normaliseSuggestions, planFactChanges, SUGGEST_FACTS_PROMPT, SUGGEST_FACTS_PROMPT_VERSION, SuggestFactsSchema, suggestFactsMessage,
} from "@/ai/tasks/suggest-facts";
import { logRun, withinDailyLimit } from "@/ai/usage";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * After a step is finished: does what the person wrote add to "Here's what I understood", or answer one of
 * its open questions? Gusty fills gaps and updates its own unconfirmed guesses straight away (each change
 * names the step and can be undone), asks before changing anything the person wrote or confirmed, and folds
 * away answered questions. Runs in the background; stays quiet on any failure, without an AI key, or when
 * there's nothing written.
 */
export async function suggestFactUpdates(supabase: Supabase, stepId: string): Promise<void> {
  const provider = aiProvider();
  if (!provider) return;
  const { data: step } = await supabase.from("next_steps").select("id, project_id, title, notes, draft").eq("id", stepId).maybeSingle();
  if (!step) return;
  const [{ data: questions }, { data: factRows }, { data: answeredRows }] = await Promise.all([
    supabase.from("step_questions").select("question, answer").eq("step_id", stepId).eq("status", "active").neq("answer", ""),
    supabase.from("project_facts").select("id, kind, value, source, status").eq("project_id", step.project_id)
      .order("position").order("created_at"),
    supabase.from("fact_suggestions").select("fact_id").eq("project_id", step.project_id).eq("kind", "question").eq("status", "applied"),
  ]);
  const answers = (questions ?? []).filter((q) => q.answer.trim());
  if (answers.length === 0 && !step.notes.trim() && !step.draft.trim()) return;
  if (!(await withinDailyLimit(supabase))) return;

  const answeredIds = new Set((answeredRows ?? []).map((r) => r.fact_id));
  // Open questions already answered in an earlier step aren't asked about again.
  const facts = ((factRows ?? []) as ExistingFact[]).filter((f) => f.kind !== "question" || !answeredIds.has(f.id));
  const open = facts.filter((f) => f.kind === "question").map((f) => f.value);

  const result = await provider.generate({
    system: SUGGEST_FACTS_PROMPT,
    user: suggestFactsMessage(facts, { title: step.title, answers, notes: step.notes.trim(), draft: step.draft.trim() }, open),
    schema: SuggestFactsSchema,
    effort: "low",
  });
  await logRun(supabase, {
    projectId: step.project_id, task: "suggest_facts", promptVersion: SUGGEST_FACTS_PROMPT_VERSION, model: result.model,
    status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
    inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
  });
  if (!result.ok) return;
  const changes = planFactChanges(normaliseSuggestions(result.data.suggestions, facts), result.data.answered, facts);
  const base = { project_id: step.project_id, step_id: step.id };
  // New items go after what Gusty first read (the person's own additions use 99).
  let position = 50;

  for (const c of changes) {
    if (c.action === "ask") {
      await supabase.from("fact_suggestions").insert({ ...base, kind: c.kind, value: c.value, reason: c.reason });
    } else if (c.action === "answer") {
      await supabase.from("fact_suggestions").insert({ ...base, kind: "question", value: c.value, status: "applied", fact_id: c.factId });
    } else if (c.action === "replace") {
      const { error } = await supabase.from("project_facts").update({ value: c.value, source: "ai_from_user", status: "proposed" })
        .eq("id", c.factId).eq("status", "proposed").neq("source", "user");
      if (error) continue;
      await supabase.from("fact_suggestions").insert({
        ...base, kind: c.kind, value: c.value, reason: c.reason, status: "applied", fact_id: c.factId,
        previous: c.previous, previous_source: c.previousSource,
      });
    } else {
      const { data: added } = await supabase.from("project_facts")
        .insert({ project_id: step.project_id, kind: c.kind, value: c.value, source: "ai_from_user", status: "proposed", position: position++ })
        .select("id").single();
      if (!added) continue;
      await supabase.from("fact_suggestions").insert({
        ...base, kind: c.kind, value: c.value, reason: c.reason, status: "applied", fact_id: added.id,
      });
    }
  }
}
