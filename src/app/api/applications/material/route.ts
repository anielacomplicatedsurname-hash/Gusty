import { after } from "next/server";
import { MATERIAL_KINDS, pdfMessage, type MaterialKind } from "@/ai/tasks/funder-material";
import { estimatePages, looksLikePdf, MAX_PDF_BYTES, MAX_PDF_PAGES } from "@/ai/tasks/read-document";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { materialsLeft, readMaterial, saveMaterial, updateFit, type MaterialError } from "@/modules/applications/process";
import { isProjectId } from "@/modules/projects/validation";

export type MaterialUploadError = MaterialError | "tooBig" | "notPdf" | "tooManyPages";

const fail = (error: MaterialUploadError, status = 400) => Response.json({ ok: false, error }, { status });

/**
 * A funder's PDF (form, guidance, terms) for one application. Gusty reads it and keeps what it read, never the
 * file. Separate from Server Actions so the upload size limit applies only here.
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
  const appId = String(form?.get("applicationId") ?? "");
  const kind = String(form?.get("kind") ?? "");
  const rawLang = String(form?.get("lang") ?? "");
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  if (!(file instanceof File)) return fail("notPdf");
  if (file.size > MAX_PDF_BYTES) return fail("tooBig", 413);
  if (!isProjectId(appId) || !(MATERIAL_KINDS as readonly string[]).includes(kind)) return fail("error");

  const { data: app } = await supabase.from("applications").select("id, project_id, title, funder").eq("id", appId).maybeSingle();
  if (!app) return fail("error", 404);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikePdf(bytes)) return fail("notPdf");
  const pages = estimatePages(bytes);
  if (pages > MAX_PDF_PAGES) return fail("tooManyPages");
  if (!(await materialsLeft(supabase))) return fail("limit", 429);

  const read = await readMaterial(supabase, {
    projectId: app.project_id, lang, user: pdfMessage(), documents: [{ base64: Buffer.from(bytes).toString("base64") }],
  });
  if (!read.ok) return fail(read.error, read.error === "limit" ? 429 : 422);
  const saved = await saveMaterial(supabase, app, { kind: kind as MaterialKind, origin: "pdf", label: file.name || "PDF", pages: pages || null }, read.reading, read.demo);
  if (!saved) return fail("error", 500);
  after(() => updateFit(supabase, app.id, lang));
  return Response.json({ ok: true });
}
