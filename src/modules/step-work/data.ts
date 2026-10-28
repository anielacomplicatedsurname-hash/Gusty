import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

export type WorkQuestion = { id: string; question: string; hint: string; answer: string; assisted: boolean };
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
      .select("id, question, hint, answer, assisted")
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

export type WorkedStep = {
  id: string;
  title: string;
  done: boolean;
  /** Replaced by smaller steps, a new direction, or removed. Its answers still count, but its page is gone. */
  setAside: boolean;
  /** `tidied` is Gusty's tidied copy of the answer, or "" when there's none for the current wording. */
  answers: { question: string; answer: string; tidied: string; assisted: boolean }[];
  notes: string;
  notesTidied: string;
};

/**
 * Steps the person has worked on (answered a question or wrote notes), in plan order, including steps
 * set aside later so no answer disappears. Shown on the project page and given to Gusty as context.
 * RLS limits it to the owner.
 */
export async function getWorkedOut(projectId: string): Promise<WorkedStep[]> {
  if (!isProjectId(projectId)) return [];
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  return loadWorkedOut(supabase, projectId);
}

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

export async function loadWorkedOut(supabase: Supabase, projectId: string): Promise<WorkedStep[]> {
  const [steps, questions] = await Promise.all([
    supabase.from("next_steps").select("id, title, status, notes, notes_tidied").eq("project_id", projectId).order("position"),
    supabase
      .from("step_questions")
      .select("step_id, question, answer, answer_tidied, assisted")
      .eq("project_id", projectId)
      .eq("status", "active")
      .neq("answer", "")
      .order("position")
      .order("created_at"),
  ]);
  return (steps.data ?? [])
    .sort((a, b) => Number(a.status === "replaced") - Number(b.status === "replaced"))
    .map((s) => ({
      id: s.id,
      title: s.title,
      done: s.status === "done",
      setAside: s.status === "replaced",
      answers: (questions.data ?? [])
        .filter((q) => q.step_id === s.id && q.answer.trim())
        .map((q) => ({ question: q.question, answer: q.answer, tidied: q.answer_tidied.trim(), assisted: q.assisted })),
      notes: s.notes.trim(),
      notesTidied: s.notes_tidied.trim(),
    }))
    .filter((s) => s.answers.length > 0 || s.notes);
}
