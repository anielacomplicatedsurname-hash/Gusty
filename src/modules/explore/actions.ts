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
import { loadWorkedOut } from "@/modules/step-work/data";
import { SEARCHES_PER_PERSON_PER_DAY, SEARCHES_PER_PROJECT_PER_DAY } from "./limits";

export type SearchResult = { ok: true } | { ok: false; error: "limitProject" | "limitPerson" | "limit" | "unavailable" | "error" };
type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * Starts a deep online search for one project. It runs after the response (a minute or two), and the
 * Explore page shows the results when they're saved. Limited per project and per person each day.
 */
export async function startSearch(projectId: string, rawPlace: string, lang: string): Promise<SearchResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const place = rawPlace.replace(/\s+/g, " ").trim().slice(0, 120);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: project }, forProject, forPerson] = await Promise.all([
    supabase.from("projects").select("id, title, idea").eq("id", projectId).maybeSingle(),
    supabase.from("opportunity_searches").select("id", { count: "exact", head: true })
      .eq("project_id", projectId).neq("status", "failed").gte("created_at", since),
    supabase.from("opportunity_searches").select("id", { count: "exact", head: true }).neq("status", "failed").gte("created_at", since),
  ]);
  if (!project) return { ok: false, error: "error" };
  if ((forProject.count ?? 0) >= SEARCHES_PER_PROJECT_PER_DAY) return { ok: false, error: "limitProject" };
  if ((forPerson.count ?? 0) >= SEARCHES_PER_PERSON_PER_DAY) return { ok: false, error: "limitPerson" };
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
        scale: "", complexity: "", complexityReason: "", fit: "",
      };
      raw = messagesFor(lang).explore.demoResults.map((d) => ({ ...blank, ...d }));
      await logRun(supabase, { projectId: project.id, task: "opportunity_search", promptVersion: SEARCH_PROMPT_VERSION, model: "demo", status: "demo" });
    } else {
      const [{ data: facts }, work] = await Promise.all([
        supabase.from("project_facts").select("kind, value").eq("project_id", project.id).order("position"),
        loadWorkedOut(supabase, project.id),
      ]);
      const result = await provider.generate({
        system: SEARCH_PROMPT,
        user: searchMessage(projectContext(project.title, project.idea, facts ?? [], work), place),
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
          deadline_note: f.deadlineNote, scale: f.scale, complexity: f.complexity,
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
