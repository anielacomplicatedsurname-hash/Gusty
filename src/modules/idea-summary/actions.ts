"use server";

import { aiProvider } from "@/ai";
import { projectContext } from "@/ai/tasks/context";
import { normaliseSummary, SUMMARY_PROMPT, SUMMARY_PROMPT_VERSION, SummarySchema, type SummaryRaw } from "@/ai/tasks/idea-summary";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDocuments } from "@/modules/documents/data";
import { isProjectId } from "@/modules/projects/validation";
import { loadWorkedOut } from "@/modules/step-work/data";

export type SummaryResult = { ok: true } | { ok: false; error: "unavailable" | "busy" | "declined" | "invalid" | "error" | "limit" };

/** Writes (or rewrites) Gusty's summary of the project from everything the person has said. */
export async function refreshSummary(projectId: string, lang: string): Promise<SummaryResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const [{ data: project }, { data: facts }, work, docs] = await Promise.all([
    supabase.from("projects").select("id, title, idea").eq("id", projectId).maybeSingle(),
    supabase.from("project_facts").select("kind, value").eq("project_id", projectId).order("position"),
    loadWorkedOut(supabase, projectId),
    loadDocuments(supabase, projectId),
  ]);
  if (!project) return { ok: false, error: "error" };

  let raw: SummaryRaw;
  const provider = aiProvider();
  if (!provider) {
    // Demo: only the person's own words, put side by side, and labelled as a demo on the page.
    const demo = messagesFor(lang).ideaSummary.demo;
    const fact = (kind: string) => (facts ?? []).find((f) => f.kind === kind)?.value;
    raw = {
      summary: `${fact("summary") ?? project.idea.slice(0, 300)} ${demo.note}`,
      points: [fact("audience"), fact("place")].filter((v): v is string => !!v),
    };
    await logRun(supabase, { projectId, task: "idea_summary", promptVersion: SUMMARY_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const result = await provider.generate({
      system: SUMMARY_PROMPT,
      user: projectContext(project.title, project.idea, facts ?? [], work, docs),
      schema: SummarySchema,
      effort: "low",
    });
    await logRun(supabase, {
      projectId, task: "idea_summary", promptVersion: SUMMARY_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return { ok: false, error: result.reason === "key" ? "unavailable" : result.reason };
    raw = result.data;
  }
  const { summary, points } = normaliseSummary(raw);
  if (!summary) return { ok: false, error: "invalid" };
  const row = { summary, points, updated_at: new Date().toISOString() };
  const { data: updated, error } = await supabase.from("project_summaries").update(row).eq("project_id", projectId).select("project_id");
  if (error) return { ok: false, error: "error" };
  if ((updated ?? []).length > 0) return { ok: true };
  const { error: insertError } = await supabase.from("project_summaries").insert({ project_id: projectId, ...row });
  return insertError ? { ok: false, error: "error" } : { ok: true };
}
