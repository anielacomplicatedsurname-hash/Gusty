# Gusty — operating instructions

Gusty is an AI-native, neuroinclusive platform that helps people turn ideas into real projects.
The founder leads vision, brand and priorities; Claude leads technical implementation.

**Read first:** `docs/reference/gusty-founding-directive.pdf` (source of truth), then the doc for your task:
`docs/PRODUCT_VISION.md` · `docs/BRAND_AND_DESIGN.md` · `docs/ARCHITECTURE.md` · `docs/ROADMAP.md` ·
`docs/DECISIONS.md` · `docs/SECURITY.md` · `docs/TESTING.md`. Next.js notes: @AGENTS.md

## Non-negotiables
- Brand name is **Gusty** (one "y"). Never use "Gustyyy" in code, copy or assets.
- Logo and symbols in `public/brand/` are approved artwork: never redraw, recolour or regenerate them.
- Never invent grants, funders, deadlines, eligibility or achievements. Label user input, verified facts
  (with source and date), AI suggestions and unknowns distinctly.
- Never present a mockup or placeholder as working. Placeholders say so on screen.
- Max three next steps shown by default. No streaks, false urgency or shame mechanics.
- WCAG 2.2 AA. Text on accent colours is always Ink. Respect reduced motion.
- All user-facing text lives in `src/i18n/messages/*.json`, never inline in components.
- No secrets in the repo or the browser bundle. Private routes are noindex and access-controlled.

## How to work
- Small vertical slices on a branch; open a PR; never merge to `main` or deploy without founder approval.
- Ask before adding a dependency. Prefer the platform (Next.js, Postgres) over new libraries.
- Before saying something works: `pnpm check` and `pnpm build && pnpm test:e2e`, and report real output.
- Record significant decisions in `docs/DECISIONS.md`; record known limitations in `docs/ROADMAP.md`.
- Explain trade-offs to the founder in plain language, with one recommendation and at most three decisions.

## Commands
`pnpm dev` · `pnpm check` (lint + types + unit) · `pnpm build` · `pnpm test:e2e` (needs a build)
Database: `npx supabase start` · `pnpm test:db` · `pnpm db:types` after changing a migration.
New migrations need the founder to run them in production first: see `docs/SUPABASE_SETUP.md`.
