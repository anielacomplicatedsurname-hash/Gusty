/**
 * "Help Gusty take off": Stripe Payment Links (public URLs, safe to commit). The founder creates
 * them in Stripe (see docs/SUPPORT.md). An empty link hides that option; with no one-off links the
 * whole support card is hidden, so nothing half-finished ever shows.
 */
export const supportLinks: SupportLinks = {
  oneOff: { 3: "", 5: "", 10: "", other: "" },
  monthly: { 3: "", 5: "", 10: "" },
  // Stripe customer portal login link, where monthly supporters change or stop their contribution.
  manage: "",
};

export type SupportLinks = {
  oneOff: { 3: string; 5: string; 10: string; other: string };
  monthly: { 3: string; 5: string; 10: string };
  manage: string;
};

export type SupportChoice = { amount: number | "other"; href: string };
export type SupportChoices = { oneOff: SupportChoice[]; monthly: SupportChoice[]; manage: string | null };

/** Only Stripe's own payment and billing pages are allowed as destinations. */
const isStripeLink = (href: string) => /^https:\/\/(buy|billing)\.stripe\.com\/\S+$/.test(href);

export function supportChoices(links: SupportLinks = supportLinks): SupportChoices | null {
  const pick = (entries: [string, string][]): SupportChoice[] =>
    entries
      .filter(([, href]) => isStripeLink(href))
      .map(([amount, href]) => ({ amount: amount === "other" ? "other" : Number(amount), href }));
  const oneOff = pick([["3", links.oneOff[3]], ["5", links.oneOff[5]], ["10", links.oneOff[10]], ["other", links.oneOff.other]]);
  if (oneOff.length === 0) return null;
  const monthly = pick([["3", links.monthly[3]], ["5", links.monthly[5]], ["10", links.monthly[10]]]);
  return { oneOff, monthly, manage: monthly.length > 0 && isStripeLink(links.manage) ? links.manage : null };
}
