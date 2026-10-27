/**
 * "Help Gusty take off": Stripe Payment Links (public URLs, safe to commit). The founder creates
 * them in Stripe (see docs/SUPPORT.md). An empty link hides that option; with no one-off links the
 * whole support card is hidden, so nothing half-finished ever shows.
 */
export const supportLinks: SupportLinks = {
  oneOff: {
    3: "https://buy.stripe.com/00weVc4QCaA77MR1fN8so00",
    5: "https://buy.stripe.com/7sY14m96S5fN6IN9Mj8so01",
    10: "https://buy.stripe.com/eVq28qfvg5fN4AF8If8so02",
    other: "https://buy.stripe.com/dRmeVcbf09w32sxf6D8so03",
  },
  monthly: {
    3: "https://buy.stripe.com/9B67sK96SeQn1otcYv8so04",
    5: "https://buy.stripe.com/cNi28q5UG0Zxffj0bJ8so05",
    10: "https://buy.stripe.com/5kQ4gygzkdMj1ot6A78so06",
  },
  // Stripe customer portal login: monthly supporters update their card, see receipts or stop.
  manage: "https://billing.stripe.com/p/login/00weVc4QCaA77MR1fN8so00",
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
