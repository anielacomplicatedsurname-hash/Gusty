import { aiProvider } from "@/ai";
import { captchaTokenFrom, isCaptchaError } from "@/lib/captcha";
import {
  DocumentSchema, DOCUMENTS_PER_PERSON_PER_DAY, estimatePages, looksLikePdf, MAX_PDF_BYTES, MAX_PDF_PAGES, normaliseReading,
  READ_DOCUMENT_PROMPT, READ_DOCUMENT_PROMPT_VERSION, readDocumentMessage, type DocumentReading,
} from "@/ai/tasks/read-document";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { hasLocale, defaultLocale } from "@/i18n/config";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId, MAX_PROJECTS } from "@/modules/projects/validation";

export type DocumentError =
  | "tooBig" | "notPdf" | "tooManyPages" | "limit" | "unreadable" | "notProject" | "unavailable" | "busy" | "error" | "projectLimit" | "captcha";

const fail = (error: DocumentError, status = 400) => Response.json({ ok: false, error }, { status });

/**
 * Bring in a project (or add to one) from a PDF. Gusty reads it and keeps only what it learned: a short summary,
 * what's already been done, and suggestions for "Here's what I understood" for the person to confirm.
 * The file itself is never stored. Separate from Server Actions so the upload size limit applies only here.
 */
export async function POST(request: Request) {
  // Only Gusty's own pages may upload: a form on another site can't use someone's session.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return fail("error", 403);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PDF_BYTES + 64 * 1024) return fail("tooBig", 413);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("unavailable", 503);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const projectId = String(form?.get("projectId") ?? "");
  const rawLang = String(form?.get("lang") ?? "");
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  if (!(file instanceof File)) return fail("notPdf");
  if (file.size > MAX_PDF_BYTES) return fail("tooBig", 413);
  if (projectId && !isProjectId(projectId)) return fail("error");

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return fail("notPdf");
  const pages = estimatePages(bytes);
  if (pages > MAX_PDF_PAGES) return fail("tooManyPages");

  // A new project from a document works for first-time visitors too: like typing an idea, it starts a guest session.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    if (projectId) return fail("error", 401);
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken: captchaTokenFrom(form) } });
    if (error) return isCaptchaError(error) ? fail("captcha", 400) : fail("error", 500);
  }
  if (projectId) {
    const { data: owned } = await supabase.from("projects").select("id").eq("id", projectId).maybeSingle();
    if (!owned) return fail("error", 404);
  }

  if (!projectId) {
    const [{ count: projects }, { data: admin }] = await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.rpc("is_admin"),
    ]);
    if ((projects ?? 0) >= MAX_PROJECTS && admin !== true) return fail("projectLimit", 403);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_runs").select("id", { count: "exact", head: true }).eq("task", "read_document").gte("created_at", since);
  if ((count ?? 0) >= DOCUMENTS_PER_PERSON_PER_DAY) return fail("limit", 429);

  const provider = aiProvider();
  let reading: DocumentReading;
  let run: Parameters<typeof logRun>[1] | null = null;
  if (!provider) {
    // Demo: say so plainly; nothing is presented as having been read.
    const demo = messagesFor(lang).documents.demo;
    const name = file.name.replace(/\.pdf$/i, "").slice(0, 80) || demo.title;
    reading = {
      readable: true, aboutAProject: true, title: name, idea: demo.idea, summary: demo.summary, done: [demo.done],
      facts: { summary: "", audience: "", place: "", stage: "", need: "" },
    };
    run = { projectId: null, task: "read_document", promptVersion: READ_DOCUMENT_PROMPT_VERSION, model: "demo", status: "demo" };
  } else {
    if (!(await withinDailyLimit(supabase))) return fail("limit", 429);
    const result = await provider.generate({
      system: READ_DOCUMENT_PROMPT,
      user: readDocumentMessage(lang),
      documents: [{ base64: Buffer.from(bytes).toString("base64") }],
      schema: DocumentSchema,
      effort: "low",
      maxTokens: 6000,
      timeoutMs: 2 * 60 * 1000,
    });
    run = {
      projectId: null, task: "read_document", promptVersion: READ_DOCUMENT_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    };
    if (!result.ok) {
      await logRun(supabase, run);
      return fail(result.reason === "busy" ? "busy" : result.reason === "key" ? "unavailable" : "unreadable", 502);
    }
    reading = result.data;
  }
  if (!reading.readable) return (await logRun(supabase, run), fail("unreadable", 422));
  if (!reading.aboutAProject) return (await logRun(supabase, run), fail("notProject", 422));
  const doc = normaliseReading(reading);

  let id = projectId;
  if (!id) {
    const { data: created, error } = await supabase
      .from("projects").insert({ title: doc.title || file.name.slice(0, 80), idea: doc.idea || doc.summary || doc.title })
      .select("id").single();
    if (error?.hint === "project_limit") return (await logRun(supabase, run), fail("projectLimit", 403));
    if (error || !created) return (await logRun(supabase, run), fail("error", 500));
    id = created.id;
    await supabase.from("projects").update({ title_source: "ai" }).eq("id", id);
  }
  await logRun(supabase, { ...run, projectId: id });

  const { error: docError } = await supabase.from("project_documents").insert({
    project_id: id, filename: file.name.slice(0, 200), pages: pages || null, summary: doc.summary, done: doc.done,
  });
  if (docError) return fail("error", 500);

  // Suggestions for "Here's what I understood", only where nothing is there yet. The person confirms them.
  const { data: existing } = await supabase.from("project_facts").select("kind, position").eq("project_id", id);
  const have = new Set((existing ?? []).map((f) => f.kind));
  let position = Math.max(0, ...(existing ?? []).map((f) => f.position + 1));
  const facts = Object.entries(doc.facts)
    .filter(([kind]) => !have.has(kind))
    .map(([kind, value]) => ({ project_id: id, kind, value, source: "ai_from_user", status: "proposed", position: position++ }));
  if (facts.length) await supabase.from("project_facts").insert(facts);

  return Response.json({ ok: true, projectId: id });
}
