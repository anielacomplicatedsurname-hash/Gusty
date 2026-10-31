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

## 2026-10-29 — "Help me summarise it", and "Help me say more" kept short
Founder feedback: by the time people reach the bottom of a step they've already written a lot, so the
button became "Help me summarise it" and Gusty now summarises their answers and notes (shorter than what
they wrote, no new ideas) instead of drafting something new. "Help me say more" gave too much to read at
once: it is now capped at about three times what the person wrote (at least 15, at most 120 words). The
prompt states the limit and the code enforces it, cutting at a full sentence where possible.

## 2026-10-29 — "The bigger picture", capped at 10
Founder feedback: "Show me the whole journey" was long and odd for a button. The modes now ask "How would
you like to take your next steps?", and the third is "The bigger picture: See more steps ahead as your idea
grows." It shows the same three steps as "Guide me through" under "Your immediate focus", then a quieter
"A little further ahead" list (the rest of this stage's steps as links, then Gusty's "Maybe later" ideas).
Ten items at most in total: a display limit, not a planning limit. Choosing it never asks Gusty for more
steps; it only shows what's already planned (Big possibilities, small steps).

## 2026-10-29 — Instrument Serif for page titles
The founder chose Instrument Serif for headlines, with the home headline's second line in italic
("Good ideas / deserve to move."), and asked for it on all big titles so the site stays consistent.
Caveat Brush stays for the small hand-lettered overline ("Big possibilities. Small steps.") and its
hand-drawn underline. Self-hosted via next/font like the other fonts; no new dependency.

## 2026-10-29 — Explore starts with funding the founder curates and checks
To connect Projects and Explore, Gusty needs real opportunities, never invented ones. The founder chose a
curated list (funding only, UK and Europe) over live web search for now. In the admin area she pastes a
funder's link; Gusty reads the page via Anthropic's web fetch tool (Gusty's own server never fetches it)
and fills in only what the page says, leaving gaps empty. Nothing is shown until she checks it and
publishes; Explore then shows each opportunity with its source link and "checked on" date, hides drafts
and anything past its closing date, and reminds people to confirm on the funder's site. Explore is now a
real, indexable page. Slice 2 connects it to projects ("Possibilities for this project", "Save to my
project" as a step); live web search may follow as clearly-labelled "Search further".

## 2026-10-29 — Admin links only admins can see
The founder needs to reach the admin area without remembering addresses. Admins now see an "Admin" link in
the footer of every page and an "Add an opportunity" button on Explore. For everyone else these render
nothing (checked in the database on each page), so the admin area still isn't advertised.

## 2026-10-29 — Explore becomes a project-specific online search (curated list removed)
The founder found the curated list too manual ("still pretty analogue") and wants Explore to work from each
project. Explore now starts from one of the person's projects: Gusty runs a deep online search (Claude's web
search and web fetch, on Anthropic's side) from the project's neighbourhood outwards to local, regional,
national, continental and international opportunities, from council pots and local sponsorship to big funds.
Every result has its source link, is labelled "Found online on [date]. Not checked by Gusty", states only what
its page says (unknown deadlines read "check with the funder"), and carries Gusty's estimate of how hard it is
to apply (light, moderate, involved) and why it might fit, both labelled as Gusty's. Three "best places to
start" come first; the rest are folded away by scale. A search costs roughly £0.50 to £1, so it's limited to
one per project and three per person per day; results are kept. It runs after the response and the page
checks back. Search words describe the idea's theme and area only, never names or emails (privacy notice
updated). The founder-curated opportunities table and admin page were removed. Explore is no longer indexed.
Next: "Save to my project" turns a result into a step.

## 2026-10-31 — Explore: deep search allowance, freshness lights, saving, more kinds of support
Founder feedback after trying Explore. "Not checked by Gusty" undersold the work, so results now read "Found
by Gusty on [date]. Details can change, so confirm with the funder before you apply": still honest that the
details come from the web and can change. The search is called "Deep search", shows the day's allowance and
what each one costs Gusty, and widens to residencies, fellowships, prizes, commissions, sponsorship, in-kind
support, accelerators, crowdfunding and social investment, each labelled by kind. A side list shows each
project with a freshness light (up to date within a week, worth refreshing up to four weeks, out of date
after), always with a word, never colour alone; the three status colours are functional, not brand colours.
Results can be saved to the project, where they appear with "Add a step to check it". Decided for later:
paying for deep searches (free monthly allowance, extra for feedback, then credit packs and supporter
allowances, priced from real costs), and community-shared opportunities.

## 2026-10-31 — "Ready for funding": readiness from facts, routes from Gusty
The founder asked for a progress bar of how ready a project is for funding, and which kind of funding fits.
The bar counts seven things funders usually look for (clear idea, who it's for, where, roughly how much it
needs, a plan, some progress, an opportunity saved), from what's actually in place, with no AI scoring, so it's
always clear why. Gusty's reading counts once confirmed. It's framed as "not a score", with at most three
"what would help next" links. "Roughly how much would it need?" is the person's own answer (five bands).
Funding routes (small grant, council, crowdfunding, sponsorship, larger grant, residency, prize, social
investment, earned income) with a focus (social, environmental, arts and culture...) are Gusty's labelled
estimate, at most three, without naming funders or amounts; Explore finds real opportunities.

## 2026-10-31 — Bringing in a project from a PDF, without keeping the file
The founder wants people to bring in projects they're already working on. A PDF (up to 10 MB, 100 pages, three
a day) can start a new project (on My Projects) or be added to one (on its page). Claude reads it via the
Messages API's document input; Gusty keeps only its notes: a short summary, up to ten things the document says
are already done, and suggestions for "Here's what I understood" where nothing is there yet, always as
proposals to confirm. The file itself is never stored (simpler and more private, and no file storage to run),
and the notes can be forgotten from the project page. The notes are labelled as the person's own material,
not verified, and are part of every later AI request for the project. Uploads go to their own route handler
(`/api/documents`) so the larger body limit applies only there; it checks the request comes from Gusty's own
pages, the size before reading, and that the file really is a PDF.

