import { aiProvider } from "@/ai";
import {
  normaliseSuggestions, SUGGEST_FACTS_PROMPT, SUGGEST_FACTS_PROMPT_VERSION, SuggestFactsSchema, suggestFactsMessage,
} from "@/ai/tasks/suggest-facts";
import { logRun, withinDailyLimit } from "@/ai/usage";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * After a step is finished: does what the person wrote add anything to "Here's what I understood"? If so,
 * Gusty saves up to three suggestions for them to use or ignore. Runs in the background; stays quiet on any
 * failure, without an AI key, or when there's nothing written.
 */
export async function suggestFactUpdates(supabase: Supabase, stepId: string): Promise<void> {
  const provider = aiProvider();
  if (!provider) return;
  const { data: step } = await supabase.from("next_steps").select("id, project_id, title, notes, draft").eq("id", stepId).maybeSingle();
  if (!step) return;
  const [{ data: questions }, { data: facts }] = await Promise.all([
    supabase.from("step_questions").select("question, answer").eq("step_id", stepId).eq("status", "active").neq("answer", ""),
    supabase.from("project_facts").select("kind, value").eq("project_id", step.project_id),
  ]);
  const answers = (questions ?? []).filter((q) => q.answer.trim());
  if (answers.length === 0 && !step.notes.trim() && !step.draft.trim()) return;
  if (!(await withinDailyLimit(supabase))) return;

  const result = await provider.generate({
    system: SUGGEST_FACTS_PROMPT,
    user: suggestFactsMessage(facts ?? [], { title: step.title, answers, notes: step.notes.trim(), draft: step.draft.trim() }),
    schema: SuggestFactsSchema,
    effort: "low",
  });
  await logRun(supabase, {
    projectId: step.project_id, task: "suggest_facts", promptVersion: SUGGEST_FACTS_PROMPT_VERSION, model: result.model,
    status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
    inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
  });
  if (!result.ok) return;
  const suggestions = normaliseSuggestions(result.data.suggestions, facts ?? []);
  if (suggestions.length === 0) return;
  await supabase.from("fact_suggestions").insert(
    suggestions.map((s) => ({ project_id: step.project_id, step_id: step.id, kind: s.kind, value: s.value, reason: s.reason })),
  );
}
