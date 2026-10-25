"use server";

import type { z } from "zod";
import { aiProvider } from "@/ai";
import type { StructuredResult } from "@/ai/provider";
import { projectContext } from "@/ai/tasks/context";
import {
  DIRECTIONS_PROMPT_VERSION, DIRECTIONS_SYSTEM_PROMPT, DirectionsSchema, normaliseDirections,
} from "@/ai/tasks/directions";
import {
  clip, ExplainSchema, normaliseSteps, SmallerSchema, StartSchema, STEPS_PROMPT_VERSION, STEPS_SYSTEM_PROMPT,
  StepsSchema, stepUserMessage, UNSTICK_PROMPT_VERSION, UNSTICK_PROMPTS, unstickUserMessage, type UnstickKind,
} from "@/ai/tasks/steps";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import { isMode } from "./modes";

export type StepsResult = { ok: true } | { ok: false; error: "unavailable" | "busy" | "declined" | "invalid" | "error" | "limit" };

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function loadProject(supabase: Supabase, projectId: string) {
  const [{ data: project }, { data: facts }] = await Promise.all([
    supabase.from("projects").select("id, title, idea").eq("id", projectId).maybeSingle(),
    supabase.from("project_facts").select("kind, value").eq("project_id", projectId).order("position"),
  ]);
  return project ? { ...project, context: projectContext(project.title, project.idea, facts ?? []) } : null;
}

const failed = (reason: string): StepsResult => ({
  ok: false,
  error: reason === "key" ? "unavailable" : (reason as Exclude<StepsResult, { ok: true }>["error"]),
});

