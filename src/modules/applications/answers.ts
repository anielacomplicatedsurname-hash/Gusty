"use server";

import { aiProvider } from "@/ai";
import {
  checkFunderWords, DRAFT_PROMPT_VERSION, IMPROVE_PROMPT_VERSION, improvePrompt, DRAFT_STYLES, DraftSchema, DRAFTS_PER_PERSON_PER_DAY, draftMessage, draftPrompt, funderText,
  normaliseDraft, type DraftStyle, type Gap,
} from "@/ai/tasks/draft-answer";
import type { MaterialReading } from "@/ai/tasks/funder-material";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import type { Material } from "./data";
import { describeVoice } from "@/modules/bank/actions";
import { loadProjectInputs } from "./process";
import { questionsOf } from "./questions";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type DraftResult =
  | { ok: true; answer: string; gaps: Gap[]; funderWords: string[]; demo: boolean }
  | { ok: false; error: "limit" | "busy" | "declined" | "unavailable" | "error" };

async function loadQuestion(supabase: Supabase, appId: string, key: string) {
  const [{ data: app }, { data: materials }, { data: existing }] = await Promise.all([
    supabase.from("applications").select("id, project_id, title").eq("id", appId).maybeSingle(),
    supabase.from("application_materials").select("reading").eq("application_id", appId).order("created_at"),
    supabase.from("application_answers").select("id, answer").eq("application_id", appId).eq("question_key", key).maybeSingle(),
  ]);
  if (!app) return null;
  const readings = (materials ?? []).map((m) => m.reading as MaterialReading);
  const question = questionsOf(readings.map((reading) => ({ reading }) as Material)).find((q) => q.key === key);
  return question ? { app, readings, question, existing } : null;
}

async function store(
  supabase: Supabase, found: NonNullable<Awaited<ReturnType<typeof loadQuestion>>>,
  row: { answer: string; source: "ai" | "user"; gaps?: Gap[]; drafted?: boolean; style?: DraftStyle; funderWords?: string[] },
): Promise<boolean> {
  const values = {
    answer: row.answer, source: row.source,
    ...(row.gaps ? { gaps: row.gaps } : {}),
    ...(row.style ? { style: row.style } : {}),
    ...(row.funderWords ? { funder_words: row.funderWords } : {}),
    ...(row.drafted ? { drafted_at: new Date().toISOString() } : {}),
  };
  if (found.existing) {
    return !(await supabase.from("application_answers").update(values).eq("id", found.existing.id)).error;
  }
  return !(await supabase.from("application_answers").insert({
    application_id: found.app.id, project_id: found.app.project_id, question_key: found.question.key,
    question: found.question.question.slice(0, 600), ...values,
  })).error;
}

/**
 * Gusty drafts one answer in the person's voice, from their project and story, using the funder's key phrases
 * where they fit. Anything their material doesn't show is left [in brackets] and listed, never made up.
 */
