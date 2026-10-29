# Decisions

Newest first. Each entry: decision, why, and what would make us revisit it.

## 2026-10-25 — Next steps: directions, small steps, modes and help when stuck (stage 4)
- **Directions first, then steps.** Gusty suggests up to 3 directions with one recommended and the reason
  shown; the person chooses, then Gusty plans 3–7 small steps, the first the easiest. Two calls, but the
  person stays in control of where the project goes.
- **Modes change what's shown, never the data** (`visibleSteps`): Keep it simple = 1 step, Guide me
  through = up to 3, Let me see everything = all, including done steps. The mode is saved per person.
- **Nothing is lost.** Done steps are kept; changing direction or making a step smaller sets old steps
  aside (`replaced`) rather than deleting them.
- **I'm stuck does something concrete:** split into 2–3 steps of 15 minutes or less, a plainer
  explanation with an example, or a 2-minute first action plus a ready-to-use draft.
- **Prompts share one injection-safe project frame** (`src/ai/tasks/context.ts`) and the same rules: no
  named funders, deadlines or amounts, no pressure, same language as the idea.
- **Shared AI budget:** 60 AI calls per person per day across these tasks (`src/ai/usage.ts`).
- **Assistant button deferred**, not needed for the first milestone's journey.

## 2026-10-25 — Gusty suggests project titles (prompt v3)
Founder request: each idea gets a short, memorable, descriptive title, used in My Projects. The reading
returns a 2–6 word title; it replaces the automatic first-line title unless the person has named the
project themselves (`projects.title_source`: auto · ai · user). Renaming sets `user`, and Gusty never
changes it again. The demo never suggests a title. AI failures now record a reason in `ai_runs.error`
(key, busy, declined, invalid, other) so problems can be diagnosed without logs; people still see a calm
message.

## 2026-10-25 — Gusty rewords for clarity, keeping the meaning (prompt v2)
Founder feedback: the first readings copied the person's wording, including grammar slips and unclear
phrasing. Gusty now keeps meaning and intent exactly but rewrites items in clear, correct language, never
adding or changing facts; anything too unclear to reword without guessing becomes an open question.
"From your words" still marks items whose meaning came from the person.

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

## 2026-10-25 — Hand-written service worker; nothing private cached
Serwist (in the original plan) would add a dependency and build step for ~50 lines of behaviour. Gusty's
service worker caches only versioned static files and an offline page; pages always come from the network,
so private projects never stay on a shared or lost device. Trade-off: no offline editing. Revisit if testers ask for it.

## 2026-10-25 — Account deletion through a database function
Deleting a Supabase user normally needs the secret service key on the server. A `security definer` function
that deletes only `auth.uid()` keeps that key out of the app entirely. Everything the person owns cascades.

## 2026-10-25 — Admin overview: one database function, counts only
One `security definer` function returns all the numbers, after checking the caller is in `admins`. No service
key in the app, no admin write actions, no per-person drill-down: the founder sees how Gusty is used and what
it costs without seeing what anyone wrote. A fuller admin panel (roles, branding) waits for white-label needs.

## 2026-10-25 — Email through Resend from heygusty.com
The founder owns heygusty.com. Resend (free up to 3,000 emails a month) with a verified domain lands in
inboxes more reliably than a personal sender address. Gusty's email wording lives in `supabase/templates/`,
not the message files, because Supabase renders and sends these emails. Translations will need one template set per language.

## 2026-10-25 — No site-wide AI budget inside Gusty (for now)
A site-wide cap computed from `ai_runs` could be switched off for everyone by one person logging fake
costs, because the log is written with each person's own session. The Anthropic Console spend limit is
enforced by Anthropic and can't be faked, so it is the ceiling. Revisit with a server-only log (service
key or a separate service) when Gusty opens publicly.

## 2026-10-25 — heygusty.com is the one address
Gusty's public address is `https://heygusty.com` (DNS at GoDaddy, custom domain on Render). Page visits to
`gusty-web.onrender.com` or `www.heygusty.com` are permanently redirected there, so search engines, sign-in
links and saved sessions all use one address. Guest projects started on the old address stay in that
browser's old session (few testers were affected; people who added an email just sign in again).

## 2026-10-27 — Guests can bring their projects into an existing account
The founder asked for "Welcome back to Gusty! … Sign in and keep my projects". Moving rows between accounts
needs proof the person controlled the guest session, so the guest's browser holds a one-time secret and the
move happens only after their sign-in link is opened on that device. Simpler than real account merging, no
service key, and no way to pull projects out of someone else's account.

