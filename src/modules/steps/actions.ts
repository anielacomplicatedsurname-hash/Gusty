"use server";

import type { z } from "zod";
import { aiProvider } from "@/ai";
import type { StructuredResult } from "@/ai/provider";
import { projectContext } from "@/ai/tasks/context";
import {
  DIRECTIONS_PROMPT_VERSION, DIRECTIONS_SYSTEM_PROMPT, DirectionsSchema, normaliseDirections,
} from "@/ai/tasks/directions";
import {
  clip, ExplainSchema, normaliseStage, normaliseSteps, SmallerSchema, StartSchema, STEPS_PROMPT_VERSION,
  STEPS_SYSTEM_PROMPT, StepsSchema, stepUserMessage, UNSTICK_PROMPT_VERSION, UNSTICK_PROMPTS, unstickUserMessage,
  type UnstickKind, MOOD_STEP_PROMPT_VERSION, moodStepMessage, moodStepPrompt,
} from "@/ai/tasks/steps";
import { isMood } from "./mood";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import { after } from "next/server";
import { loadDocuments } from "@/modules/documents/data";
import { suggestFactUpdates } from "@/modules/idea-loop/suggest";
import { loadWorkedOut } from "@/modules/step-work/data";
import { isMode } from "./modes";

export type StepsResult = { ok: true } | { ok: false; error: "unavailable" | "busy" | "declined" | "invalid" | "error" | "limit" };

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

async function loadProject(supabase: Supabase, projectId: string) {
  const [{ data: project }, { data: facts }, work, docs] = await Promise.all([
    supabase.from("projects").select("id, title, idea").eq("id", projectId).maybeSingle(),
    supabase.from("project_facts").select("kind, value").eq("project_id", projectId).order("position"),
    loadWorkedOut(supabase, projectId),
    loadDocuments(supabase, projectId),
  ]);
  return project ? { ...project, context: projectContext(project.title, project.idea, facts ?? [], work, docs) } : null;
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
 * The person picks a direction; Gusty plans the first stage for it. Done steps are always kept; open
 * steps Gusty suggested for an earlier direction are set aside ("replaced"), never deleted.
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
  return planStage(supabase, projectId, direction.id, direction.label, lang);
}

/**
 * "Plan the next stage", offered once every step in the current stage is done. Gusty plans it from
 * everything done and worked out so far, so the plan can change as the idea grows.
 */
export async function planNextStage(projectId: string, lang: string): Promise<StepsResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { data: direction } = await supabase
    .from("project_directions").select("id, label").eq("project_id", projectId).eq("chosen", true).maybeSingle();
  if (!direction) return { ok: false, error: "error" };
  const { data: current } = await supabase
    .from("project_stages").select("id").eq("project_id", projectId).eq("status", "current").maybeSingle();
  if (current) {
    const { count } = await supabase
      .from("next_steps").select("id", { count: "exact", head: true }).eq("stage_id", current.id).eq("status", "open");
    if ((count ?? 0) > 0) return { ok: false, error: "error" };
  }
  return planStage(supabase, projectId, direction.id, direction.label, lang);
}