## 2026-10-31 — A calm project home, and welcoming people back
A UX review found the project page had grown to about seven phone screens, with the next step around the
third. The page now has one "Your next step" card at the top (chosen in order: let Gusty read the idea, choose
a direction, the current step, plan the next stage, then look for opportunities), a line of progress (stage,
"Ready for funding: n of 7", opportunities saved) and four areas as tabs: Plan, Idea, Funding, Notes. Plan
opens first once there's a plan; before that, Idea does, so people see Gusty's reading. Funding is always
there but isn't pushed early. Tabs are links (`?tab=`), so they work without JavaScript and can be shared.
The home page greets returning people with their most recent project and its next step, My Projects cards
show each project's stage, next step, readiness and how fresh its deep search is, and guests see "Keep your
projects" before anything else.

## 2026-10-31 — "Your idea, as it stands": one summary that grows with the project
The founder wants the Idea area to show a neat summary of everything said so far, focused on what makes the
idea different (the "idea master" from earlier feedback). Gusty writes 2 to 4 sentences and up to three
"what makes it different" points from the person's own material only (idea, confirmed reading, step answers
and notes, documents), labelled as Gusty's summary with its date. It's written automatically the first time,
then only refreshed when the person asks ("You've added more since this summary"), so it never changes under
them and doesn't spend money on every visit. The person's original words are folded underneath, still
editable and never changed. Stored in its own table so a refresh doesn't count as editing the project.


## 2026-10-31 — The idea grows with the steps: one card, and suggestions the person chooses
The founder found "Here's what I understood" and the summary confusing side by side, and couldn't see where
the writing in steps went. Now the Idea tab is one card, "Your idea, as it stands": Gusty's summary, then any
updates Gusty suggests, then the key facts ("Here's what I understood"), then the person's original words.
When a step is marked done, Gusty reads what was written in it (answers, notes, summary) in the background and
may suggest up to three updates to the key facts, usually none or one, only from the person's own words, each
saying which step it came from. Nothing changes until the person taps "Use this" (the fact becomes confirmed);
"Not now" puts it away. A quiet chip on the project home says when there's one waiting. Suggestions are stored
in `fact_suggestions` (owner-only; the app can only accept or dismiss them). One small AI call per finished
step that has writing in it, counted in the daily limit. The Notes tab keeps its name and now says what it's
for and where it feeds in.

## 2026-10-31 — Gusty updates its own guesses from steps; it asks before changing the person's words
In practice "Here's what I understood" barely moved, because every change waited for a tap. The founder chose
to let it grow by itself. After a finished step, Gusty now fills empty items, adds to lists (at most five
each) and replaces its own unconfirmed guesses straight away. Each change shows "Updated from: *step*" with
Undo, which puts back exactly what was there. It still asks first ("Use this / Not now") before changing
anything the person wrote or confirmed. Open questions that a step answers are folded under "n answered in
your steps", with the answer, and "Bring it back" reopens them. A new reading of the idea ("Read my idea
again") keeps everything the steps added. Confirming an item keeps it and drops the Undo. A chip says "Your
idea grew from your steps" for three days after a change. Changes are recorded in `fact_suggestions` (status
`applied`, with the previous value), and a change can only point at an item in the same project.

## 2026-10-31 — No "That's right": editing makes something yours
The founder found the "That's right" button unnecessary. It's gone. Each item already says where it came
from ("Your words", "From your words", "Gusty's guess"), and editing something makes it the person's, so Gusty
won't change it without asking. Guesses say "Edit to make it yours". "Ready for funding" now counts the
person's words and Gusty restating them, but not Gusty's own guesses. Items confirmed before this change
still count and stay protected. The Idea tab also says that editing there doesn't change Notes: Notes is the
person's record of their steps and feeds the idea, never the other way round.

## 2026-11-01 — The project bank: the first slice of "Help me apply"
The founder wants applications to draw on everything about a project and sound like the founder, not a
template. So before drafting, Gusty keeps a bank in the Story tab (renamed from Notes; old `?tab=notes` links
still work). It holds:
- **Your experience:** past projects, past wins, what people said, numbers. These are the person's own words,
  with an optional https link.
