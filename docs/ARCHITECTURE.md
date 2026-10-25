# Architecture

A **modular monolith**: one Next.js app, deployed as one Render web service, backed by Supabase.
Simple to run and pay for; module boundaries let parts move out later if they ever need to.

```
src/
├─ app/                 routes (App Router)
│  ├─ [lang]/           every page sits under a locale segment (/en/...)
│  ├─ api/health/       liveness check for Render
│  └─ manifest.ts, robots.ts, sitemap.ts, icons
├─ components/          shared UI (AppShell, Logo, BrandSymbol, NavLinks, ComingNext)
├─ config/              brand.ts (white-label seam), site-url.ts (tolerant site address)
├─ lib/supabase/        server client, session refresh, generated database types
├─ modules/projects/    data access, server actions, idea form, autosave editor, email link
├─ i18n/                locale config, message dictionaries (messages/en.json)
└─ proxy.ts             redirects locale-less URLs to the default locale
public/brand/           approved logo and symbol SVGs (traced originals)
tests/unit, tests/e2e   Vitest and Playwright
```

Planned additions, each arriving with the stage that needs it (`docs/ROADMAP.md`):
`src/modules/{assistant,preferences,admin}` (stage 3–5), `src/ai/` provider layer (stage 3), `services/research/` Python FastAPI service (stage 2 of the product
roadmap, Opportunity Discovery — not milestone 1).

## Key choices
| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, Turbopack), React 19, TypeScript strict |
| Rendering | Public pages are static (prerendered); private pages will be dynamic and `noindex` |
| Styling | Tailwind CSS 4 over CSS custom-property tokens in `globals.css` |
| i18n | Built-in Next.js pattern: `[lang]` segment, JSON dictionaries, `next/root-params`, `Intl` for formatting. English only until the core journey is validated. |
| Fonts | `next/font/google`, self-hosted at build time (no visitor requests to Google) |
| PWA | Web app manifest + icons now; service worker for app-shell caching in stage 5. No offline promise. |
| Data, auth, files | Supabase Postgres, Row Level Security, guest (anonymous) sessions → email link. Migrations in `supabase/migrations/`; setup in `docs/SUPABASE_SETUP.md` |
| AI | Server-side only, task-specific workflows with schema-validated outputs, model configurable (stage 3) |
| Hosting | Render (`render.yaml` Blueprint), region Frankfurt |
| CI | GitHub Actions: lint, typecheck, unit, build, end-to-end |

## White-label approach
Ready, not built: brand values come from `src/config/brand.ts` and tokens; user-facing text from message
files; every tenant-owned table will carry `organisation_id` from its first migration. No multi-tenant
routing or per-tenant admin until a real institution needs it (directive §15).
