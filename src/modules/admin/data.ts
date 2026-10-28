import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminOverview = {
  people: { total: number; withEmail: number; guests: number; newThisWeek: number };
  projects: { total: number; newThisWeek: number };
  cost: { today: number; week: number; month: number };
  days: { day: string; runs: number; errors: number; cost: number }[];
  tasks: { task: string; runs: number; demo: number; errors: number; cost: number }[];
  errors: { reason: string; count: number; last: string }[];
};

/**
 * The founder's overview: counts and costs only. The database decides who is an admin
 * (`admin_overview` refuses everyone else), so `forbidden` covers signed-out visitors too.
 */
export async function getAdminOverview(): Promise<{ ok: true; overview: AdminOverview } | { ok: false; error: "forbidden" | "unavailable" }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: "unavailable" };
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: "forbidden" };
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) return { ok: false, error: error.code === "42501" ? "forbidden" : "unavailable" };
  return { ok: true, overview: data as unknown as AdminOverview };
}

export type FeedbackItem = { worked: string | null; confusing: string | null; other: string | null; page: string | null; at: string };

/** Feedback testers chose to send, newest first. Only admins can read it (checked in the database). */
export async function getAdminFeedback(): Promise<FeedbackItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("admin_feedback");
  if (error) {
    console.error("Loading feedback failed:", error.message);
    return [];
  }
  return data as unknown as FeedbackItem[];
}
