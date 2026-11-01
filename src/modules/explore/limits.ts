import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * The free plan's deep searches: they cost real money (web searches and pages read), so each person gets
 * one a calendar month, and one more that month after sharing feedback. Results are always kept.
 */
export const FREE_SEARCHES_PER_MONTH = 1;
export const FEEDBACK_BONUS_SEARCHES = 1;
/** A search still "running" after this long was interrupted (e.g. a restart) and counts as failed. */
export const SEARCH_STALE_MS = 10 * 60 * 1000;

/** The first moment of this calendar month (UTC), and of the next one, when the allowance comes back. */
export function monthBounds(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), next: next.toISOString() };
}

export type SearchAllowance = {
  used: number;
  max: number;
  left: number;
  /** They haven't shared feedback this month, so one more search is waiting for them if they do. */
  bonusAvailable: boolean;
  /** When the allowance comes back. */
  resetsAt: string;
  unlimited: boolean;
};

export function allowanceFrom(used: number, gaveFeedback: boolean, admin: boolean, resetsAt: string): SearchAllowance {
  const max = FREE_SEARCHES_PER_MONTH + (gaveFeedback ? FEEDBACK_BONUS_SEARCHES : 0);
  return {
    used, max, left: admin ? 99 : Math.max(0, max - used), bonusAvailable: !gaveFeedback, resetsAt, unlimited: admin,
  };
}

/** How many deep searches this person has left this month. Admins (the founder) aren't limited. */
export async function searchAllowance(supabase: Supabase): Promise<SearchAllowance> {
  const { start, next } = monthBounds();
  const [used, feedback, admin] = await Promise.all([
    supabase.from("opportunity_searches").select("id", { count: "exact", head: true }).neq("status", "failed").gte("created_at", start),
    supabase.rpc("my_feedback_since", { since: start }),
    supabase.rpc("is_admin"),
  ]);
  return allowanceFrom(used.count ?? 0, (feedback.data ?? 0) > 0, admin.data === true, next);
}
