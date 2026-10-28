# Architecture

A **modular monolith**: one Next.js app, deployed as one Render web service, backed by Supabase.
Simple to run and pay for; module boundaries let parts move out later if they ever need to.

```
src/
├─ app/                 routes (App Router)
│  ├─ [lang]/           every page sits under a locale segment (/en/...)
│  ├─ api/health/       liveness check for Render
│  ├─ api/export/       "Download my projects" (JSON, owner only)
│  └─ manifest.ts, robots.ts, sitemap.ts, icons
├─ components/          shared UI (AppShell, Logo, BrandSymbol, NavLinks, ComingNext)
├─ config/              brand.ts (white-label seam), site-url.ts (tolerant site address)
├─ lib/supabase/        server client, session refresh, generated database types
├─ modules/projects/    data access, server actions, idea form, autosave editor, email link
├─ modules/interpretation/  Gusty's reading: data, actions (read, confirm, edit, add, remove), UI
├─ modules/steps/       directions, next steps, modes (visibleSteps), I'm stuck, UI
├─ modules/step-work/   "Work on this with Gusty": per-step questions, rewording, answers, notes; "What you've worked out"
├─ modules/admin/       founder overview (counts and costs only, via `admin_overview()`)
├─ ai/                  provider interface, Claude provider, prices, usage log + daily budget, tasks/ (prompts + schemas)
├─ i18n/                locale config, message dictionaries (messages/en.json)
└─ proxy.ts             redirects locale-less URLs to the default locale
public/brand/           approved logo and symbol SVGs (traced originals)
tests/unit, tests/e2e   Vitest and Playwright
```

Planned additions, each arriving with the stage that needs it (`docs/ROADMAP.md`):
`src/modules/assistant` (later), `services/research/` Python FastAPI service (stage 2 of the product
roadmap, Opportunity Discovery — not milestone 1).

## Key choices
| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript strict |
| Rendering | Public pages are static (prerendered); private pages will be dynamic and `noindex` |
| Styling | Tailwind CSS 4 over CSS custom-property tokens in `globals.css` |
| i18n | Built-in Next.js pattern: `[lang]` segment, JSON dictionaries, `next/root-params`, `Intl` for formatting. English only until the core journey is validated. |
| Fonts | `next/font/google`, self-hosted at build time (no visitor requests to Google) |
| PWA | Web app manifest + icons; a small hand-written service worker (`public/sw.js`, no library) caches only static files and shows an offline page. Private pages are never cached. |
| Data, auth, files | Supabase Postgres, Row Level Security, guest (anonymous) sessions → email link. Migrations in `supabase/migrations/`; setup in `docs/SUPABASE_SETUP.md` |
| AI | Server-side only. `src/ai` provider interface; Claude Opus 5.5 by default (`GUSTY_AI_MODEL`); structured outputs via Zod; server-side fallback; labelled demo mode without a key |
| Hosting | Render (`render.yaml` Blueprint), region Frankfurt |
| CI | GitHub Actions: lint, typecheck, unit, build, end-to-end |

## White-label approach
Ready, not built: brand values come from `src/config/brand.ts` and tokens; user-facing text from message
files; every tenant-owned table will carry `organisation_id` from its first migration. No multi-tenant
routing or per-tenant admin until a real institution needs it (directive §15).
