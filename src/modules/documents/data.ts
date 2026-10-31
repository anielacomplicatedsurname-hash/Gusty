import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "@/modules/projects/validation";

export type ProjectDocument = { id: string; filename: string; pages: number | null; summary: string; done: string[]; createdAt: string };
type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/** What Gusty learned from a project's documents, oldest first. RLS limits it to the owner. */
export async function loadDocuments(supabase: Supabase, projectId: string): Promise<ProjectDocument[]> {
  const { data } = await supabase
    .from("project_documents").select("id, filename, pages, summary, done, created_at").eq("project_id", projectId).order("created_at");
  return (data ?? []).map((d) => ({ id: d.id, filename: d.filename, pages: d.pages, summary: d.summary, done: d.done, createdAt: d.created_at }));
}

export async function getDocuments(projectId: string): Promise<ProjectDocument[]> {
  if (!isProjectId(projectId)) return [];
  const supabase = await createSupabaseServerClient();
  return supabase ? loadDocuments(supabase, projectId) : [];
}
