# Supporting Gusty (Stripe Payment Links)

Gusty isn't a registered charity, so the card says "support", never "donation", and says it isn't
tax-deductible. Payments happen entirely on Stripe's own pages: Gusty stores no payment data, holds no
Stripe keys and needs no webhook. The card only appears once links are added in `src/config/support.ts`.

## Links the founder creates in Stripe (Payment Links → New)
| Use | Type | Price |
|---|---|---|
| One-off €3, €5, €10 | One-time | Fixed |
| One-off "Other amount" | One-time | "Customers choose what to pay", minimum €2 |
| Monthly €3, €5, €10 | Recurring, monthly | Fixed |
| Change or stop monthly | Settings → Billing → Customer portal → login link | — |

For every payment link, **After payment** → redirect to `https://heygusty.com/en/thank-you`.

## Turning it on
Paste the links into `src/config/support.ts` (only `https://buy.stripe.com/…` and `https://billing.stripe.com/…`
are accepted), then the home page card, the `/en/support` page and the footer link appear. Monthly options and
the "change or stop" link appear only when monthly links exist.
