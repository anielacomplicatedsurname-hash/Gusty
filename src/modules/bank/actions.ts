"use server";

import { after } from "next/server";
import { aiProvider } from "@/ai";
import { projectContext } from "@/ai/tasks/context";
import { isSafeUrl } from "@/ai/tasks/opportunity-search";
import {
  normaliseSources, RESEARCH_PROMPT, RESEARCH_PROMPT_VERSION, ResearchSchema, researchMessage, type SourceRaw,
} from "@/ai/tasks/research";
import { MIN_VOICE_WORDS, VOICE_PROMPT, VOICE_PROMPT_VERSION, VoiceSchema, voiceDescription, voiceMessage, wordCount } from "@/ai/tasks/voice";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDocuments } from "@/modules/documents/data";
import { isProjectId } from "@/modules/projects/validation";
import { loadWorkedOut } from "@/modules/step-work/data";
import { loadOwnWriting } from "./data";
import { EVIDENCE_KINDS, type EvidenceKind, RESEARCH_PER_PERSON_PER_DAY, RESEARCH_PER_PROJECT_PER_DAY } from "./limits";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type BankResult = { ok: true } | { ok: false; error: "invalid" | "link" | "error" };

const clean = (s: string, max: number) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);

type Checked = { ok: true; row: { kind: EvidenceKind; text: string; url: string } } | { ok: false; error: "invalid" | "link" };

function checkEvidence(kind: string, rawText: string, rawUrl: string): Checked {
  const text = clean(rawText, 1000);
  const url = rawUrl.trim();
  if (!(EVIDENCE_KINDS as readonly string[]).includes(kind) || !text) return { ok: false, error: "invalid" };
  if (url && !isSafeUrl(url)) return { ok: false, error: "link" };
  return { ok: true, row: { kind: kind as EvidenceKind, text, url } };
}

/** The person adds something from their own experience: a past project, a win, a quote, a number. */
export async function addEvidence(projectId: string, kind: string, text: string, url: string): Promise<BankResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const checked = checkEvidence(kind, text, url);
  if (!checked.ok) return checked;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "error" };
  const { error } = await supabase.from("project_evidence").insert({ project_id: projectId, origin: "person", position: 99, ...checked.row });
  return error ? { ok: false, error: "error" } : { ok: true };
}

export async function editEvidence(id: string, kind: string, text: string, url: string): Promise<BankResult> {
  if (!isProjectId(id)) return { ok: false, error: "error" };
  const checked = checkEvidence(kind, text, url);
  if (!checked.ok) return checked;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "error" };
  const { data, error } = await supabase.from("project_evidence").update(checked.row).eq("id", id).eq("origin", "person").select("id").maybeSingle();
  return error || !data ? { ok: false, error: "error" } : { ok: true };
}

/** Removes something from the bank: the person's own item or a research source. */
export async function removeEvidence(id: string): Promise<{ ok: boolean }> {
  if (!isProjectId(id)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { error } = await supabase.from("project_evidence").delete().eq("id", id);
  return { ok: !error };
}

export type ResearchResult = { ok: true } | { ok: false; error: "limitProject" | "limitPerson" | "limit" | "unavailable" | "error" };

/**
 * Starts Gusty's research search: credible studies and statistics that back the idea. It runs after the
 * response (a minute or two); the page checks back. Its own small allowance, per project and per person.
 */
export async function startResearch(projectId: string, lang: string): Promise<ResearchResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: project }, forProject, forPerson] = await Promise.all([
    supabase.from("projects").select("id, title, idea").eq("id", projectId).maybeSingle(),
    supabase.from("research_runs").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).neq("status", "failed").gte("created_at", since),
    supabase.from("research_runs").select("id", { count: "exact", head: true }).neq("status", "failed").gte("created_at", since),
  ]);
  if (!project) return { ok: false, error: "error" };
  if ((forProject.count ?? 0) >= RESEARCH_PER_PROJECT_PER_DAY) return { ok: false, error: "limitProject" };
  if ((forPerson.count ?? 0) >= RESEARCH_PER_PERSON_PER_DAY) return { ok: false, error: "limitPerson" };
  if (aiProvider() && !(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };

  const { data: run, error } = await supabase.from("research_runs").insert({ project_id: projectId }).select("id").single();
  if (error || !run) return { ok: false, error: "error" };
  after(() => runResearch(supabase, project, run.id, lang));
  return { ok: true };
}

