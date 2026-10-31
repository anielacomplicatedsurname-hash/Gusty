import type { Fit } from "@/ai/tasks/application-fit";
import type { Gap } from "@/ai/tasks/draft-answer";
import type { MaterialKind, MaterialReading } from "@/ai/tasks/funder-material";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

const FIT_STALE_MS = 5 * 60 * 1000;

export type ApplicationSummary = { id: string; title: string; funder: string; materials: number; foundId: string | null };
export type Material = {
  id: string; kind: MaterialKind; origin: "pdf" | "paste" | "link"; label: string; url: string; pages: number | null;
  reading: MaterialReading & { demo?: boolean }; createdAt: string;
};
export type Application = {
  id: string; projectId: string; projectTitle: string; title: string; funder: string; url: string;
  materials: Material[];
  fitStatus: "none" | "running" | "ready" | "failed";
  fit: (Fit & { demo?: boolean }) | null;
  fitAt: string | null;
  answers: Answer[];
};
export type Answer = {
  key: string; answer: string; source: "ai" | "user"; gaps: Gap[]; draftedAt: string | null; updatedAt: string;
  style: "funder" | "mine"; funderWords: string[];
};

/** A project's application spaces. Owner only (RLS). Before the database change, simply none. */
export async function listApplications(projectId: string): Promise<ApplicationSummary[]> {
  if (!isProjectId(projectId)) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("applications")
    .select("id, title, funder, found_id, application_materials(count)").eq("project_id", projectId).order("created_at");
  return (data ?? []).map((a) => ({
    id: a.id, title: a.title, funder: a.funder, foundId: a.found_id,
    materials: (a.application_materials as unknown as { count: number }[])[0]?.count ?? 0,
  }));
}

/** One application space with everything Gusty read for it and its view of the fit. */
export async function getApplication(projectId: string, appId: string): Promise<Application | null> {
  if (!isProjectId(projectId) || !isProjectId(appId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const [{ data: app }, { data: materials }, { data: answers }] = await Promise.all([
    supabase.from("applications").select("id, project_id, title, funder, url, fit_status, fit, fit_at, updated_at, projects(title)")
      .eq("id", appId).eq("project_id", projectId).maybeSingle(),
    supabase.from("application_materials").select("id, kind, origin, label, url, pages, reading, created_at")
      .eq("application_id", appId).order("created_at"),
    supabase.from("application_answers").select("question_key, answer, source, gaps, drafted_at, updated_at, style, funder_words").eq("application_id", appId),
  ]);
  if (!app) return null;
  return {
    id: app.id, projectId: app.project_id, title: app.title, funder: app.funder, url: app.url,
    projectTitle: (app.projects as { title: string } | null)?.title ?? "",
    materials: (materials ?? []).map((m) => ({
      id: m.id, kind: m.kind as MaterialKind, origin: m.origin as Material["origin"], label: m.label, url: m.url, pages: m.pages,
      reading: m.reading as Material["reading"], createdAt: m.created_at,
    })),
    // A fit still "running" after five minutes has died somewhere: offer to try again rather than wait forever.
    fitStatus: app.fit_status === "running" && Date.now() - new Date(app.updated_at).getTime() > FIT_STALE_MS
      ? "failed" : (app.fit_status as Application["fitStatus"]),
    fit: (app.fit as Application["fit"]) ?? null,
    fitAt: app.fit_at,
    answers: (answers ?? []).map((a) => ({
      key: a.question_key, answer: a.answer, source: a.source as Answer["source"], gaps: (a.gaps as Gap[]) ?? [],
      draftedAt: a.drafted_at, updatedAt: a.updated_at,
      style: a.style as Answer["style"], funderWords: (a.funder_words as string[]) ?? [],
    })),
  };
}
