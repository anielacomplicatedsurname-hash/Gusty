import { aiProvider } from "@/ai";
import { type BankForFit, FIT_PROMPT, FIT_PROMPT_VERSION, FitSchema, fitMessage, normaliseFit } from "@/ai/tasks/application-fit";
import { projectContext } from "@/ai/tasks/context";
import {
  FUNDER_MATERIAL_PROMPT_VERSION, MaterialSchema, MATERIALS_PER_PERSON_PER_DAY, materialPrompt, normaliseMaterial,
  type MaterialKind, type MaterialRaw, type MaterialReading,
} from "@/ai/tasks/funder-material";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDocuments } from "@/modules/documents/data";
import { loadWorkedOut } from "@/modules/step-work/data";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;
export type MaterialError = "limit" | "unreadable" | "notFunding" | "busy" | "unavailable" | "error";

/** Has this person used today's allowance for bringing in funder papers? */
export async function materialsLeft(supabase: Supabase): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase.from("ai_runs").select("id", { count: "exact", head: true })
    .eq("task", "read_funder_material").gte("created_at", since);
  return (count ?? 0) < MATERIALS_PER_PERSON_PER_DAY;
}

/**
 * Gusty reads one piece of funder material (a PDF, pasted text or a public page) and keeps what it read:
 * never the file. Returns the reading, ready to save, or why it couldn't.
 */
export async function readMaterial(
  supabase: Supabase,
  input: { projectId: string; lang: string; user: string; documents?: { base64: string }[]; fetchLink?: boolean },
): Promise<{ ok: true; reading: MaterialReading; demo: boolean } | { ok: false; error: MaterialError }> {
  const provider = aiProvider();
  if (!provider) {
    // Demo: clearly labelled example content, so nothing is presented as having been read.
    const demo = messagesFor(input.lang).applications.demoReading;
    await logRun(supabase, { projectId: input.projectId, task: "read_funder_material", promptVersion: FUNDER_MATERIAL_PROMPT_VERSION, model: "demo", status: "demo" });
    const blank = { limit: "", help: "", page: "" };
    const raw: MaterialRaw = {
      readable: true, aboutFunding: true, title: demo.title, funder: demo.funder, tone: demo.tone, winners: [],
      questions: demo.questions.map((q) => ({ ...blank, ...q })),
      priorities: demo.priorities.map((x) => ({ ...blank, ...x })),
      rules: demo.rules.map((x) => ({ ...blank, ...x })),
      details: demo.details.map((x) => ({ ...blank, ...x })),
    };
    return { ok: true, demo: true, reading: normaliseMaterial(raw) };
  }
  if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
  const result = await provider.generate({
    system: materialPrompt(input.lang),
    user: input.user,
    documents: input.documents,
    schema: MaterialSchema,
    effort: "low",
    maxTokens: 12000,
    timeoutMs: 3 * 60 * 1000,
    ...(input.fetchLink ? { webFetch: { maxUses: 2 }, maxContinuations: 2 } : {}),
  });
  await logRun(supabase, {
    projectId: input.projectId, task: "read_funder_material", promptVersion: FUNDER_MATERIAL_PROMPT_VERSION, model: result.model,
    status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
    inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
  });
  if (!result.ok) return { ok: false, error: result.reason === "busy" ? "busy" : result.reason === "key" ? "unavailable" : "unreadable" };
  if (!result.data.readable) return { ok: false, error: "unreadable" };
  if (!result.data.aboutFunding) return { ok: false, error: "notFunding" };
  return { ok: true, demo: false, reading: normaliseMaterial(result.data) };
}