async function runResearch(supabase: Supabase, project: { id: string; title: string; idea: string }, runId: string, lang: string) {
  const finish = (status: "done" | "failed") =>
    supabase.from("research_runs").update({ status, finished_at: new Date().toISOString() }).eq("id", runId);
  try {
    const provider = aiProvider();
    let raw: SourceRaw[];
    if (!provider) {
      // Demo: clearly labelled examples, so the layout can be seen without an AI key.
      raw = messagesFor(lang).bank.demoSources.map((d) => ({ year: "", publisher: "", ...d }));
      await logRun(supabase, { projectId: project.id, task: "research", promptVersion: RESEARCH_PROMPT_VERSION, model: "demo", status: "demo" });
    } else {
      const [{ data: facts }, work, docs] = await Promise.all([
        supabase.from("project_facts").select("kind, value").eq("project_id", project.id).order("position"),
        loadWorkedOut(supabase, project.id),
        loadDocuments(supabase, project.id),
      ]);
      const result = await provider.generate({
        system: RESEARCH_PROMPT,
        user: researchMessage(projectContext(project.title, project.idea, facts ?? [], work, docs)),
        schema: ResearchSchema,
        effort: "medium",
        maxTokens: 8000,
        webSearch: { maxUses: 6 },
        webFetch: { maxUses: 5 },
        timeoutMs: 4 * 60 * 1000,
        maxContinuations: 3,
      });
      await logRun(supabase, {
        projectId: project.id, task: "research", promptVersion: RESEARCH_PROMPT_VERSION, model: result.model,
        status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, webSearches: result.webSearches,
        failure: result.ok ? undefined : result.reason,
      });
      if (!result.ok) return void (await finish("failed"));
      raw = result.data.sources;
    }
    const { data: existing } = await supabase.from("project_evidence").select("url").eq("project_id", project.id).eq("origin", "research");
    const known = new Set((existing ?? []).map((e) => e.url.toLowerCase()));
    const fresh = normaliseSources(raw).filter((s) => !known.has(s.url.toLowerCase()));
    if (fresh.length > 0) {
      const foundAt = new Date().toISOString();
      const { error } = await supabase.from("project_evidence").insert(
        fresh.map((s, i) => ({
          project_id: project.id, origin: "research", kind: "research", text: s.finding, title: s.title,
          publisher: s.publisher, year: s.year, relevance: s.relevance, url: s.url, found_at: foundAt, position: i,
        })),
      );
      if (error) {
        console.error("Saving research failed:", error.message);
        return void (await finish("failed"));
      }
    }
    await finish("done");
  } catch (error) {
    console.error("Research failed:", error);
    await finish("failed");
  }
}

export type VoiceResult = { ok: true } | { ok: false; error: "tooShort" | "limit" | "busy" | "declined" | "unavailable" | "error" };

/** Gusty describes how the person writes, from their own words only. */
export async function describeVoice(projectId: string, lang: string): Promise<VoiceResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const writing = await loadOwnWriting(supabase, projectId);
  if (wordCount(writing) < MIN_VOICE_WORDS) return { ok: false, error: "tooShort" };
  const t = messagesFor(lang).bank;
  const provider = aiProvider();
  let description: string;
  if (!provider) {
    description = t.demoVoice;
    await logRun(supabase, { projectId, task: "voice", promptVersion: VOICE_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const result = await provider.generate({ system: VOICE_PROMPT, user: voiceMessage(writing), schema: VoiceSchema, effort: "low" });
    await logRun(supabase, {
      projectId, task: "voice", promptVersion: VOICE_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) {
      return { ok: false, error: result.reason === "busy" ? "busy" : result.reason === "declined" ? "declined" : result.reason === "key" ? "unavailable" : "error" };
    }
    description = voiceDescription(result.data, t.voiceExampleLabel);
    if (!description) return { ok: false, error: "error" };
  }
  return (await writeVoice(supabase, projectId, description, "ai")) ? { ok: true } : { ok: false, error: "error" };
}

/** The person writes or changes the description of their voice: it becomes theirs. */
export async function saveVoice(projectId: string, raw: string): Promise<{ ok: boolean }> {
  if (!isProjectId(projectId)) return { ok: false };
  const description = clean(raw, 1200);
  if (!description) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  return { ok: await writeVoice(supabase, projectId, description, "user") };
}

/** Insert or update, without letting the app change which project a description belongs to. */
async function writeVoice(supabase: Supabase, projectId: string, description: string, source: "ai" | "user"): Promise<boolean> {
  const row = { description, source, updated_at: new Date().toISOString() };
  const { data: updated, error } = await supabase.from("project_voice").update(row).eq("project_id", projectId).select("project_id");
  if (error) return false;
  if (updated && updated.length > 0) return true;
  return !(await supabase.from("project_voice").insert({ project_id: projectId, ...row })).error;
}
