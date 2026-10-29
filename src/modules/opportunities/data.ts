import type { Region } from "@/ai/tasks/opportunity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Opportunity = {
  id: string;
  title: string;
  funder: string;
  url: string;
  summary: string;
  whoFor: string;
  amount: string;
  deadline: string | null;
  deadlineNote: string;
  regions: Region[];
  status: "draft" | "published" | "archived";
  checkedAt: string;
};

const COLUMNS = "id, title, funder, url, summary, who_for, amount, deadline, deadline_note, regions, status, checked_at";

type Row = {
  id: string; title: string; funder: string; url: string; summary: string; who_for: string; amount: string;
  deadline: string | null; deadline_note: string; regions: string[]; status: string; checked_at: string;
};

const toOpportunity = (r: Row): Opportunity => ({
  id: r.id, title: r.title, funder: r.funder, url: r.url, summary: r.summary, whoFor: r.who_for, amount: r.amount,
  deadline: r.deadline, deadlineNote: r.deadline_note, regions: r.regions as Region[],
  status: r.status as Opportunity["status"], checkedAt: r.checked_at,
});

/**
 * Published opportunities that haven't closed, soonest deadline first, then those without a date.
 * Readable by anyone (the database only returns published ones).
 */
export async function getPublishedOpportunities(): Promise<Opportunity[] | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("opportunities")
    .select(COLUMNS)
    .eq("status", "published")
    .or(`deadline.is.null,deadline.gte.${today}`)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("title");
  if (error) {
    console.error("Loading opportunities failed:", error.message);
    return null;
  }
  return (data as Row[]).map(toOpportunity);
}

/** Every opportunity, for the founder's list. Only admins get rows back. */
export async function getAllOpportunities(): Promise<Opportunity[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];
  const { data } = await supabase.from("opportunities").select(COLUMNS).order("updated_at", { ascending: false });
  return ((data ?? []) as Row[]).map(toOpportunity);
}