/** Suggests up to three directions, one recommended. Replaces earlier suggestions that weren't chosen. */
export async function suggestDirections(projectId: string, lang: string): Promise<StepsResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "error" };

  const provider = aiProvider();
  let directions;
  if (!provider) {
    directions = messagesFor(lang).steps.demoDirections.map((d, i) => ({ ...d, recommended: i === 0 }));
    await logRun(supabase, { projectId, task: "suggest_directions", promptVersion: DIRECTIONS_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const result = await provider.generate({
      system: DIRECTIONS_SYSTEM_PROMPT, user: project.context, schema: DirectionsSchema, effort: "medium",
    });
    await logRun(supabase, {
      projectId, task: "suggest_directions", promptVersion: DIRECTIONS_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return failed(result.reason);
    directions = normaliseDirections(result.data);
  }
  if (directions.length === 0) return { ok: false, error: "invalid" };

  await supabase.from("project_directions").delete().eq("project_id", projectId).eq("chosen", false);
  const { error } = await supabase
    .from("project_directions")
    .insert(directions.map((d, position) => ({ project_id: projectId, label: d.label, reason: d.reason, recommended: d.recommended, position })));
  return error ? { ok: false, error: "error" } : { ok: true };
}

/**
 * The person picks a direction; Gusty plans small steps for it. Done steps are always kept; open steps
 * from an earlier direction are set aside ("replaced"), never deleted.
 */
export async function chooseDirection(projectId: string, directionId: string, lang: string): Promise<StepsResult> {
  if (!isProjectId(projectId) || !isProjectId(directionId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };

  const { data: direction } = await supabase
    .from("project_directions").select("id, label").eq("id", directionId).eq("project_id", projectId).maybeSingle();
  if (!direction) return { ok: false, error: "error" };
  await supabase.from("project_directions").update({ chosen: false }).eq("project_id", projectId).neq("id", directionId);
  await supabase.from("project_directions").update({ chosen: true }).eq("id", directionId);
  return planSteps(supabase, projectId, direction.id, direction.label, lang);
}

/** More steps for the chosen direction, e.g. when everything shown is done. */
export async function suggestMoreSteps(projectId: string, lang: string): Promise<StepsResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { data: direction } = await supabase
    .from("project_directions").select("id, label").eq("project_id", projectId).eq("chosen", true).maybeSingle();
  if (!direction) return { ok: false, error: "error" };
  return planSteps(supabase, projectId, direction.id, direction.label, lang);
}

async function planSteps(supabase: Supabase, projectId: string, directionId: string, label: string, lang: string): Promise<StepsResult> {
  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "error" };
  const { data: existing } = await supabase.from("next_steps").select("title, status, position").eq("project_id", projectId);
  const done = (existing ?? []).filter((s) => s.status === "done").map((s) => s.title);
  const nextPosition = Math.max(0, ...(existing ?? []).map((s) => s.position + 1));

  const provider = aiProvider();
  let steps;
  if (!provider) {
    steps = messagesFor(lang).steps.demoSteps.map((s) => ({ ...s }));
    await logRun(supabase, { projectId, task: "plan_steps", promptVersion: STEPS_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const result = await provider.generate({
      system: STEPS_SYSTEM_PROMPT, user: stepUserMessage(project.context, label, done), schema: StepsSchema, effort: "medium",
    });
    await logRun(supabase, {
      projectId, task: "plan_steps", promptVersion: STEPS_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return failed(result.reason);
    steps = normaliseSteps(result.data.steps, 7, 120);
  }
  if (steps.length === 0) return { ok: false, error: "invalid" };

  await supabase.from("next_steps").update({ status: "replaced" }).eq("project_id", projectId).eq("status", "open").eq("source", "ai");
  const { error } = await supabase.from("next_steps").insert(
    steps.map((s, i) => ({ project_id: projectId, direction_id: directionId, ...s, source: "ai", position: nextPosition + i })),
  );
  return error ? { ok: false, error: "error" } : { ok: true };
}

/** "I'm stuck": make the step smaller, explain it differently, or help the person start right now. */
export async function unstick(stepId: string, kind: UnstickKind, lang: string): Promise<StepsResult> {
  if (!isProjectId(stepId) || !(kind in UNSTICK_PROMPTS)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { data: step } = await supabase
    .from("next_steps").select("id, project_id, direction_id, title, detail, position, status").eq("id", stepId).maybeSingle();
  if (!step || step.status !== "open") return { ok: false, error: "error" };
  const project = await loadProject(supabase, step.project_id);
  if (!project) return { ok: false, error: "error" };

  const demo = messagesFor(lang).steps.demoUnstick;
  const provider = aiProvider();
  const run = async <S extends z.ZodType>(
    schema: S,
  ): Promise<StructuredResult<z.infer<S>> | { ok: false; reason: "limit" }> => {
    if (!(await withinDailyLimit(supabase))) return { ok: false, reason: "limit" };
    const result = await provider!.generate({
      system: UNSTICK_PROMPTS[kind], user: unstickUserMessage(project.context, step.title, step.detail), schema, effort: "low",
    });
    await logRun(supabase, {
      projectId: step.project_id, task: `unstick_${kind}`, promptVersion: UNSTICK_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    return result;
  };
  if (!provider) {
    await logRun(supabase, { projectId: step.project_id, task: `unstick_${kind}`, promptVersion: UNSTICK_PROMPT_VERSION, model: "demo", status: "demo" });
  }

  if (kind === "smaller") {
    let smaller;
    if (!provider) smaller = demo.smaller.map((s) => ({ ...s }));
    else {
      const result = await run(SmallerSchema);
      if (!result.ok) return result.reason === "limit" ? { ok: false, error: "limit" } : failed(result.reason);
      smaller = normaliseSteps(result.data.steps, 3, 15);
    }
    if (smaller.length === 0) return { ok: false, error: "invalid" };
    // The big step is set aside, not deleted; the smaller ones take its place in the order,
    // and the steps after it move down to make room.
    const { data: later } = await supabase
      .from("next_steps")
      .select("id, position")
      .eq("project_id", step.project_id)
      .eq("status", "open")
      .gt("position", step.position);
    for (const s of later ?? []) {
      await supabase.from("next_steps").update({ position: s.position + smaller.length }).eq("id", s.id);
    }
    await supabase.from("next_steps").update({ status: "replaced" }).eq("id", step.id);
    const { error } = await supabase.from("next_steps").insert(
      smaller.map((s, i) => ({
        project_id: step.project_id, direction_id: step.direction_id, ...s, source: "ai", position: step.position + i,
      })),
    );
    return error ? { ok: false, error: "error" } : { ok: true };
  }

  if (kind === "explain") {
    let explanation;
    if (!provider) explanation = demo.explain;
    else {
      const result = await run(ExplainSchema);
      if (!result.ok) return result.reason === "limit" ? { ok: false, error: "limit" } : failed(result.reason);
      explanation = clip(result.data.explanation, 800);
    }
    const { error } = await supabase.from("next_steps").update({ explanation }).eq("id", step.id);
    return error ? { ok: false, error: "error" } : { ok: true };
  }

  let starter;
  if (!provider) starter = demo.start;
  else {
    const result = await run(StartSchema);
    if (!result.ok) return result.reason === "limit" ? { ok: false, error: "limit" } : failed(result.reason);
    starter = [clip(result.data.firstAction, 300), clip(result.data.starter, 1100)].filter(Boolean).join("\n\n");
  }
  const { error } = await supabase.from("next_steps").update({ starter }).eq("id", step.id);
  return error ? { ok: false, error: "error" } : { ok: true };
}

export type SimpleResult = { ok: boolean };

export async function setStepDone(stepId: string, done: boolean): Promise<SimpleResult> {
  if (!isProjectId(stepId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase
    .from("next_steps")
    .update({ status: done ? "done" : "open", done_at: done ? new Date().toISOString() : null })
    .eq("id", stepId)
    .in("status", ["open", "done"])
    .select("id")
    .maybeSingle();
  return { ok: !error && !!data };
}

/** The person adds a step in their own words; it goes after the current open steps. */
export async function addOwnStep(projectId: string, rawTitle: string): Promise<SimpleResult> {
  const title = rawTitle.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!isProjectId(projectId) || !title) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: existing } = await supabase.from("next_steps").select("position").eq("project_id", projectId);
  const position = Math.max(0, ...(existing ?? []).map((s) => s.position + 1));
  const { error } = await supabase.from("next_steps").insert({ project_id: projectId, title, source: "user", position });
  return { ok: !error };
}

export async function removeStep(stepId: string): Promise<SimpleResult> {
  if (!isProjectId(stepId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("next_steps").update({ status: "replaced" }).eq("id", stepId);
  return { ok: !error };
}

/** Saves how much the person wants to see. Never changes any project data. */
export async function setMode(mode: string): Promise<SimpleResult> {
  if (!isMode(mode)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("user_preferences").upsert({ experience_mode: mode }, { onConflict: "user_id" });
  return { ok: !error };
}
