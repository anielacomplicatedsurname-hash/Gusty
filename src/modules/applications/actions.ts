"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { MATERIAL_KINDS, MAX_PASTE_CHARS, linkMessage, pasteMessage, type MaterialKind } from "@/ai/tasks/funder-material";
import { isSafeUrl } from "@/ai/tasks/opportunity-search";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import { materialsLeft, readMaterial, saveMaterial, updateFit, type MaterialError } from "./process";

const tidy = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

export type CreateResult = { ok: true; id: string } | { ok: false; error: "title" | "link" | "error" };

/** Starts an application for something the person found themselves. */
export async function createApplication(projectId: string, rawTitle: string, rawFunder: string, rawUrl: string): Promise<CreateResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const title = tidy(rawTitle, 200);
  const url = rawUrl.trim();
  if (!title) return { ok: false, error: "title" };
  if (url && !isSafeUrl(url)) return { ok: false, error: "link" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "error" };
  const { data, error } = await supabase.from("applications")
    .insert({ project_id: projectId, title, funder: tidy(rawFunder, 200), url }).select("id").single();
  return error || !data ? { ok: false, error: "error" } : { ok: true, id: data.id };
}

/** Starts (or reopens) an application for an opportunity saved from a deep search. */
export async function applicationFromSaved(foundId: string): Promise<CreateResult> {
  if (!isProjectId(foundId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "error" };
  const { data: existing } = await supabase.from("applications").select("id").eq("found_id", foundId).limit(1).maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  const { data: found } = await supabase.from("found_opportunities").select("project_id, title, funder, url").eq("id", foundId).maybeSingle();
  if (!found) return { ok: false, error: "error" };
  const { data, error } = await supabase.from("applications").insert({
    project_id: found.project_id, found_id: foundId, title: found.title.slice(0, 200), funder: found.funder.slice(0, 200),
    url: isSafeUrl(found.url) ? found.url : "",
  }).select("id").single();
  return error || !data ? { ok: false, error: "error" } : { ok: true, id: data.id };
}

/** Deletes an application space and what Gusty read for it; the project stays as it is. */
export async function deleteApplication(formData: FormData) {
  const appId = String(formData.get("applicationId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const rawLang = String(formData.get("lang") ?? "");
  const lang = hasLocale(rawLang) ? rawLang : defaultLocale;
  const supabase = await createSupabaseServerClient();
  if (supabase && isProjectId(appId)) await supabase.from("applications").delete().eq("id", appId);
  redirect(isProjectId(projectId) ? `/${lang}/projects/${projectId}?tab=funding` : `/${lang}/projects`);
}

export type AddResult = { ok: true } | { ok: false; error: MaterialError | "empty" | "link" | "tooLong" };

async function addMaterial(
  appId: string, rawKind: string, lang: string,
  source: { origin: "paste"; text: string } | { origin: "link"; url: string },
): Promise<AddResult> {
  if (!isProjectId(appId) || !(MATERIAL_KINDS as readonly string[]).includes(rawKind)) return { ok: false, error: "error" };
  const kind = rawKind as MaterialKind;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { data: app } = await supabase.from("applications").select("id, project_id, title, funder").eq("id", appId).maybeSingle();
  if (!app) return { ok: false, error: "error" };
  if (!(await materialsLeft(supabase))) return { ok: false, error: "limit" };

  const read = await readMaterial(supabase, {
    projectId: app.project_id, lang,
    user: source.origin === "paste" ? pasteMessage(source.text) : linkMessage(source.url),
    fetchLink: source.origin === "link",
  });
  if (!read.ok) return read;
  const label = source.origin === "link" ? source.url : tidy(source.text, 80) + (source.text.length > 80 ? "…" : "");
  const saved = await saveMaterial(supabase, app, { kind, origin: source.origin, label, url: source.origin === "link" ? source.url : "" }, read.reading, read.demo);
  if (!saved) return { ok: false, error: "error" };
  after(() => updateFit(supabase, app.id, lang));
  return { ok: true };
}

/** The person pastes the questions, guidance or terms. Gusty keeps what it read, not the pasted text. */
export async function addPasted(appId: string, kind: string, rawText: string, lang: string): Promise<AddResult> {
  const text = rawText.trim();
  if (!text) return { ok: false, error: "empty" };
  if (text.length > MAX_PASTE_CHARS) return { ok: false, error: "tooLong" };
  return addMaterial(appId, kind, lang, { origin: "paste", text });
}

/** A public page about the opportunity. Pages behind a login can't be opened. */
export async function addLink(appId: string, kind: string, rawUrl: string, lang: string): Promise<AddResult> {
  const url = rawUrl.trim();
  if (!isSafeUrl(url)) return { ok: false, error: "link" };
  return addMaterial(appId, kind, lang, { origin: "link", url });
}

export async function removeMaterial(materialId: string, lang: string): Promise<{ ok: boolean }> {
  if (!isProjectId(materialId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data } = await supabase.from("application_materials").delete().eq("id", materialId).select("application_id").maybeSingle();
  if (!data) return { ok: false };
  await supabase.from("applications").update({ fit_status: "running" }).eq("id", data.application_id);
  after(() => updateFit(supabase, data.application_id, lang));
  return { ok: true };
}

/** Works out the fit again, for example after adding to the project bank. */
export async function refreshFit(appId: string, lang: string): Promise<{ ok: boolean }> {
  if (!isProjectId(appId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data } = await supabase.from("applications").update({ fit_status: "running" }).eq("id", appId).select("id").maybeSingle();
  if (!data) return { ok: false };
  after(() => updateFit(supabase, appId, lang));
  return { ok: true };
}
