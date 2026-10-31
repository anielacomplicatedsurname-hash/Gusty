"use server";

import { aiProvider } from "@/ai";
import { projectContext } from "@/ai/tasks/context";
import {
  NEEDS, normaliseRoutes, ROUTES_PROMPT, ROUTES_PROMPT_VERSION, RoutesSchema, routesMessage, type Need, type RouteRaw,
} from "@/ai/tasks/funding-routes";
import { logRun, withinDailyLimit } from "@/ai/usage";
import { messagesFor } from "@/i18n/messages-for";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";
import { loadDocuments } from "@/modules/documents/data";
import { loadWorkedOut } from "@/modules/step-work/data";

export type RoutesResult = { ok: true } | { ok: false; error: "unavailable" | "busy" | "declined" | "invalid" | "error" | "limit" };

/** The person's own answer to "roughly how much would it need?". */
export async function setFundingNeed(projectId: string, need: string): Promise<{ ok: boolean }> {
  if (!isProjectId(projectId) || !(NEEDS as readonly string[]).includes(need)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase.from("projects").update({ funding_need: need }).eq("id", projectId).select("id").maybeSingle();
  return { ok: !error && !!data };
}

/** Gusty's suggested funding routes for the project as it is now. Replaces the previous suggestions. */
export async function suggestRoutes(projectId: string, lang: string): Promise<RoutesResult> {
  if (!isProjectId(projectId)) return { ok: false, error: "error" };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const [{ data: project }, { data: facts }, work, docs] = await Promise.all([
    supabase.from("projects").select("id, title, idea, funding_need").eq("id", projectId).maybeSingle(),
    supabase.from("project_facts").select("kind, value").eq("project_id", projectId).order("position"),
    loadWorkedOut(supabase, projectId),
    loadDocuments(supabase, projectId),
  ]);
  if (!project) return { ok: false, error: "error" };

  let raw: RouteRaw[];
  const provider = aiProvider();
  if (!provider) {
    raw = messagesFor(lang).readiness.demoRoutes;
    await logRun(supabase, { projectId, task: "funding_routes", promptVersion: ROUTES_PROMPT_VERSION, model: "demo", status: "demo" });
  } else {
    if (!(await withinDailyLimit(supabase))) return { ok: false, error: "limit" };
    const result = await provider.generate({
      system: ROUTES_PROMPT,
      user: routesMessage(projectContext(project.title, project.idea, facts ?? [], work, docs), project.funding_need as Need | null),
      schema: RoutesSchema,
      effort: "medium",
    });
    await logRun(supabase, {
      projectId, task: "funding_routes", promptVersion: ROUTES_PROMPT_VERSION, model: result.model,
      status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
      inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
    });
    if (!result.ok) return { ok: false, error: result.reason === "key" ? "unavailable" : result.reason };
    raw = result.data.routes;
  }
  const routes = normaliseRoutes(raw);
  if (routes.length === 0) return { ok: false, error: "invalid" };
  await supabase.from("funding_routes").delete().eq("project_id", projectId);
  const { error } = await supabase.from("funding_routes").insert(
    routes.map((r, position) => ({ project_id: projectId, position, route: r.route, focus: r.focus, fit: r.fit, why: r.why, first_step: r.firstStep })),
  );
  return error ? { ok: false, error: "error" } : { ok: true };
}

/** Turns one of Gusty's funding routes into a step in the project's current stage, so it can be acted on. */
export async function addRouteStep(routeId: string, lang: string): Promise<{ ok: boolean }> {
  if (!isProjectId(routeId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: route } = await supabase.from("funding_routes").select("project_id, route, first_step").eq("id", routeId).maybeSingle();
  if (!route) return { ok: false };
  const [{ data: existing }, { data: stage }] = await Promise.all([
    supabase.from("next_steps").select("position").eq("project_id", route.project_id),
    supabase.from("project_stages").select("id").eq("project_id", route.project_id).eq("status", "current").maybeSingle(),
  ]);
  const t = messagesFor(lang).readiness;
  const name = t.routes[route.route as keyof typeof t.routes] ?? route.route;
  const title = (route.first_step || t.routeStep.replace("{route}", name)).slice(0, 160);
  const { error } = await supabase.from("next_steps").insert({
    project_id: route.project_id, stage_id: stage?.id ?? null, title, detail: name.slice(0, 500), source: "user",
    position: Math.max(0, ...(existing ?? []).map((s) => s.position + 1)),
  });
  return { ok: !error };
}
