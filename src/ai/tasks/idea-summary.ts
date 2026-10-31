import { z } from "zod";
import { SHARED_RULES } from "./context";

export const SUMMARY_PROMPT_VERSION = "idea-summary@1";
export const MAX_POINTS = 3;

export const SummarySchema = z.object({ summary: z.string(), points: z.array(z.string()) });
export type SummaryRaw = z.infer<typeof SummarySchema>;

export const SUMMARY_PROMPT = `You are Gusty, a calm, warm companion that helps people turn ideas into real projects.
Many people you help are neurodivergent, tired, or new to project work.

Write a short, clear picture of this project as it stands now, drawn from everything below: their idea in
their own words, what they confirmed, what they worked out in steps, and their documents. It should read like
the best short description of their project: neat, specific, and in their voice ("we" or "I" as they'd say it).

- summary: 2 to 4 plain sentences, under 90 words. What it is, who it's for, where, and what it's trying to
  change. Lead with what matters most.
- points: up to 3 short points on what makes this idea different from others like it, each under 15 words.
  Only what their own material shows (for example a particular place, group, approach or something already
  done). If their material doesn't show anything distinctive yet, return fewer points or none: never invent
  or exaggerate.
- Use their facts and words. Don't add achievements, numbers, partners or claims they haven't made.

${SHARED_RULES}`;

const tidy = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** Applies the database limits: a summary of up to 1,200 characters and at most three points. */
export function normaliseSummary(raw: SummaryRaw) {
  return {
    summary: tidy(raw.summary, 1200),
    points: [...new Set(raw.points.map((p) => tidy(p, 200)).filter(Boolean))].slice(0, MAX_POINTS),
  };
}
