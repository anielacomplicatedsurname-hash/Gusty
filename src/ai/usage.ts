import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { estimateCostUsd } from "./models";
import type { AiFailure } from "./provider";

type Client = SupabaseClient<Database>;

/** AI calls per person per 24 hours, across all tasks: protects the budget from loops and abuse. */
export const DAILY_AI_LIMIT = 60;

export async function withinDailyLimit(supabase: Client): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_runs")
    .select("id", { count: "exact", head: true })
    .neq("status", "demo")
    .gte("created_at", since);
  return (count ?? 0) < DAILY_AI_LIMIT;
}

export type RunLog = {
  projectId: string;
  task: string;
  promptVersion: string;
  model: string;
  status: "ok" | "demo" | "error" | "declined";
  inputTokens?: number;
  outputTokens?: number;
  failure?: AiFailure;
};

/** Records one AI call: model, tokens and estimated cost. Never the content. */
export async function logRun(supabase: Client, run: RunLog) {
  const inputTokens = run.inputTokens ?? 0;
  const outputTokens = run.outputTokens ?? 0;
  await supabase.from("ai_runs").insert({
    project_id: run.projectId,
    task: run.task,
    model: run.model,
    prompt_version: run.promptVersion,
    status: run.status,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: run.status === "demo" ? 0 : estimateCostUsd(run.model, inputTokens, outputTokens),
    error: run.failure ? (run.failure === "error" ? "other" : run.failure) : null,
  });
}
