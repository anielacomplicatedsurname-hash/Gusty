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
| 2. Projects and saving | Supabase schema + RLS, guest sessions, email save, autosave, My Projects | An idea survives closing the browser; RLS tests pass | **Built — awaiting review** |
| 3. AI interpretation | AI layer, `interpretIdea`, editable "Here's what I understood" card, demo mode | Real interpretation, edited and saved with provenance labels | Planned |
| 4. Directions, steps, modes | Up to 3 directions and next steps, three modes, "I'm stuck" | Full journey works on a phone | Planned |
| 5. Ready for testers | Service worker, admin basics, full e2e journey, security review | Installed on a phone, end-to-end green | Planned |

## Known limitations (current build)
- Explore and Connections are labelled "Coming next" placeholders, excluded from search engines.
- Projects hold the person's idea text only; Gusty's interpretation and next steps arrive in stages 3–4 (the project page says so).
- No version history yet: it arrives with stage 3, when AI suggestions could otherwise overwrite the person's words.
- Production email uses Supabase's built-in sender, which only reaches project team members. Custom SMTP is needed before real users (see `docs/SUPABASE_SETUP.md`).
- Guests who never add an email keep their projects only in that browser. Old unused guest accounts are not cleaned up yet.
- Database changes are applied to production by hand (SQL Editor) before merging.
- No assistant button yet; it arrives with stage 3.
- Tablet uses the desktop header navigation (no separate side rail).
- Logo and symbols are traced from the images in the PDF; original vector artwork, if it exists, would be sharper at very large sizes.
- Fonts are free matches for unnamed suggestions; display and accent fonts cover Latin scripts only.
- Render builds with `npx pnpm@10.28.0` (pinned to `packageManager` in package.json): update both together.
- Render plan is set to `free` (sleeps when idle) until the founder decides to upgrade.