async function planStage(supabase: Supabase, projectId: string, directionId: string, label: string, lang: string): Promise<StepsResult> {
  const project = await loadProject(supabase, projectId);
  if (!project) return { ok: false, error: "error" };
  const [{ data: stages }, { data: existing }] = await Promise.all([
    supabase.from("project_stages").select("id, title, status, position").eq("project_id", projectId).order("position"),
    supabase.from("next_steps").select("title, status, position, stage_id").eq("project_id", projectId),
  ]);
  const steps = existing ?? [];
  const doneIn = (stageId: string) => steps.filter((st) => st.stage_id === stageId && st.status === "done").map((st) => st.title);
  const current = (stages ?? []).find((st) => st.status === "current");
  // The stage being left counts as done if anything in it was done; otherwise it's set aside.
  const leaving = current ? { id: current.id, finished: doneIn(current.id).length > 0 } : null;
  const earlier = (stages ?? [])
    .filter((st) => st.status === "done" || (st.id === leaving?.id && leaving.finished))
    .map((st) => ({ title: st.title, done: doneIn(st.id) }));
  const nextPosition = Math.max(0, ...steps.map((st) => st.position + 1));
  const stagePosition = Math.max(0, ...(stages ?? []).map((st) => st.position + 1));

  const provider = aiProvider();
  let stage;
  if (!provider) {
    const demo = messagesFor(lang).steps.demoStages;
    const d = demo[Math.min(earlier.length, demo.length - 1)];
    stage = { title: d.title, steps: d.steps.map((st) => ({ ...st })), later: [...d.later] };
    await logRun(supabase, { projectId, task: "plan_steps", promptVersion: STEPS_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const result = await provider.generate({
      system: STEPS_SYSTEM_PROMPT, user: stepUserMessage(project.context, label, earlier), schema: StepsSchema, effort: "medium",
    });
    await logRun(supabase, {
      projectId, task: "plan_steps", promptVersion: STEPS_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return failed(result.reason);
    stage = normaliseStage(result.data, label);
  }
  if (stage.steps.length === 0) return { ok: false, error: "invalid" };

  // Only now that the new stage is ready does anything change.
  if (leaving) {
    await supabase.from("project_stages")
      .update(leaving.finished ? { status: "done", done_at: new Date().toISOString() } : { status: "set_aside" })
      .eq("id", leaving.id);
  }
  await supabase.from("next_steps").update({ status: "replaced" }).eq("project_id", projectId).eq("status", "open").eq("source", "ai");
  const { data: created, error: stageError } = await supabase
    .from("project_stages")
    .insert({ project_id: projectId, direction_id: directionId, title: stage.title, later: stage.later, position: stagePosition })
    .select("id")
    .single();
  if (stageError || !created) return { ok: false, error: "error" };
  // The person's own open steps come along to the new stage.
  await supabase.from("next_steps").update({ stage_id: created.id }).eq("project_id", projectId).eq("status", "open").eq("source", "user");
  const { error } = await supabase.from("next_steps").insert(
    stage.steps.map((st, i) => ({
      project_id: projectId, direction_id: directionId, stage_id: created.id, ...st, source: "ai", position: nextPosition + i,
    })),
  );
  return error ? { ok: false, error: "error" } : { ok: true };
}

/** "I'm stuck": make the step smaller, explain it differently, or help the person start right now. */
export async function unstick(stepId: string, kind: UnstickKind, lang: string): Promise<StepsResult> {
  if (!isProjectId(stepId) || !(kind in UNSTICK_PROMPTS)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { data: step } = await supabase
    .from("next_steps").select("id, project_id, direction_id, stage_id, title, detail, position, status").eq("id", stepId).maybeSingle();
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
        project_id: step.project_id, direction_id: step.direction_id, stage_id: step.stage_id, ...s, source: "ai",
        position: step.position + i,
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
  // A finished step may say something new about the idea: Gusty looks, after responding, and only suggests.
  if (done && data) after(() => suggestFactUpdates(supabase, stepId));
  return { ok: !error && !!data };
}

/** The person adds a step in their own words; it goes after the current open steps. */
export async function addOwnStep(projectId: string, rawTitle: string): Promise<SimpleResult> {
  const title = rawTitle.replace(/\s+/g, " ").trim().slice(0, 160);
  if (!isProjectId(projectId) || !title) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const [{ data: existing }, { data: stage }] = await Promise.all([
    supabase.from("next_steps").select("position").eq("project_id", projectId),
    supabase.from("project_stages").select("id").eq("project_id", projectId).eq("status", "current").maybeSingle(),
  ]);
  const position = Math.max(0, ...(existing ?? []).map((s) => s.position + 1));
  const { error } = await supabase
    .from("next_steps").insert({ project_id: projectId, stage_id: stage?.id ?? null, title, source: "user", position });
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

/**
 * "Suggest a small … step": when nothing in the current stage matches how the person feels today, Gusty
 * adds one step of that kind to the stage. It keeps its kind, so it's found the next time.
 */
export async function suggestMoodStep(projectId: string, mood: string, lang: string): Promise<StepsResult> {
  if (!isProjectId(projectId) || !isMood(mood)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const [project, { data: stage }, { data: steps }] = await Promise.all([
    loadProject(supabase, projectId),
    supabase.from("project_stages").select("id, title, direction_id").eq("project_id", projectId).eq("status", "current").maybeSingle(),
    supabase.from("next_steps").select("title, position").eq("project_id", projectId).neq("status", "replaced"),
  ]);
  if (!project || !stage) return { ok: false, error: "error" };

  const provider = aiProvider();
  let step: { title: string; detail: string; minutes: number } | undefined;
  if (!provider) {
    step = { ...messagesFor(lang).steps.moodDemo[mood] };
    await logRun(supabase, { projectId, task: "mood_step", promptVersion: MOOD_STEP_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const result = await provider.generate({
      system: moodStepPrompt(mood),
      user: moodStepMessage(project.context, stage.title, (steps ?? []).map((s) => s.title)),
      schema: SmallerSchema,
      effort: "low",
    });
    await logRun(supabase, {
      projectId, task: "mood_step", promptVersion: MOOD_STEP_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return failed(result.reason);
    step = normaliseSteps(result.data.steps, 1, 45)[0];
  }
  if (!step?.title) return { ok: false, error: "invalid" };
  const { error } = await supabase.from("next_steps").insert({
    project_id: projectId, direction_id: stage.direction_id, stage_id: stage.id, ...step, source: "ai", mood,
    position: Math.max(0, ...(steps ?? []).map((s) => s.position + 1)),
  });
  return error ? { ok: false, error: "error" } : { ok: true };
}
