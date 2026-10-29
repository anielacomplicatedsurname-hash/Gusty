# Testing

| Layer | Tool | Where | Run |
|---|---|---|---|
| Lint | ESLint (next core-web-vitals + TS) | everything | `pnpm lint` |
| Types | TypeScript strict, Next route types | everything | `pnpm typecheck` |
| Unit | Vitest | `tests/unit` | `pnpm test` |
| Database rules | Vitest + supabase-js against local Supabase | `tests/db` | `npx supabase start`, then `pnpm test:db` |
| End-to-end | Playwright on phone (Pixel 7), tablet (820px) and desktop (1440px) | `tests/e2e` | `pnpm build && pnpm test:e2e` (`E2E_SUPABASE=1` adds the saving journey) |
| Accessibility | axe-core inside Playwright (WCAG 2.0–2.2 A/AA rules) | `tests/e2e/shell.spec.ts` | with e2e |

`pnpm check` runs lint, types and unit tests. CI (`.github/workflows/ci.yml`) runs all of the above on every PR.

## What's covered today
- Palette contrast for every text/background pair in use (unit).
- Locale config, RTL detection, no empty strings, no retired brand spelling (unit).
- Redirect to locale, Home content, disabled preview button, bottom bar only on mobile, header nav from
  tablet up, active nav state, bottom bar never covering content, skip link, axe scan (e2e).
- Title, description, canonical, hreflang, `noindex` on placeholders, robots.txt, manifest and icons (e2e).
- Idea, title, email and redirect validation (unit); site address handling (unit).
- Row Level Security: owner-only read, update and delete; no access when signed out; owner can't be forged (db).
- Gusty's reading (unit): limits, provenance mapping, never overwriting the person's words, prompt-tag safety, demo output, cost estimates.
- Gusty's reading (e2e, demo mode): appears automatically and labelled, confirm/edit/add/remove persist, reading again keeps the person's words.
- Reading items and AI log are private (db).
- Next steps (unit): mode visibility, switching modes never changes data, direction and step limits, prompt-tag safety, stage limits and earlier-stage history in the prompt; (e2e, demo): directions → steps, modes and reload, ticking off, make it smaller, help me start, explain differently, own steps, axe scan of the full project page, stages: finishing a stage shows at most three calm choices, planning the next stage, the whole journey with past stages and "Maybe later" (axe); (db): directions, steps and preferences private.
- Titles (unit): tidying, length, demo never invents one; (e2e): rename shows in My Projects and survives reading again.
- Your data and the app (e2e): download, export refused without a session, delete a project, delete an account (its project is gone afterwards), security headers present and no CSP errors in the console, offline page served by the service worker, service worker never caches pages; (db): `delete_my_account` removes only the caller and refuses signed-out visitors.
- Admin overview (e2e): looks like a missing page to signed-out and ordinary people, shows counts but never ideas to an admin, axe scan; (db): refused to non-admins, the admins list can't be read or written from the app.
- Security (unit + e2e): sign-in redirects can't leave the site, including hidden-character tricks; (db): organisations closed, usage log bounds.
- Signed-in badge on every page for people with an email, never for guests; a sign-in code landing on the home page is passed on to finish signing in (e2e).
- Support (unit): only Stripe links accepted, card hidden without one-off links, order of amounts; (e2e): card with live Stripe links, monthly view, footer link and support page, axe scan, thank-you page noindex.
- Sign-in code (e2e): a wrong code explains itself; the right code keeps a guest's projects, and brings guest projects into an existing account.
- Testers (e2e): privacy notice and terms from the footer with axe scans; feedback from the footer remembers the page, explains an empty form, and shows on the admin page; (db) feedback can't be read back, is limited to 20 a day, and refused when signed out; (unit) feedback answers and page tidying.
- Working on a step (e2e, demo): questions appear (max 3), "Say it differently" rewords, answers and notes autosave and survive reload, "Different questions" keeps answers, axe scan, "This step is done" ticks it, "What you've worked out" shows the answer folded up and opens it, its Edit link and the done-list link reopen the step, axe scan of the project page, "Help me say more" (keep mine, use this, label survives reload, axe), tidied answers shown with the original one tap away, "Help me write it" (needs an answer first, demo draft labelled, keep, edit, reload, shown in "What you've worked out", axe); (unit) question limits, no repeats, tag safety, worked-out answers in the AI context are neutralised and size-capped; (db) step questions are owner-only, a tidied copy is cleared when the words change. The background tidying was checked by hand against a stand-in AI server (no key in tests).
- Saving journey: save without an account, autosave, reload, private to the owner, empty-idea message, keeping projects via a real confirmation email in the local test inbox, sent with Gusty's own template, and "Welcome back" when the email already has an account: a different email clears the box, keeping projects moves them into the account (e2e, with axe scan); (db) only guests start a transfer, only real accounts claim one, the transfers list is closed.

CI starts a local Supabase with the repo's migrations, checks the generated types are current, then runs all of the above.

## Definition of done (directive §26)
The journey works; data persists; loading, empty and error states are handled; buttons do what they say;
navigation works on desktop and mobile; keyboard and screen reader checked; real data is never confused with
placeholders; security reviewed; tests actually run; limitations written down in `docs/ROADMAP.md`.

Automated checks don't replace testing with real people, including neurodivergent users, before launch.
