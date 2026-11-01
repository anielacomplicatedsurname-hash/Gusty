"use server";

import { after } from "next/server";
import { aiProvider } from "@/ai";
import { projectContext } from "@/ai/tasks/context";
import {
  normaliseFound, SEARCH_PROMPT, SEARCH_PROMPT_VERSION, SearchSchema, searchMessage, type FoundRaw,
} from "@/ai/tasks/opportunity-search";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import { loadDocuments } from "@/modules/documents/data";
import { loadWorkedOut } from "@/modules/step-work/data";
import { searchAllowance } from "./limits";

export type SearchResult = { ok: true } | { ok: false; error: "limitMonth" | "limit" | "unavailable" | "error" };
type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * Starts a deep online search for one project. It runs after the response (a minute or two), and the
 * Explore page shows the results when they're saved. The free plan allows one a month, plus one after feedback.
 */
export async function startSearch(projectId: string, rawPlace: string, lang: string): Promise<SearchResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const place = rawPlace.replace(/\s+/g, " ").trim().slice(0, 120);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };

  const [{ data: project }, allowance] = await Promise.all([
    supabase.from("projects").select("id, title, idea").eq("id", projectId).maybeSingle(),
    searchAllowance(supabase),
  ]);
  if (!project) return { ok: false, error: "error" };
  if (allowance.left <= 0) return { ok: false, error: "limitMonth" };
  const provider = aiProvider();
  if (provider && !(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };

  const { data: search, error } = await supabase
    .from("opportunity_searches").insert({ project_id: projectId, place }).select("id").single();
  if (error || !search) return { ok: false, error: "error" };

  after(() => runSearch(supabase, project, search.id, place, lang));
  return { ok: true };
}

async function runSearch(supabase: Supabase, project: { id: string; title: string; idea: string }, searchId: string, place: string, lang: string) {
  const finish = (status: "done" | "failed") =>
    supabase.from("opportunity_searches").update({ status, finished_at: new Date().toISOString() }).eq("id", searchId);
  try {
    const provider = aiProvider();
    let raw: FoundRaw[];
    if (!provider) {
      // Demo: clearly labelled made-up examples, so the layout can be seen without an AI key.
      const blank: FoundRaw = {
        title: "", funder: "", url: "", summary: "", whoFor: "", amount: "", deadline: "", deadlineNote: "",
        kind: "other", scale: "", complexity: "", complexityReason: "", fit: "",
      };
      raw = messagesFor(lang).explore.demoResults.map((d) => ({ ...blank, ...d }));
      await logRun(supabase, { projectId: project.id, task: "opportunity_search", promptVersion: SEARCH_PROMPT_VERSION, model: "demo", status: "demo" });
    } else {
      const [{ data: facts }, work, docs] = await Promise.all([
        supabase.from("project_facts").select("kind, value").eq("project_id", project.id).order("position"),
        loadWorkedOut(supabase, project.id),
        loadDocuments(supabase, project.id),
      ]);
      const result = await provider.generate({
        system: SEARCH_PROMPT,
        user: searchMessage(projectContext(project.title, project.idea, facts ?? [], work, docs), place),
        schema: SearchSchema,
        effort: "medium",
        maxTokens: 16000,
        webSearch: { maxUses: 12 },
        webFetch: { maxUses: 8 },
        timeoutMs: 5 * 60 * 1000,
        maxContinuations: 4,
      });
      await logRun(supabase, {
        projectId: project.id, task: "opportunity_search", promptVersion: SEARCH_PROMPT_VERSION, model: result.model,
        status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, webSearches: result.webSearches,
        failure: result.ok ? undefined : result.reason,
      });
      if (!result.ok) return void (await finish("failed"));
      raw = result.data.opportunities;
    }
    const found = normaliseFound(raw);
    if (found.length > 0) {
      const { error } = await supabase.from("found_opportunities").insert(
        found.map((f, rank) => ({
          search_id: searchId, project_id: project.id, rank, title: f.title, funder: f.funder, url: f.url,
          summary: f.summary, who_for: f.whoFor, amount: f.amount, deadline: f.deadline || null,
          deadline_note: f.deadlineNote, kind: f.kind, scale: f.scale, complexity: f.complexity,
          complexity_reason: f.complexityReason, fit: f.fit,
        })),
      );
      if (error) {
        console.error("Saving search results failed:", error.message);
        return void (await finish("failed"));
      }
    }
    await finish("done");
  } catch (error) {
    console.error("Opportunity search failed:", error);
    await finish("failed");
  }
}

/** Saves a result to the project, or removes it from saved. */
export async function setSaved(foundId: string, saved: boolean): Promise<{ ok: boolean }> {
  if (!isProjectId(foundId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase
    .from("found_opportunities").update({ saved_at: saved ? new Date().toISOString() : null }).eq("id", foundId).select("id").maybeSingle();
  return { ok: !error && !!data };
}

/** Turns a saved opportunity into a small step in the project's current stage: check whether you can apply. */
export async function addCheckStep(foundId: string, lang: string): Promise<{ ok: boolean }> {
  if (!isProjectId(foundId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: found } = await supabase.from("found_opportunities").select("project_id, title, funder, url").eq("id", foundId).maybeSingle();
  if (!found) return { ok: false };
  const [{ data: existing }, { data: stage }] = await Promise.all([
    supabase.from("next_steps").select("position").eq("project_id", found.project_id),
    supabase.from("project_stages").select("id").eq("project_id", found.project_id).eq("status", "current").maybeSingle(),
  ]);
  const t = messagesFor(lang).projects;
  const title = t.checkStep.replace("{title}", found.title).slice(0, 160);
  const detail = [found.funder, found.url].filter(Boolean).join(" · ").slice(0, 500);
  const { error } = await supabase.from("next_steps").insert({
    project_id: found.project_id, stage_id: stage?.id ?? null, title, detail, source: "user",
    position: Math.max(0, ...(existing ?? []).map((s) => s.position + 1)),
  });
  return { ok: !error };
}
