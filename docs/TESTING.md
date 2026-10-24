# Testing

| Layer | Tool | Where | Run |
|---|---|---|---|
| Lint | ESLint (next core-web-vitals + TS) | everything | `pnpm lint` |
| Types | TypeScript strict, Next route types | everything | `pnpm typecheck` |
| Unit | Vitest | `tests/unit` | `pnpm test` |
| End-to-end | Playwright on phone (Pixel 7), tablet (820px) and desktop (1440px) | `tests/e2e` | `pnpm build && pnpm test:e2e` |
| Accessibility | axe-core inside Playwright (WCAG 2.0–2.2 A/AA rules) | `tests/e2e/shell.spec.ts` | with e2e |

`pnpm check` runs lint, types and unit tests. CI (`.github/workflows/ci.yml`) runs all of the above on every PR.

## What's covered today
- Palette contrast for every text/background pair in use (unit).
- Locale config, RTL detection, no empty strings, no retired brand spelling (unit).
- Redirect to locale, Home content, disabled preview button, bottom bar only on mobile, header nav from
  tablet up, active nav state, bottom bar never covering content, skip link, axe scan (e2e).
- Title, description, canonical, hreflang, `noindex` on placeholders, robots.txt, manifest and icons (e2e).

## Definition of done (directive §26)
The journey works; data persists; loading, empty and error states are handled; buttons do what they say;
navigation works on desktop and mobile; keyboard and screen reader checked; real data is never confused with
placeholders; security reviewed; tests actually run; limitations written down in `docs/ROADMAP.md`.

Automated checks don't replace testing with real people, including neurodivergent users, before launch.