export async function draftAnswer(appId: string, key: string, lang: string, rawStyle: string = "funder"): Promise<DraftResult> {
  if (!isProjectId(appId) || !key) return { ok: false, error: "error" };
  const style: DraftStyle = (DRAFT_STYLES as readonly string[]).includes(rawStyle) ? (rawStyle as DraftStyle) : "funder";
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const found = await loadQuestion(supabase, appId, key);
  if (!found) return { ok: false, error: "error" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("ai_runs").select("id", { count: "exact", head: true })
    .eq("task", "draft_answer").gte("created_at", since);
  if ((count ?? 0) >= DRAFTS_PER_PERSON_PER_DAY) return { ok: false, error: "limit" };

  const provider = aiProvider();
  let draft: ReturnType<typeof normaliseDraft>;
  let demo = false;
  if (!provider) {
    const t = messagesFor(lang).applications;
    const text = style === "funder" ? t.demoDraftFunder : t.demoDraft;
    draft = {
      draft: text, gaps: [{ missing: t.demoGap, suggestion: t.demoGapSuggestion }],
      funderWords: checkFunderWords([t.demoFunderWord], text, funderText(found.readings)),
    };
    demo = true;
    await logRun(supabase, { projectId: found.app.project_id, task: "draft_answer", promptVersion: DRAFT_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const inputs = await loadProjectInputs(supabase, found.app.project_id);
    if (!inputs) return { ok: false, error: "error" };
    const result = await provider.generate({
      system: draftPrompt(style, lang),
      user: draftMessage(inputs.context, inputs.bank, { title: found.app.title, readings: found.readings }, found.question, found.existing?.answer ?? ""),
      schema: DraftSchema,
      effort: "medium",
      maxTokens: 4000,
      timeoutMs: 2 * 60 * 1000,
    });
    await logRun(supabase, {
      projectId: found.app.project_id, task: "draft_answer", promptVersion: DRAFT_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) {
      return { ok: false, error: result.reason === "busy" ? "busy" : result.reason === "declined" ? "declined" : result.reason === "key" ? "unavailable" : "error" };
    }
    draft = normaliseDraft(result.data, funderText(found.readings));
    if (!draft.draft) return { ok: false, error: "error" };
  }
  const saved = await store(supabase, found, {
    answer: draft.draft, source: "ai", gaps: draft.gaps, drafted: true, style, funderWords: draft.funderWords,
  });
  return saved ? { ok: true, answer: draft.draft, gaps: draft.gaps, funderWords: draft.funderWords, demo } : { ok: false, error: "error" };
}

/** The person writes or edits an answer: it becomes theirs. */
export async function saveAnswer(appId: string, key: string, raw: string): Promise<{ ok: boolean }> {
  if (!isProjectId(appId) || !key) return { ok: false };
  const answer = raw.replace(/[ \t]+$/gm, "").trim().slice(0, 10000);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const found = await loadQuestion(supabase, appId, key);
  if (!found) return { ok: false };
  return { ok: await store(supabase, found, { answer, source: "user" }) };
}

/**
 * "Improve it with Gusty": keeps what the person wrote and makes it answer the question and speak to the
 * funder (or sound more like them), within the limit. Saved as Gusty's version; they can undo it.
 */
export async function improveAnswer(appId: string, key: string, rawText: string, lang: string, rawStyle: string = "funder"): Promise<DraftResult> {
  if (!isProjectId(appId) || !key) return { ok: false, error: "error" };
  const text = rawText.trim().slice(0, 10000);
  if (!text) return { ok: false, error: "error" };
  const style: DraftStyle = (DRAFT_STYLES as readonly string[]).includes(rawStyle) ? (rawStyle as DraftStyle) : "funder";
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const found = await loadQuestion(supabase, appId, key);
  if (!found) return { ok: false, error: "error" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("ai_runs").select("id", { count: "exact", head: true })
    .in("task", ["draft_answer", "improve_answer"]).gte("created_at", since);
  if ((count ?? 0) >= DRAFTS_PER_PERSON_PER_DAY) return { ok: false, error: "limit" };

  const provider = aiProvider();
  let result: ReturnType<typeof normaliseDraft>;
  let demo = false;
  if (!provider) {
    const t = messagesFor(lang).applications;
    result = { draft: `${t.demoImprovePrefix}\n\n${text}`, gaps: [], funderWords: [] };
    demo = true;
    await logRun(supabase, { projectId: found.app.project_id, task: "improve_answer", promptVersion: IMPROVE_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    if (style === "mine") {
      const { data: voice } = await supabase.from("project_voice").select("project_id").eq("project_id", found.app.project_id).maybeSingle();
      if (!voice) await describeVoice(found.app.project_id, lang);
    }
    const inputs = await loadProjectInputs(supabase, found.app.project_id);
    if (!inputs) return { ok: false, error: "error" };
    const generated = await provider.generate({
      system: improvePrompt(style, lang),
      user: draftMessage(inputs.context, inputs.bank, { title: found.app.title, readings: found.readings }, found.question, text),
      schema: DraftSchema,
      effort: "medium",
      maxTokens: 4000,
      timeoutMs: 2 * 60 * 1000,
    });
    await logRun(supabase, {
      projectId: found.app.project_id, task: "improve_answer", promptVersion: IMPROVE_PROMPT_VERSION, model: generated.model,
      status: generated.ok ? "ok" : generated.reason === "declined" ? "declined" : "error",
      inputTokens: generated.inputTokens, outputTokens: generated.outputTokens, failure: generated.ok ? undefined : generated.reason,
    });
    if (!generated.ok) {
      return { ok: false, error: generated.reason === "busy" ? "busy" : generated.reason === "declined" ? "declined" : generated.reason === "key" ? "unavailable" : "error" };
    }
    result = normaliseDraft(generated.data, funderText(found.readings));
    if (!result.draft) return { ok: false, error: "error" };
  }
  const saved = await store(supabase, found, {
    answer: result.draft, source: "ai", gaps: result.gaps, drafted: true, style, funderWords: result.funderWords,
  });
  return saved ? { ok: true, answer: result.draft, gaps: result.gaps, funderWords: result.funderWords, demo } : { ok: false, error: "error" };
}
