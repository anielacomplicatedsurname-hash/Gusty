import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isProjectId } from "./validation";

export type CurrentUser = { id: string; email: string | null; isAnonymous: boolean };
export type ProjectSummary = { id: string; title: string; updatedAt: string };
export type Project = ProjectSummary & { idea: string; createdAt: string };

/** Who is signed in, if anyone. Row Level Security still guards every query. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null, isAnonymous: data.user.is_anonymous ?? false };
}

/** Signed-out visitors have no table access at all, so skip the query for them. */
async function clientWithSession() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? supabase : null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = await clientWithSession();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Could not load projects: ${error.message}`);
  return data.map((p) => ({ id: p.id, title: p.title, updatedAt: p.updated_at }));
}

export async function getProject(id: string): Promise<Project | null> {
  if (!isProjectId(id)) return null;
  const supabase = await clientWithSession();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, idea, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load project: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    title: data.title,
    idea: data.idea,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}
