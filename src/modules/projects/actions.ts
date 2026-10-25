"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkEmail, checkIdea, isProjectId, titleFromIdea } from "./validation";

export type CreateProjectState = { error?: "empty" | "tooLong" | "unavailable" | "failed" };

/**
 * Saves a new idea. Visitors without an account get a private guest session first,
 * so nobody has to sign up before their idea is safe.
 */
export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const lang = localeFrom(formData);
  const check = checkIdea(formData.get("idea"));
  if (!check.ok) return { error: check.error };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable" };

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("Guest sign-in failed:", error.message);
      return { error: "failed" };
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ title: titleFromIdea(check.idea), idea: check.idea })
    .select("id")
    .single();
  if (error) {
    console.error("Creating a project failed:", error.message);
    return { error: "failed" };
  }

  redirect(`/${lang}/projects/${data.id}`);
}

export type SaveIdeaResult = { ok: true; savedAt: string } | { ok: false; error: "empty" | "tooLong" | "failed" };

/** Autosave for the idea text. Only the owner can update it (enforced by RLS). */
export async function saveIdea(projectId: string, rawIdea: string): Promise<SaveIdeaResult> {
  const check = checkIdea(rawIdea);
  if (!check.ok) return { ok: false, error: check.error };
  if (!isProjectId(projectId)) return { ok: false, error: "failed" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "failed" };

  const { data, error } = await supabase
    .from("projects")
    .update({ idea: check.idea })
    .eq("id", projectId)
    .select("updated_at")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Autosave failed:", error.message);
    return { ok: false, error: "failed" };
  }
  return { ok: true, savedAt: data.updated_at };
}

export type EmailLinkState = { status?: "sent"; error?: "invalid" | "unavailable" | "failed" };

/**
 * Sends a sign-in link. For a guest, this attaches the email to their existing account,
 * so their projects are kept. Otherwise it signs the person in (or creates an account).
 */
export async function requestEmailLink(
  _prev: EmailLinkState,
  formData: FormData,
): Promise<EmailLinkState> {
  const lang = localeFrom(formData);
  const email = checkEmail(formData.get("email"));
  if (!email) return { error: "invalid" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unavailable" };

  const origin = (await headers()).get("origin") ?? brand.siteUrl;
  const emailRedirectTo = `${origin}/api/auth/confirm?next=${encodeURIComponent(`/${lang}/projects`)}`;

  const { data: userData } = await supabase.auth.getUser();
  const { error } = userData.user?.is_anonymous
    ? await supabase.auth.updateUser({ email }, { emailRedirectTo })
    : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } });
  if (error) {
    console.error("Sending the email link failed:", error.message);
    return { error: "failed" };
  }
  return { status: "sent" };
}

export async function signOut(formData: FormData) {
  const lang = localeFrom(formData);
  const supabase = await createSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect(`/${lang}`);
}

function localeFrom(formData: FormData) {
  const value = String(formData.get("lang") ?? "");
  return hasLocale(value) ? value : defaultLocale;
}

export type RenameResult = { ok: boolean };

/** The person names their project. From then on Gusty never changes the title. */
export async function renameProject(projectId: string, rawTitle: string): Promise<RenameResult> {
  const title = rawTitle.replace(/\s+/g, " ").trim().slice(0, 120);
  if (!isProjectId(projectId) || !title) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data, error } = await supabase
    .from("projects")
    .update({ title, title_source: "user" })
    .eq("id", projectId)
    .select("id")
    .maybeSingle();
  return { ok: !error && !!data };
}
