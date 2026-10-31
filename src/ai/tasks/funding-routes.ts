import { z } from "zod";
import { SHARED_RULES } from "./context";

export const ROUTES_PROMPT_VERSION = "funding-routes@1";
export const ROUTES = [
  "small_grant", "council", "crowdfunding", "sponsorship", "larger_grant", "residency", "prize", "social_investment",
  "earned_income",
] as const;
export type Route = (typeof ROUTES)[number];
export const FOCUSES = ["social", "environmental", "arts_culture", "community", "education", "health", "other"] as const;
export type Focus = (typeof FOCUSES)[number];
export const NEEDS = ["under_1k", "1k_10k", "10k_50k", "over_50k", "unsure"] as const;
export type Need = (typeof NEEDS)[number];
/** At most three routes: the three-step principle. */
export const MAX_ROUTES = 3;

const route = z.object({ route: z.string(), focus: z.string(), fit: z.string(), why: z.string(), firstStep: z.string() });
export const RoutesSchema = z.object({ routes: z.array(route) });
export type RouteRaw = z.infer<typeof route>;

const NEED_WORDS: Record<Need, string> = {
  under_1k: "under £1,000",
  "1k_10k": "between £1,000 and £10,000",
  "10k_50k": "between £10,000 and £50,000",
  over_50k: "more than £50,000",
  unsure: "not sure yet",
};

export const ROUTES_PROMPT = `You are Gusty, a calm, warm companion that helps people turn ideas into real projects.
Many people you help are neurodivergent, tired, or new to project work.

Suggest the funding routes that best suit this project as it is now: at most 3, best first. Use only these
routes: small_grant (small community pots and local funds), council (council, ward or parish funding),
crowdfunding, sponsorship (local businesses and in-kind support), larger_grant (trusts, foundations, lottery
and national funds), residency (residencies, fellowships, bursaries), prize, social_investment (community shares
or loans for social enterprises), earned_income (selling, ticketing, fees).

Match the routes to how much money the person says they need, how far along the project is and what it's
about. A small, early project usually suits small grants, council funding, crowdfunding or sponsorship; larger
grants usually need a clearer plan and some track record.

For each route:
- route: one of the values above.
- focus: what kind of funder it would appeal to: social, environmental, arts_culture, community, education,
  health or other.
- fit: strong or possible.
- why: one plain sentence on why this route suits this project now.
- firstStep: one small, concrete thing they could do this week to explore it, under 20 words.

These are your general suggestions, not research: don't name any funder, platform, amount or deadline.

${SHARED_RULES}`;

export function routesMessage(context: string, need: Need | null): string {
  return `${context}

How much money they think the project needs: ${need ? NEED_WORDS[need] : "they haven't said"}`;
}

const tidy = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
const pick = <T extends string>(value: string, allowed: readonly T[], fallback: T | null): T | null => {
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
};

/** Keeps at most three known routes, once each, with tidy text. */
export function normaliseRoutes(raw: RouteRaw[]) {
  const seen = new Set<string>();
  const out = [];
  for (const r of raw) {
    const route = pick(r.route, ROUTES, null);
    if (!route || seen.has(route)) continue;
    seen.add(route);
    out.push({
      route,
      focus: pick(r.focus, FOCUSES, "other") as Focus,
      fit: pick(r.fit, ["strong", "possible"] as const, "possible") as "strong" | "possible",
      why: tidy(r.why, 400),
      firstStep: tidy(r.firstStep, 300),
    });
    if (out.length >= MAX_ROUTES) break;
  }
  return out;
}
