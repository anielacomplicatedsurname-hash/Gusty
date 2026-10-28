/**
 * "Help Gusty take off": Stripe Payment Links (public URLs, safe to commit). The founder creates
 * them in Stripe (see docs/SUPPORT.md). An empty link hides that option; with no one-off links the
 * whole support card is hidden, so nothing half-finished ever shows.
 */
export const supportLinks: SupportLinks = {
  currency: "GBP",
  oneOff: {
    3: "https://buy.stripe.com/6oU28qgzk9w3ebf9Mj8so07",
    5: "https://buy.stripe.com/5kQaEWgzkfUr1otgaH8so08",
    10: "https://buy.stripe.com/3cI14mdn89w35EJ9Mj8so09",
    other: "https://buy.stripe.com/14AdR85UG23B4AF6A78so0a",
  },
  monthly: {
    3: "https://buy.stripe.com/5kQ5kCfvg5fN5EJ9Mj8so0b",
    5: "https://buy.stripe.com/9B600i0AmbEb9UZcYv8so0c",
    10: "https://buy.stripe.com/14AeVcercbEb3wBgaH8so0d",
  },
  // Stripe customer portal login: monthly supporters update their card, see receipts or stop.
  manage: "https://billing.stripe.com/p/login/00weVc4QCaA77MR1fN8so00",
};

/** Where supporters write about refunds, and the refund promise shown on the site and in Stripe. */
export const supportContact = { email: "hello@heygusty.com", refundDays: 14 } as const;

export type SupportLinks = {
  /** The currency the Stripe prices are in (ISO code), shown on the card. */
  currency: string;
  oneOff: { 3: string; 5: string; 10: string; other: string };
  monthly: { 3: string; 5: string; 10: string };
  manage: string;
};

export type SupportChoice = { amount: number | "other"; href: string };
export type SupportChoices = { currency: string; oneOff: SupportChoice[]; monthly: SupportChoice[]; manage: string | null };

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
  return { currency: links.currency, oneOff, monthly, manage: monthly.length > 0 && isStripeLink(links.manage) ? links.manage : null };
}
