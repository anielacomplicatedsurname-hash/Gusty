"use server";

import { revalidatePath } from "next/cache";
import { aiProvider } from "@/ai";
import {
  EXTRACT_OPPORTUNITY_PROMPT, EXTRACT_OPPORTUNITY_PROMPT_VERSION, extractMessage, isSafeUrl, normaliseOpportunity,
  OpportunitySchema, REGIONS, cleanDate,
} from "@/ai/tasks/opportunity";
import { logRun } from "@/ai/usage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Draft = ReturnType<typeof normaliseOpportunity>;
export type ExtractResult =
  | { ok: true; draft: Draft }
  | { ok: false; error: "url" | "unavailable" | "unreadable" | "notFunding" | "busy" | "error" };

async function adminClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("is_admin");
  return data === true ? supabase : null;
}

/** Gusty reads the funder's page and fills in what it says. Nothing is saved: the founder checks it first. */
export async function extractOpportunity(rawUrl: string): Promise<ExtractResult> {
  if (!isSafeUrl(rawUrl)) return { ok: false, error: "url" };
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "error" };
  const provider = aiProvider();
  if (!provider) return { ok: false, error: "unavailable" };

  const result = await provider.generate({
    system: EXTRACT_OPPORTUNITY_PROMPT,
    user: extractMessage(rawUrl.trim()),
    schema: OpportunitySchema,
    effort: "low",
    webFetch: { maxUses: 2 },
  });
  await logRun(supabase, {
    projectId: null, task: "extract_opportunity", promptVersion: EXTRACT_OPPORTUNITY_PROMPT_VERSION, model: result.model,
    status: result.ok ? "ok" : result.reason === "declined" ? "declined" : "error",
    inputTokens: result.inputTokens, outputTokens: result.outputTokens, failure: result.ok ? undefined : result.reason,
  });
  if (!result.ok) return { ok: false, error: result.reason === "busy" ? "busy" : result.reason === "key" ? "unavailable" : "error" };
  if (!result.data.readable) return { ok: false, error: "unreadable" };
  if (!result.data.isFunding) return { ok: false, error: "notFunding" };
  return { ok: true, draft: normaliseOpportunity(result.data) };
}

export type SaveState = { ok?: boolean; error?: "missing" | "url" | "error"; savedAs?: "draft" | "published" };

const text = (form: FormData, key: string, max: number) => String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Saves the founder's checked details. Publishing marks them as checked today. */
export async function saveOpportunity(_prev: SaveState, form: FormData): Promise<SaveState> {
  const supabase = await adminClient();
  if (!supabase) return { error: "error" };
  const id = String(form.get("id") ?? "");
  const url = String(form.get("url") ?? "").trim();
  const title = text(form, "title", 200);
  if (!title) return { error: "missing" };
  if (!isSafeUrl(url)) return { error: "url" };
  const status = form.get("intent") === "publish" ? "published" : "draft";
  const row = {
    title,
    url,
    funder: text(form, "funder", 200),
    summary: text(form, "summary", 600),
    who_for: text(form, "whoFor", 600),
    amount: text(form, "amount", 120),
    deadline: cleanDate(String(form.get("deadline") ?? "")) || null,
    deadline_note: text(form, "deadlineNote", 120),
    regions: form.getAll("regions").map(String).filter((r) => (REGIONS as readonly string[]).includes(r)),
    status,
    checked_at: new Date().toISOString().slice(0, 10),
  };
  const { error } = id
    ? await supabase.from("opportunities").update(row).eq("id", id)
    : await supabase.from("opportunities").insert(row);
  if (error) {
    console.error("Saving an opportunity failed:", error.message);
    return { error: "error" };
  }
  revalidatePath("/[lang]/explore", "page");
  return { ok: true, savedAs: status };
}

/** Publish, take down (archive) or bring back as a draft. */
export async function setOpportunityStatus(id: string, status: "draft" | "published" | "archived"): Promise<{ ok: boolean }> {
  const supabase = await adminClient();
  if (!supabase || !["draft", "published", "archived"].includes(status)) return { ok: false };
  const { error } = await supabase.from("opportunities").update({ status }).eq("id", id);
  revalidatePath("/[lang]/explore", "page");
  return { ok: !error };
}
