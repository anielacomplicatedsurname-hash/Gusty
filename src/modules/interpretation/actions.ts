"use server";

import { aiProvider } from "@/ai";
import { estimateCostUsd } from "@/ai/models";
import {
  demoInterpretation, INTERPRET_PROMPT_VERSION, INTERPRET_SYSTEM_PROMPT, interpretationToFacts,
  InterpretationSchema, interpretUserMessage, normaliseInterpretation, planRefresh,
  type ExistingFact, type FactKind,
} from "@/ai/tasks/interpret-idea";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

/** Readings per person per 24 hours: protects the AI budget from loops and abuse. */
const DAILY_READING_LIMIT = 30;
const FACT_KINDS: FactKind[] = ["summary", "audience", "place", "stage", "need", "question"];
const STAGES = ["just_an_idea", "planning", "started", "running"];

export type InterpretResult =
  | { ok: true }
  | { ok: false; error: "unavailable" | "busy" | "declined" | "invalid" | "error" | "limit" };

/**
 * Asks Gusty to read the project's idea. `first` does nothing if a reading already exists (safe to
 * call on page load); `refresh` replaces only unconfirmed AI items. Uses demo output without a key.
 */
export async function interpretProject(projectId: string, mode: "first" | "refresh", lang: string): Promise<InterpretResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };

  const { data: project } = await supabase
    .from("projects")
    .select("id, idea, title_source")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "error" };

  const { data: existingRows } = await supabase
    .from("project_facts")
    .select("id, kind, value, source, status")
    .eq("project_id", projectId);
  const existing = (existingRows ?? []) as ExistingFact[];
  if (mode === "first" && existing.length > 0) return { ok: true };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_runs")
    .select("id", { count: "exact", head: true })
    .eq("task", "interpret_idea")
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_READING_LIMIT) return { ok: false, error: "limit" };

  const provider = aiProvider();
  const log = (
    status: "ok" | "demo" | "error" | "declined",
    model: string,
    inputTokens = 0,
    outputTokens = 0,
    error: "key" | "busy" | "declined" | "invalid" | "other" | null = null,
  ) =>
    supabase.from("ai_runs").insert({
      project_id: projectId,
      task: "interpret_idea",
      model,
      prompt_version: INTERPRET_PROMPT_VERSION,
      status,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: status === "demo" ? 0 : estimateCostUsd(model, inputTokens, outputTokens),
      error,
    });

  let reading;
  if (!provider) {
    reading = demoInterpretation(project.idea, messagesFor(lang).interpretation.demoQuestions);
    await log("demo", "demo");
  } else {
    const result = await provider.generate({
      system: INTERPRET_SYSTEM_PROMPT,
      user: interpretUserMessage(project.idea),
      schema: InterpretationSchema,
      effort: "medium",
    });
    if (!result.ok) {
      const error = result.reason === "error" ? "other" : result.reason;
      await log(result.reason === "declined" ? "declined" : "error", result.model, result.inputTokens, result.outputTokens, error);
      // People see a calm message; the precise reason is in the usage log for diagnosis.
      return { ok: false, error: result.reason === "key" ? "unavailable" : result.reason };
    }
    await log("ok", result.model, result.inputTokens, result.outputTokens);
    reading = normaliseInterpretation(result.data);
  }

  // Gusty's title replaces the automatic one, but never a title the person chose.
  if (reading.title && project.title_source !== "user") {
    await supabase.from("projects").update({ title: reading.title, title_source: "ai" }).eq("id", projectId);
  }

  const { data: fromSteps } = await supabase
    .from("fact_suggestions").select("fact_id").eq("project_id", projectId).eq("status", "applied");
  const { remove, add } = planRefresh(
    existing, interpretationToFacts(reading), new Set((fromSteps ?? []).flatMap((c) => (c.fact_id ? [c.fact_id] : []))),
  );
  if (remove.length) {
    const { error } = await supabase.from("project_facts").delete().in("id", remove);
    if (error) return { ok: false, error: "error" };
  }
  if (add.length) {
    const { error } = await supabase.from("project_facts").insert(add.map((f) => ({ ...f, project_id: projectId })));
    if (error) {
      console.error("Saving Gusty's reading failed:", error.message);
      return { ok: false, error: "error" };
    }
  }
  return { ok: true };
}

export type FactResult = { ok: boolean };

/** The person rewrites an item: it becomes their words, and confirmed. */
export async function editFact(factId: string, rawValue: string): Promise<FactResult> {
  const value = rawValue.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!isProjectId(factId) || !value) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: fact } = await supabase.from("project_facts").select("kind").eq("id", factId).maybeSingle();
  if (!fact || (fact.kind === "stage" && !STAGES.includes(value))) return { ok: false };
  const { data, error } = await supabase
    .from("project_facts")
    .update({ value, source: "user", status: "confirmed" })
    .eq("id", factId)
    .select("id")
    .maybeSingle();
  return { ok: !error && !!data };
}

export async function removeFact(factId: string): Promise<FactResult> {
  if (!isProjectId(factId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("project_facts").delete().eq("id", factId);
  return { ok: !error };
}

/** The person adds an item in their own words. */
export async function addFact(projectId: string, kind: FactKind, rawValue: string): Promise<FactResult> {
  const value = rawValue.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!isProjectId(projectId) || !FACT_KINDS.includes(kind) || !value) return { ok: false };
  if (kind === "stage" && !STAGES.includes(value)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase
    .from("project_facts")
    .insert({ project_id: projectId, kind, value, source: "user", status: "confirmed", position: 99 });
  return { ok: !error };
}
