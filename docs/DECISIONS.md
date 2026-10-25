# Decisions

Newest first. Each entry: decision, why, and what would make us revisit it.

## 2026-10-25 — Gusty's reading: provenance per item, and your words always win (stage 3)
The reading is stored item by item in `project_facts`, each marked *your words* (user), *from your words*
(Gusty restating what they wrote) or *Gusty's suggestion* (inferred), and *proposed* or *confirmed*.
A new reading only replaces unconfirmed AI items; anything the person wrote or confirmed is never touched
(`planRefresh`). Unknowns are shown as "Not mentioned yet", never guessed.

## 2026-10-25 — AI provider layer, structured output, server-side fallback
Tasks call a small `AiProvider` interface (`src/ai`), not the vendor SDK, so the model or provider can
change per task. Claude returns schema-checked JSON (Zod), then code enforces list and length limits.
Default model Claude Opus 5.5 at medium effort (`GUSTY_AI_MODEL` overrides it). Anthropic's server-side
fallback is on, so an over-cautious safety decline is retried on another Claude model rather than failing.
Without a key the app uses a labelled demo. Revisit model choice once real usage and cost are measured.

## 2026-10-25 — AI usage log without content, and a daily limit
Every AI call is logged in `ai_runs` with model, prompt version, tokens and estimated cost, never the idea
text. A person can request 30 readings per 24 hours. Revisit the limit with real usage.

## 2026-10-25 — Guests first, email to keep (stage 2)
Saving an idea needs no account: the server creates a Supabase anonymous session on first save.
"Keep your projects" attaches an email to that same account (confirmed by a link), so nothing is moved
or lost. Someone already registered gets a normal sign-in link. Revisit if guest accounts are abused
(add CAPTCHA) or if we add passwordless passkeys.

## 2026-10-25 — Least-privilege tables
RLS on every table plus column grants: clients can only write `title` and `idea`; owner, organisation and
timestamps come from defaults. Signed-out visitors have no table access at all. Tested in `tests/db`.

## 2026-10-25 — Migrations applied by hand for now
The founder runs each new migration in the Supabase SQL Editor before merging. No database password or
access token leaves Supabase. Revisit when migrations become frequent: run them from CI with a stored token.

## 2026-10-25 — Session reads happen only at request time
Next 16 prerenders everything it can; Supabase checks token expiry against the clock. The server client
calls `connection()` so session work never runs during prerendering, and session-dependent UI sits
inside `<Suspense>`.

## 2026-10-24 — Brand name is "Gusty"
Founder decision. One "y" everywhere: code, copy, assets, domains. The "Gustyyy" lockups in the reference
PDF are not used. A unit test fails if "gustyyy" appears in interface text.

## 2026-10-24 — Vectorise the PDF artwork by tracing, not redrawing
The founder asked for the existing artwork to be vectorised without changes. Traced with potrace from the
embedded images; no manual or AI redrawing. Revisit if original vector files are found.

## 2026-10-24 — Fonts: Caveat Brush (display) and Google Sans Flex (UI)
The reference fonts were unnamed suggestions. Closest free matches after side-by-side comparison with the
reference sheet. The display style adds a slight stroke and slant to match the lettering's weight and lean.
Revisit if the founder commissions or licenses a custom display face.

## 2026-10-24 — Stone-strong added for secondary text
Stone (#777671) fails WCAG AA for body text on Paper (4.2:1). Added `#5F5E59` (6.0:1). Needs founder sign-off as a palette addition.

## 2026-10-24 — Built-in Next.js i18n instead of next-intl
Next 16 supports locale routing with `[lang]` + `next/root-params` and static generation per locale. One less
dependency to maintain. Revisit if we need ICU plural/select messages at scale.

## 2026-10-24 — One Next.js app; Python deferred to Opportunity Discovery
Milestone 1 has no Python-specific work. Adding FastAPI now would double deploys, CI and auth boundaries
for no user benefit. It arrives for funder-document parsing, data cleaning and ranking.

## 2026-10-24 — Render, region Frankfurt, free plan for previews
Founder's choice of host. EU region for GDPR proximity to Supabase. Free plan sleeps when idle; upgrade to
Starter before real users. Vercel would be smoother for Next.js but splits hosting from the future Python service.

## 2026-10-24 — Guest-first sign-in (planned, stage 2)
People can describe an idea before creating an account (Supabase anonymous session), then keep it with an
email magic link. Lower barrier, aligned with the neuroinclusive principles.
