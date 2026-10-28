"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanAnswer, cleanPage } from "./validation";

export type FeedbackState = { status?: "sent"; error?: "empty" | "failed" };

/**
 * Saves feedback. Visitors without a session get a private guest session first (as when saving an
 * idea), so the database can limit how much one person sends.
 */
export async function sendFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const worked = cleanAnswer(formData.get("worked"));
  const confusing = cleanAnswer(formData.get("confusing"));
  const other = cleanAnswer(formData.get("other"));
  if (!worked && !confusing && !other) return { error: "empty" };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "failed" };
  const { data } = await supabase.auth.getUser();
  if (!data.user && (await supabase.auth.signInAnonymously()).error) return { error: "failed" };

  const { error } = await supabase
    .from("feedback")
    .insert({ worked, confusing, other, page: cleanPage(formData.get("page")) });
  if (error) {
    console.error("Saving feedback failed:", error.message);
    return { error: "failed" };
  }
  return { status: "sent" };
}
