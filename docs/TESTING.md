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
- Next steps (unit): mode visibility, switching modes never changes data, direction and step limits, prompt-tag safety; (e2e, demo): directions → steps, modes and reload, ticking off, make it smaller, help me start, explain differently, own steps, axe scan of the full project page; (db): directions, steps and preferences private.
- Titles (unit): tidying, length, demo never invents one; (e2e): rename shows in My Projects and survives reading again.
- Your data and the app (e2e): download, export refused without a session, delete a project, delete an account (its project is gone afterwards), security headers present and no CSP errors in the console, offline page served by the service worker, service worker never caches pages; (db): `delete_my_account` removes only the caller and refuses signed-out visitors.
- Saving journey: save without an account, autosave, reload, private to the owner, empty-idea message, keeping projects via a real confirmation email in the local test inbox (e2e).

CI starts a local Supabase with the repo's migrations, checks the generated types are current, then runs all of the above.

## Definition of done (directive §26)
The journey works; data persists; loading, empty and error states are handled; buttons do what they say;
navigation works on desktop and mobile; keyboard and screen reader checked; real data is never confused with
placeholders; security reviewed; tests actually run; limitations written down in `docs/ROADMAP.md`.

Automated checks don't replace testing with real people, including neurodivergent users, before launch.