/** Saves what Gusty read, filling in the opportunity's name and funder if the person left them empty. */
export async function saveMaterial(
  supabase: Supabase,
  app: { id: string; project_id: string; title: string; funder: string },
  row: { kind: MaterialKind; origin: "pdf" | "paste" | "link"; label: string; url?: string; pages?: number | null },
  reading: MaterialReading,
  demo: boolean,
): Promise<boolean> {
  const { error } = await supabase.from("application_materials").insert({
    application_id: app.id, project_id: app.project_id, kind: row.kind, origin: row.origin, label: row.label.slice(0, 300),
    url: row.url ?? "", pages: row.pages ?? null, reading: { ...reading, demo },
  });
  if (error) return false;
  // Marked as being worked out before the page refreshes, so it knows to check back for the fit.
  await supabase.from("applications")
    .update({ fit_status: "running", ...(!app.funder && reading.funder ? { funder: reading.funder } : {}) }).eq("id", app.id);
  return true;
}

/** The project as Gusty frames it for any task, plus its story: experience, research and voice. */
export async function loadProjectInputs(supabase: Supabase, projectId: string): Promise<{ context: string; bank: BankForFit } | null> {
  const [{ data: project }, { data: facts }, work, docs, { data: evidence }, { data: voice }] = await Promise.all([
    supabase.from("projects").select("title, idea").eq("id", projectId).maybeSingle(),
    supabase.from("project_facts").select("kind, value").eq("project_id", projectId).order("position"),
    loadWorkedOut(supabase, projectId),
    loadDocuments(supabase, projectId),
    supabase.from("project_evidence").select("origin, kind, text, title").eq("project_id", projectId),
    supabase.from("project_voice").select("description").eq("project_id", projectId).maybeSingle(),
  ]);
  if (!project) return null;
  return {
    context: projectContext(project.title, project.idea, facts ?? [], work, docs),
    bank: {
      experience: (evidence ?? []).filter((e) => e.origin === "person").map((e) => ({ kind: e.kind, text: e.text })),
      research: (evidence ?? []).filter((e) => e.origin === "research").map((e) => ({ title: e.title, finding: e.text })),
      voice: voice?.description ?? "",
    },
  };
}

/**
 * Works out how the project fits this funder, from the project, its bank and everything read so far.
 * Runs in the background after new material; the page shows "working it out" meanwhile.
 */
export async function updateFit(supabase: Supabase, appId: string, lang: string): Promise<void> {
  const { data: app } = await supabase.from("applications").select("id, project_id, title, funder").eq("id", appId).maybeSingle();
  if (!app) return;
  const fail = () => supabase.from("applications").update({ fit_status: "failed" }).eq("id", appId);
  try {
    const { data: materials } = await supabase.from("application_materials").select("reading").eq("application_id", appId);
    if (!materials?.length) {
      await supabase.from("applications").update({ fit_status: "none", fit: null, fit_at: null }).eq("id", appId);
      return;
    }
    await supabase.from("applications").update({ fit_status: "running" }).eq("id", appId);
    const provider = aiProvider();
    let fit;
    if (!provider) {
      fit = { ...normaliseFit(messagesFor(lang).applications.demoFit), demo: true };
      await logRun(supabase, { projectId: app.project_id, task: "application_fit", promptVersion: FIT_PROMPT_VERSION, model: "demo", status: "demo" });
    } else {
      if (!(await withinDailyLimit(supabase))) return void (await fail());
      const inputs = await loadProjectInputs(supabase, app.project_id);
      if (!inputs) return void (await fail());
      const result = await provider.generate({
        system: FIT_PROMPT.replace("{lang}", lang),
        user: fitMessage(inputs.context, inputs.bank,
          { title: app.title, funder: app.funder, readings: materials.map((m) => m.reading as MaterialReading) }),
        schema: FitSchema,
        effort: "medium",
        maxTokens: 6000,
        timeoutMs: 3 * 60 * 1000,
      });
      await logRun(supabase, {
        projectId: app.project_id, task: "application_fit", promptVersion: FIT_PROMPT_VERSION, model: result.model,
        status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
        inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
      });
      if (!result.ok) return void (await fail());
      fit = { ...normaliseFit(result.data), demo: false };
    }
    await supabase.from("applications").update({ fit_status: "ready", fit, fit_at: new Date().toISOString() }).eq("id", appId);
  } catch (error) {
    console.error("Working out the fit failed:", error);
    await fail();
  }
}
