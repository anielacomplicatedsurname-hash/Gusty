import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Everything a person has saved in Gusty, as a JSON file they can keep. Row Level Security means
 * this can only ever contain the caller's own data.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = supabase ? await supabase.auth.getClaims() : { data: null };
  if (!supabase || !claims?.claims) return new Response("Not signed in", { status: 401 });

  const [projects, facts, directions, stages, steps, answers, documents, evidence, voices, applications, materials] = await Promise.all([
    supabase.from("projects").select("id, title, idea, created_at, updated_at").order("created_at"),
    supabase.from("project_facts").select("project_id, kind, value, source, status"),
    supabase.from("project_directions").select("project_id, label, reason, recommended, chosen"),
    supabase.from("project_stages").select("project_id, title, status, later, done_at").order("position"),
    supabase
      .from("next_steps")
      .select("id, project_id, title, detail, minutes, status, source, explanation, starter, notes, notes_tidied, draft, done_at")
      .order("position"),
    supabase
      .from("step_questions")
      .select("step_id, project_id, question, answer, answer_tidied, assisted")
      .eq("status", "active")
      .order("position"),
    supabase.from("project_documents").select("project_id, filename, pages, summary, done, created_at").order("created_at"),
    supabase.from("project_evidence")
      .select("project_id, origin, kind, text, title, publisher, year, relevance, url, found_at").order("created_at"),
    supabase.from("project_voice").select("project_id, description, source, updated_at"),
    supabase.from("applications").select("id, project_id, title, funder, url, fit, fit_at, created_at").order("created_at"),
    supabase.from("application_materials").select("application_id, project_id, kind, origin, label, url, pages, reading, created_at")
      .order("created_at"),
  ]);
  const byProject = <T extends { project_id: string }>(rows: T[] | null, id: string) =>
    (rows ?? []).filter((r) => r.project_id === id);

  const body = {
    exportedAt: new Date().toISOString(),
    projects: (projects.data ?? []).map((p) => ({
      ...p,
      reading: byProject(facts.data, p.id),
      directions: byProject(directions.data, p.id),
      stages: byProject(stages.data, p.id),
      documents: byProject(documents.data, p.id),
      experience: byProject(evidence.data, p.id).filter((e) => e.origin === "person"),
      research: byProject(evidence.data, p.id).filter((e) => e.origin === "research"),
      voice: byProject(voices.data, p.id)[0] ?? null,
      applications: byProject(applications.data, p.id).map(({ id, ...a }) => ({
        ...a,
        papers: (materials.data ?? []).filter((m) => m.application_id === id).map((m) => ({ ...m, application_id: undefined })),
      })),
      steps: byProject(steps.data, p.id).map(({ id, ...step }) => ({
        ...step,
        answers: byProject(answers.data, p.id)
          .filter((a) => a.step_id === id)
          .map(({ question, answer, answer_tidied, assisted }) => ({ question, answer, tidied: answer_tidied, gustyAddedIdeas: assisted })),
      })),
    })),
  };
  const date = body.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="gusty-projects-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
