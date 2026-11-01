# Founder to-do

Things only Aniela can do (accounts, keys, payments, decisions). Claude keeps this list up to date;
tick items off by asking Claude, or edit the file.

## Before public launch
- [x] **Switch on bot protection (Cloudflare Turnstile, free plan).** (done 1 November 2026: tested in a private window, saving an idea works) No card needed, no DNS changes.
  1. Sign up at dash.cloudflare.com → **Turnstile** → **Add widget**: name "Gusty", hostnames
     `heygusty.com` and `www.heygusty.com`, **Managed** mode.
  2. **Render** → Gusty's service → Environment → add `TURNSTILE_SITE_KEY` = the **site key** → Save and deploy.
  3. **Supabase** → Authentication → Attack Protection → turn on CAPTCHA, provider **Turnstile**, paste the
     **secret key** → Save. (Never paste keys into a chat.)
  4. Check: in a private browser window, save an idea on heygusty.com.
  If anything goes wrong, turn CAPTCHA off in Supabase (step 3). Full notes: `docs/SUPABASE_SETUP.md`.
- [ ] **Pay the ICO data protection fee.** This is the UK data regulator, separate from Cloudflare. Tier 1
  (micro organisation) is about **£52 a year, or £47 by direct debit**. Pay at ico.org.uk →
  "Pay the data protection fee". Its short self-assessment confirms you need it; the payment page shows
  the current amount. Renew yearly.

## Soon
- [ ] **Replace the Claude API key before about 24 November**, when the current one expires. Create a new
  key in the Claude Console and put it in Render as `ANTHROPIC_API_KEY`. Keep web search and web fetch
  enabled for the key's workspace in the Console.
- [x] **Update the three sign-in email templates in Supabase** (done 1 November 2026) (new footer line "People. Ideas.
  Opportunities. A little wind beneath your wings."). Supabase → Authentication → Emails → Templates: for
  Confirm signup, Magic Link and Change Email Address, paste the whole of `confirmation.html`,
  `magic-link.html` and `email-change.html` from `supabase/templates/` → Save. Do this after merging.
- [ ] **Try "Dictate" for real** on your phone and laptop (the tests use a stand-in microphone).

## Later
- [ ] **Price credit packs and supporter plans** once there are about 4 weeks of real usage. See the cost
  per feature on the Admin page, or run the cost query Claude shared, then decide prices together.
  Worth a quick check with an accountant first, since selling credits is a sale rather than a donation.
