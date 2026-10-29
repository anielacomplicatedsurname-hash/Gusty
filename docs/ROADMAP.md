# Roadmap

## Product stages (directive §21)
1. **Foundation** — infrastructure, identity, design system, project knowledge, a working idea-to-action journey ← *now*
2. **Opportunity Discovery** — source-backed funding intelligence for one bounded region or sector (Python arrives here)
3. **Application Intelligence** — eligibility support, funder research, grounded proposal preparation
4. **Connections and Networking** — people, communities, events, consent-based collaboration
5. **Advanced Creation and Delivery** — budgets, plans, presentations, audio, team work, reporting
6. **Institutional and International Expansion** — integrations, more languages, white-label deployments

## Milestone 1 (Foundation)

| Stage | Scope | Done when | Status |
|---|---|---|---|
| 0. Foundations | Repo, docs, CI, Render blueprint, empty app deployed | Preview URL live, CI green | **Done** — live at gusty-web.onrender.com |
| 1. Design system and shell | Tokens, fonts, brand assets, responsive nav with mobile bottom bar, Home | Founder approves the look on phone, tablet, desktop | **Done** — approved (fonts may change later) |
| 2. Projects and saving | Supabase schema + RLS, guest sessions, email save, autosave, My Projects | An idea survives closing the browser; RLS tests pass | **Done** — verified live by the founder |
| 3. AI interpretation | AI layer, `interpretIdea`, editable "Here's what I understood" card, demo mode | Real interpretation, edited and saved with provenance labels | **Done** — verified live by the founder |
| 4. Directions, steps, modes | Up to 3 directions and next steps, three modes, "I'm stuck" | Full journey works on a phone | **Done** — verified live by the founder |
| 5. Ready for testers | Service worker, admin basics, full e2e journey, security review | Installed on a phone, end-to-end green | **In progress** — install, offline page, export, deletion, security headers and admin overview built; tester email set up (Resend, heygusty.com), security review done |

## Known limitations (current build)
- Explore lists funding the founder has checked (UK and Europe); it isn't matched to projects yet (slice 2). Connections is still a "Coming next" placeholder, excluded from search engines.
- "Let Gusty fill it in" uses Anthropic's web fetch tool; if the organisation's Claude Console settings turn web tools off, it fails politely and the founder fills the form in herself.
- No full version history: instead, Gusty never changes anything the person wrote or confirmed (only unconfirmed AI items are replaced on a new reading). A browsable history can come later.
- Without `ANTHROPIC_API_KEY`, readings run in a clearly labelled demo mode that only repeats the first sentence.
- The real Claude call is not exercised by automated tests (no API key in CI); prompt, schema handling and limits are unit-tested, and readings were verified live by the founder.
- The Claude API key in Render may expire (the founder's current key lasts one month); when it does, readings fail politely until it is replaced.
- Readings are limited to 30 per person per day to protect the AI budget. There is no site-wide cap inside Gusty: the Anthropic Console spend limit is the firm ceiling (see `docs/SECURITY.md`).
- No CAPTCHA yet: needed before public launch to stop mass guest accounts and email requests.
- The admin overview shows totals only: no charts, no per-person view (on purpose), days in UTC, costs estimated from token counts.
- There is one kind of admin (the founder). Roles for institutions come with white-label deployments.
- Offline, Gusty shows a calm offline page; projects themselves are not available offline (they are never cached on the device, by design).
- The Content Security Policy still allows inline scripts (Next.js needs them without per-request nonces); tightening it is a later step.
- Sign-in emails come from hello@heygusty.com via Resend (free plan: 100 a day). They're in English only, and their wording lives in `supabase/templates/` rather than the message files, because Supabase sends them.
- A guest whose email already has an account can bring their projects into it within an hour, by opening the sign-in link on the same device or typing the email's code there. Opening the link on another device signs them in there, and the guest projects stay in the original browser.
- Guests who never add an email keep their projects only in that browser. Old unused guest accounts are not cleaned up yet.
- Database changes are applied to production by hand (SQL Editor) before merging.
- No always-available assistant button yet (deferred: the directive's first milestone doesn't need it; it fits better with Connections and Explore).
- Directions, steps and "I'm stuck" help can't be fully tested without the AI key; automated tests use the labelled demo versions.
- "What you've worked out" shows answers and notes but doesn't update "Here's what I understood"; the AI context keeps only about 4,000 characters of them (earliest steps first).
- Tidying only happens with the AI key set (in demo mode the person's words are shown as written), runs when an answer box is left rather than as they type, and has its own allowance of 150 a day. Answers written before this change are tidied the next time their box is used.
- The plan grows one stage at a time; there's no timeline yet. When one comes, it will only use dates the person sets (no deadlines from Gusty).
- Unticking a step in a finished stage isn't offered: past stages are kept as they were (their steps can still be opened and edited).
- All AI calls share a limit of 60 per person per day (readings keep their own 30).
- Tablet uses the desktop header navigation (no separate side rail).
- Logo and symbols are traced from the images in the PDF; original vector artwork, if it exists, would be sharper at very large sizes.
- Fonts are free matches for unnamed suggestions; display and accent fonts cover Latin scripts only.
- Render builds with `npx pnpm@10.28.0` (pinned to `packageManager` in package.json): update both together.
- Guest projects started on gusty-web.onrender.com before the move to heygusty.com stay with the old address's session; adding an email there and signing in on heygusty.com brings them back.
- Support payments go through Stripe Payment Links (Managed Payments off for these links). Gusty doesn't record who supported it; Stripe's dashboard is the record. Monthly supporters change their amount by stopping and choosing a new one (Stripe's portal can't switch between same-interval prices of one product).
- The privacy notice and terms are written from how Gusty works but haven't had a legal review. The founder may need to pay the ICO data protection fee as a sole trader handling personal data.
- "Work on this with Gusty": up to 3 questions per step, "Say it differently", "Different questions", answers and notes. Answers show in "What you've worked out" on the project page (tidied by Gusty, original one tap away) and feed later suggestions. "Help me say more" grows an answer to about three times its length (15 to 120 words), labelled as Gusty's help. "Help me summarise it" sums up the answers and notes (Shorter, Simpler, Warmer), kept only if the person chooses. Plans grow one stage at a time, with a calm "stage done" moment (at most 3 options). "The bigger picture" shows at most 10 items: three in focus, the rest quieter. Next: a timeline with dates the person chooses, if testers want one.
- Render plan is set to `free` (sleeps when idle) until the founder decides to upgrade.