## 2026-10-27 — Support through Stripe Payment Links
The founder wants one-off and monthly support (€3, €5, €10, other). Payment Links need no keys, code library
or webhook, and Stripe handles cards, Apple/Google Pay, receipts and cancelling. Gusty isn't a charity, so the
wording is "support", not "donation". No totals, goals or countdowns (no false urgency). Monthly has no "other
amount" because Stripe's pay-what-you-want links are one-time only.

## 2026-10-27 — Support in pounds sterling
The founder chose GBP over EUR for support payments. Stripe prices can't change currency, so new GBP prices
and links were made with the same amounts (£3, £5, £10, other from £2) and the euro links switched off.
The card's currency comes from `src/config/support.ts`.

## 2026-10-28 — Privacy notice, terms and feedback before inviting testers
Gusty stores emails, ideas and payments, so a privacy notice (UK GDPR) and plain terms come before testers.
Written from what the code does, for the founder (sole trader, UK) to review; legal review recommended.
Governing law is "the part of the UK where you live" rather than guessing a jurisdiction. Feedback is three
optional questions stored in Postgres and read on the admin page: no third-party form tool.

## 2026-10-28 — Feedback visible during testing; ideas stay private
The founder wants feedback to be easy to give. A slim "early testing" strip on every page and a card at the end
of each project page link to it: always there, never a pop-up. The terms and privacy notice now promise that
ideas are never shared between people or used for anyone else's suggestions (true: each AI request contains
only that project), and say plainly that similar ideas happen independently and Gusty can't be responsible for them.

## 2026-10-28 — "Work on this with Gusty": guided questions, not open chat
From the first tester: people want help completing steps, not just a list. A focused page per step asks up to
3 simple questions, each rewordable, with "Different questions" that never discards answers. An open chat box
was rejected for now: a blank prompt is harder for many neurodivergent people than three clear questions.
Drafting from the answers ("Help me write it") is the second slice.

## 2026-10-28 — Answers live in "What you've worked out" and feed Gusty's context
Tester question: "where do my answers go?" They now appear in their own section on the project page, below
"Here's what I understood", each step folded up by default with an Edit link back to it. Done steps link to
their page too. They are not merged into "Here's what I understood": that section is Gusty's reading, which
the person confirms; mixing in raw answers would blur whose words are whose. A later option is Gusty
suggesting reading updates from the answers, for the person to confirm. Answers and notes are added to every
later AI request for that project (capped at about 4,000 characters, earliest steps first, marked as the
person's own thinking, not facts), so Gusty builds on them instead of asking again. Answers on steps that are
later set aside stay visible, labelled "Set aside", so no work disappears. No new tables or migrations.

## 2026-10-29 — Tidied words and "Help me say more", always labelled
The founder asked for answers in "What you've worked out" to read well, and for a way to grow a short
answer. Gusty keeps a tidied copy (spelling, grammar, phrasing; no new ideas) next to the person's own
words, which are never overwritten: the tidied copy is shown with "Tidied by Gusty · Show what I wrote".
A database trigger clears a tidied copy as soon as the words change, so it can never describe an older
version. Tidying runs when the person leaves an answer box (not on every autosave), after the response,
with its own daily allowance (150) so it never uses up their suggestions; it uses the same model as other
tasks at low effort (a cheaper model is a later option for the founder to decide). "Help me say more"
returns a suggestion about three times longer that the person can use or ignore; using it marks the
answer "Gusty added ideas", so AI additions stay distinguishable from their own words.

## 2026-10-29 — A plan that grows, one stage at a time
The founder pointed out that a "full plan" up front isn't realistic: plans change as an idea develops.
Gusty now plans one stage (3 to 5 steps) at a time. When every step in a stage is done, a calm moment
offers at most three choices: plan the next stage (planned from everything done and worked out so far),
look back at this stage, or take a break. "Let me see everything" became "Show me the whole journey":
finished stages, the current one, and up to three "Maybe later" ideas clearly labelled as loose
possibilities, not a plan. Existing projects' steps were put into a first stage named after their
direction. A timeline is deferred, and when it comes, dates will only be ones the person chooses.
The same change fixed two gaps found on the way: guest step answers now move with "bring my projects"
(before, they were removed with the guest account), and the data download now includes stages, notes
and step answers.

## 2026-10-29 — "Help me write it": drafts are suggestions until kept
On a step page, Gusty drafts what the step asks for from the person's answers and notes, with Shorter,
Simpler and Warmer to reshape it. Nothing is saved until they choose "Keep this draft"; after that it's
an ordinary editable text, always labelled "started by Gusty" (on the step and in "What you've worked
out"), so AI writing is never mistaken for their own words. The prompt forbids inventing facts and uses
[square brackets] for anything only the person can fill in. In demo mode the "draft" only joins their own
answers, and says so. Kept drafts are part of the AI context for later suggestions and of the data download.