- **Research that backs your idea:** credible studies, official figures and trusted reports, found with web
  search. Gusty keeps only sources it read during the search, each with a safe https link, publisher and year,
  and shows "Found by Gusty on [date]. Check the source before you use it in an application". The link to
  the project is marked "Gusty's suggestion". Research has its own small allowance (1 per project and 2 per
  person a day), separate from deep search, and runs can't be deleted to reset it.
- **How you write:** three to five traits and an example sentence. Gusty builds them only from the person's own
  writing (idea, their answers and notes, their own facts and experience; never Gusty's drafts, tidied copies
  or helped answers), once there are at least 60 words. The person can edit it, and it becomes theirs.

Next slices: an application space per opportunity (bring in the form, questions, T&Cs and guidance by upload,
paste or public link), then drafting answers in the person's voice using the funder's key terms.

## 2026-11-01 — Application spaces: read the funder's papers, then show the fit
The second slice of "Help me apply". Each project can have application spaces, started from a saved
opportunity ("Prepare an application", one space per opportunity) or for something the person found
themselves. People bring in the funder's papers (the form or questions, guidance, terms, past winners) by
PDF upload, pasted text or a public link. Links are read with web fetch only, never web search. Pages behind
a login can't be opened, and the screen says to download a PDF or paste the text instead.

Gusty keeps only what it read, never the file or the pasted text. That means:
- the questions, word for word, with limits;
- the funder's priorities in their own key phrases;
- rules ("can apply", "ruled out", "you'll need to");
- key details as they're written;
- past winners, and the funder's tone;
- the page number for PDFs.

All of it is labelled "check the original". Items repeated across papers are shown once, with every source.

After each paper, Gusty works out in the background how the project fits:
- where it already matches;
- what's missing, with one small suggestion each;
- "Their words, your way": the funder's phrases, and how the person might say them in their own voice;
- rules to check carefully.

The fit uses the project, its story (experience, research and voice) and the papers. It never says whether
someone is eligible, and it never invents evidence. Up to 8 papers per person a day. A fit stuck "running"
for 5 minutes is shown as failed, with "Work it out again". Drafting answers is the next slice.

## 2026-11-01 — Drafting answers, one question at a time
The third slice of "Help me apply". Every question from the funder's papers (shown once, even if it's in
several papers) gets an answer box with a word or character counter against the funder's limit.

**"Help me draft this":** Gusty drafts the answer:
- in the person's voice, following "How you write";
- from their project and Story only, using the funder's key phrases where they fit naturally;
- aiming for about 90% of the limit.

It never invents anything. Whatever the answer needs but the person's material doesn't show is left as a
short placeholder [in brackets] and listed under "To make this stronger", with one small way to find it.

**Ownership:** a draft is labelled "Gusty's draft"; editing and saving makes it "Your words". "Draft it
again" builds on what's there and keeps the person's words where it can.

**Getting answers out:** a copy button on each answer, and a plain-text download of every answer to paste
into the funder's form. Nothing is ever sent to a funder.

Limit: 30 drafts per person a day, inside the daily AI limit.

## 2026-11-01 — A calmer application space: four short tabs
The founder found the application space too long. On a phone it was about five screens with only two
questions, before any answers. It now works like the project home:
- **Tabs:** Papers · What they want · Your fit · Answers.
- **Progress:** one line above the tabs ("1 paper read · 0 of 2 answered") and one next thing to do
  ("Next: question 1").
- **Opening tab:** a new space opens on Papers. Once it has papers it opens on Answers, the main work. After
  adding a paper, people stay on Papers.

Each view is shorter:
- **Papers:** the add-a-paper form folds away into "Add another paper" once there's one.
- **What they want:** the brief no longer repeats the questions (they're in Answers). Key details, past
  winners and tone fold under "More from their papers".
- **Your fit:** "Their words, your way" and the rules to check fold away.
- **Answers:** each question folds to one line with its status ("Not started", "Gusty's draft", "Your
  words") and its word count. One question is open at a time, starting with the first unanswered.

Each view is now one to two phone screens.

## 2026-11-01 — Clearer fit and rules: a traffic light and three plain groups
**Fit:** shown as a traffic light, using the same red, amber and green as the Explore freshness lights. Each
level is always shown in words as well as colour:
- "Looks like a good fit";
- "Partly fits";
- "Not a clear fit yet".

Each level comes with one short line saying it's Gusty's view, not the funder's decision.

**"Check these rules carefully" is gone from Your fit,** because it repeated the rules. Any rule the project
may not meet now appears under "What would make it stronger", with a small next step such as asking the
funder. Matches have a green edge with ✓, and things to add have an amber edge with →.

**Rules in "What they want":** shown first, as three cards with their own icon and colour instead of a small
label repeated on every line:
- "Who can apply" (✓, green);
- "What you'll need" (☐);
- "What they won't fund" (✕, red).

This is for people who scan rather than read, and who need "Can I apply?" answered first.

Fits saved before this change have no light until "Work it out again".
