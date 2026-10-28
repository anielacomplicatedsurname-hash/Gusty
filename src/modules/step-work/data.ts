import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

export type WorkQuestion = { id: string; question: string; hint: string; answer: string };
export type StepWork = {
  step: { id: string; projectId: string; title: string; detail: string; status: string; notes: string };
  projectTitle: string;
  questions: WorkQuestion[];
  demo: boolean;
};

/** One step, its active questions and the person's notes. RLS limits all of it to the owner. */
export async function getStepWork(projectId: string, stepId: string): Promise<StepWork | null> {
  if (!isProjectId(projectId) || !isProjectId(stepId)) return null;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;

  const [step, project, questions, lastRun] = await Promise.all([
    supabase.from("next_steps").select("id, project_id, title, detail, status, notes").eq("id", stepId).eq("project_id", projectId).maybeSingle(),
    supabase.from("projects").select("title").eq("id", projectId).maybeSingle(),
    supabase
      .from("step_questions")
      .select("id, question, hint, answer")
      .eq("step_id", stepId)
      .eq("status", "active")
      .order("position")
      .order("created_at"),
    supabase.from("ai_runs").select("status").eq("project_id", projectId).eq("task", "step_questions").order("created_at", { ascending: false }).limit(1),
  ]);
  if (!step.data || !project.data || step.data.status === "replaced") return null;
  return {
    step: { id: step.data.id, projectId: step.data.project_id, title: step.data.title, detail: step.data.detail, status: step.data.status, notes: step.data.notes },
    projectTitle: project.data.title,
    questions: questions.data ?? [],
    demo: lastRun.data?.[0]?.status === "demo",
  };
}
