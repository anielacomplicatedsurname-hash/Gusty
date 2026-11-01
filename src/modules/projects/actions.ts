"use server";

import { captchaTokenFrom, isCaptchaError } from "@/lib/captcha";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  finishProjectTransfer, hashTransferSecret, newTransferSecret, TRANSFER_COOKIE, TRANSFER_MAX_AGE_SECONDS,
} from "./transfer";
import { checkEmail, checkIdea, isProjectId, titleFromIdea } from "./validation";

/** On an error the idea comes back too, so the box can show it again (forms clear themselves after an action). */
export type CreateProjectState = { error?: "empty" | "tooLong" | "unavailable" | "failed" | "projectLimit" | "captcha"; idea?: string; attempt?: number };

/**
 * Saves a new idea. Visitors without an account get a private guest session first,
 * so nobody has to sign up before their idea is safe.
 */
export async function createProject(
  _prev: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const lang = localeFrom(formData);
  const typed = String(formData.get("idea") ?? "").slice(0, 20_000);
  const back = (error: NonNullable<CreateProjectState["error"]>): CreateProjectState =>
    ({ error, idea: typed, attempt: (_prev.attempt ?? 0) + 1 });
  const check = checkIdea(formData.get("idea"));
  if (!check.ok) return back(check.error);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return back("unavailable");

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken: captchaTokenFrom(formData) } });
    if (error) {
      if (isCaptchaError(error)) return back("captcha");
      console.error("Guest sign-in failed:", error.message);
      return back("failed");
    }
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ title: titleFromIdea(check.idea), idea: check.idea })
    .select("id")
    .single();
  if (error) {
    // The free plan holds 3 projects at a time; the database enforces it.
    if (error.hint === "project_limit") return back("projectLimit");
    console.error("Creating a project failed:", error.message);
    return back("failed");
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

export type EmailLinkState = {
  status?: "sent" | "sentBring";
  error?: "invalid" | "unavailable" | "failed" | "exists" | "captcha";
  email?: string;
  /** Which kind of code the email holds, for typing it in instead of opening the link. */
  codeType?: "email" | "email_change";
};

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

  // Always the public site address, never one taken from the request.
  const emailRedirectTo = `${brand.siteUrl}/api/auth/confirm?next=${encodeURIComponent(`/${lang}/projects`)}`;

  // "bring" is chosen by a guest whose email already has an account: they sign in to it and their
  // projects come with them, once they open the link on this device (see /api/auth/confirm).
  const bring = formData.get("mode") === "bring";
  const { data: userData } = await supabase.auth.getUser();
  const isGuest = userData.user?.is_anonymous ?? false;
  if (bring && isGuest) {
    const secret = newTransferSecret();
    const { error: transferError } = await supabase.rpc("start_project_transfer", { p_token_hash: hashTransferSecret(secret) });
    if (transferError) {
      console.error("Starting the project transfer failed:", transferError.message);
      return { error: "failed", email };
    }
    (await cookies()).set(TRANSFER_COOKIE, secret, {
      httpOnly: true,
      secure: brand.siteUrl.startsWith("https://"),
      sameSite: "lax",
      // The whole site: the email link (/api/auth/confirm) and the code form both finish the move.
      path: "/",
      maxAge: TRANSFER_MAX_AGE_SECONDS,
    });
  }
  const { error } = isGuest && !bring
    ? await supabase.auth.updateUser({ email }, { emailRedirectTo })
    : await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, captchaToken: captchaTokenFrom(formData) } });
  if (error?.code === "email_exists") return { error: "exists", email };
  if (isCaptchaError(error)) return { error: "captcha", email };
  if (error) {
    console.error("Sending the email link failed:", error.message);
    return { error: "failed" };
  }
  return { status: bring ? "sentBring" : "sent", email, codeType: isGuest && !bring ? "email_change" : "email" };
}

export type EmailCodeState = { error?: "invalid" | "wrong" };

/**
 * Signs in with the code from the email instead of the link: handy when the email is read on
 * another device. Finishes "keep my projects" in this browser, like the link does.
 */
export async function verifyEmailCode(_prev: EmailCodeState, formData: FormData): Promise<EmailCodeState> {
  const lang = localeFrom(formData);
  const email = checkEmail(formData.get("email"));
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const type = formData.get("type") === "email_change" ? "email_change" : "email";
  if (!email || !/^\d{6,10}$/.test(code)) return { error: "invalid" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "wrong" };
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
  if (error) return { error: "wrong" };
  await finishProjectTransfer(supabase);
  redirect(`/${lang}/projects`);
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

/** Deletes one project and everything in it (reading, directions, steps). Owner only, via RLS. */
export async function deleteProject(formData: FormData) {
  const lang = localeFrom(formData);
  const projectId = String(formData.get("projectId") ?? "");
  const supabase = await createSupabaseServerClient();
  if (supabase && isProjectId(projectId)) {
    await supabase.from("projects").delete().eq("id", projectId);
  }
  redirect(`/${lang}/projects`);
}

/**
 * Deletes a project from My Projects. The person has to type its name first, checked here too, because a
 * deleted project can't be brought back.
 */
export async function deleteProjectNamed(projectId: string, typed: string): Promise<{ ok: boolean }> {
  if (!isProjectId(projectId)) return { ok: false };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false };
  const { data: project } = await supabase.from("projects").select("title").eq("id", projectId).maybeSingle();
  if (!project || !sameName(project.title, typed)) return { ok: false };
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  return { ok: !error };
}

/** Typed names match without worrying about capitals or extra spaces. */
const sameName = (a: string, b: string) => norm(a) === norm(b);
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

/** Deletes the person's account and everything they own, then signs them out. */
export async function deleteAccount(formData: FormData) {
  const lang = localeFrom(formData);
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.rpc("delete_my_account");
    if (error) console.error("Account deletion failed:", error.message);
    await supabase.auth.signOut();
  }
  redirect(`/${lang}`);
}
