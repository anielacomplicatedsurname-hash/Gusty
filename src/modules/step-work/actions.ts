"use server";

import { aiProvider } from "@/ai";
import { projectContext } from "@/ai/tasks/context";
import {
  MAX_QUESTIONS, normaliseQuestions, REPHRASE_PROMPT, RephraseSchema, rephraseMessage, STEP_QUESTIONS_PROMPT,
  STEP_QUESTIONS_PROMPT_VERSION, STEP_REPHRASE_PROMPT_VERSION, StepQuestionsSchema, stepQuestionsMessage,
  type StepQuestion,
} from "@/ai/tasks/step-work";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

export type WorkResult = { ok: true } | { ok: false; error: "unavailable" | "busy" | "declined" | "invalid" | "error" | "limit" };
type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

const failed = (reason: string): WorkResult => ({
  ok: false,
  error: reason === "key" ? "unavailable" : (reason as Exclude<WorkResult, { ok: true }>["error"]),
});

async function loadStep(supabase: Supabase, stepId: string) {
  const { data: step } = await supabase.from("next_steps").select("id, project_id, title, detail, status").eq("id", stepId).maybeSingle();
  if (!step || step.status === "replaced") return null;
  const [{ data: project }, { data: facts }, { data: questions }] = await Promise.all([
    supabase.from("projects").select("title, idea").eq("id", step.project_id).maybeSingle(),
    supabase.from("project_facts").select("kind, value").eq("project_id", step.project_id).order("position"),
    supabase.from("step_questions").select("id, question, answer, status").eq("step_id", stepId).order("created_at"),
  ]);
  if (!project) return null;
  return { step, context: projectContext(project.title, project.idea, facts ?? []), questions: questions ?? [] };
}

/** Asks Gusty for questions to fill the free places (up to three in total). Answered questions always stay. */
async function addQuestions(supabase: Supabase, stepId: string, lang: string): Promise<WorkResult> {
  const loaded = await loadStep(supabase, stepId);
  if (!loaded) return { ok: false, error: "error" };
  const { step, context, questions } = loaded;
  const active = questions.filter((q) => q.status === "active");
  const free = MAX_QUESTIONS - active.length;
  if (free <= 0) return { ok: true };
  const seen = questions.map((q) => q.question);

  let fresh: StepQuestion[];
  const provider = aiProvider();
  if (!provider) {
    // Demo: the example questions, then their other wordings, so "Different questions" has something new.
    const demo = messagesFor(lang).stepWork.demoQuestions;
    fresh = normaliseQuestions([...demo, ...demo.map((d) => ({ question: d.alt, hint: d.hint }))], free, seen);
    await logRun(supabase, { projectId: step.project_id, task: "step_questions", promptVersion: STEP_QUESTIONS_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const answered = questions.filter((q) => q.answer.trim()).map((q) => ({ question: q.question, answer: q.answer }));
    const result = await provider.generate({
      system: STEP_QUESTIONS_PROMPT,
      user: stepQuestionsMessage(context, step, answered, seen),
      schema: StepQuestionsSchema,
      effort: "low",
    });
    await logRun(supabase, {
      projectId: step.project_id, task: "step_questions", promptVersion: STEP_QUESTIONS_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return failed(result.reason);
    fresh = normaliseQuestions(result.data.questions, free, seen);
  }
  if (fresh.length === 0) return active.length > 0 ? { ok: true } : { ok: false, error: "invalid" };

  const { error } = await supabase.from("step_questions").insert(
    fresh.map((q, i) => ({ step_id: step.id, project_id: step.project_id, question: q.question, hint: q.hint, position: active.length + i })),
  );
  return error ? { ok: false, error: "error" } : { ok: true };
}

/** Called when the step page opens: prepares questions only if there are none yet. */
export async function prepareQuestions(stepId: string, lang: string): Promise<WorkResult> {
  if (!isProjectId(stepId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { count } = await supabase
    .from("step_questions").select("id", { count: "exact", head: true }).eq("step_id", stepId).eq("status", "active");
  if ((count ?? 0) > 0) return { ok: true };
  return addQuestions(supabase, stepId, lang);
}

/** "Different questions": swaps the unanswered questions for new ones. The person's answers stay. */
export async function differentQuestions(stepId: string, lang: string): Promise<WorkResult> {
  if (!isProjectId(stepId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { error } = await supabase
    .from("step_questions").update({ status: "replaced" }).eq("step_id", stepId).eq("status", "active").eq("answer", "");
  if (error) return { ok: false, error: "error" };
  return addQuestions(supabase, stepId, lang);
}

/** "Say it differently": rewords one question, keeping its meaning and any answer. */
export async function rephraseQuestion(questionId: string, lang: string): Promise<WorkResult> {
  if (!isProjectId(questionId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { data: q } = await supabase.from("step_questions").select("id, step_id, project_id, question").eq("id", questionId).maybeSingle();
  if (!q) return { ok: false, error: "error" };

  let next: StepQuestion;
  const provider = aiProvider();
  if (!provider) {
    const demo = messagesFor(lang).stepWork.demoQuestions.find((d) => d.question === q.question || d.alt === q.question);
    next = demo ? { question: demo.question === q.question ? demo.alt : demo.question, hint: demo.hint } : { question: q.question, hint: "" };
    await logRun(supabase, { projectId: q.project_id, task: "step_rephrase", promptVersion: STEP_REPHRASE_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const loaded = await loadStep(supabase, q.step_id);
    if (!loaded) return { ok: false, error: "error" };
    const result = await provider.generate({
      system: REPHRASE_PROMPT, user: rephraseMessage(loaded.context, loaded.step.title, [q.question]), schema: RephraseSchema, effort: "low",
    });
    await logRun(supabase, {
      projectId: q.project_id, task: "step_rephrase", promptVersion: STEP_REPHRASE_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return failed(result.reason);
    const [tidy] = normaliseQuestions([result.data], 1);
    if (!tidy) return { ok: false, error: "invalid" };
    next = tidy;
  }
  const { error } = await supabase.from("step_questions").update({ question: next.question, hint: next.hint }).eq("id", q.id);
  return error ? { ok: false, error: "error" } : { ok: true };
}

export type SaveResult = { ok: boolean };

export async function saveAnswer(questionId: string, raw: string): Promise<SaveResult> {
  if (!isProjectId(questionId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase
    .from("step_questions").update({ answer: raw.trim().slice(0, 2000) }).eq("id", questionId).select("id").maybeSingle();
  return { ok: !error && !!data };
}

export async function saveNotes(stepId: string, raw: string): Promise<SaveResult> {
  if (!isProjectId(stepId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase
    .from("next_steps").update({ notes: raw.slice(0, 4000) }).eq("id", stepId).select("id").maybeSingle();
  return { ok: !error && !!data };
}
