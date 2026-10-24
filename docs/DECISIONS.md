# Decisions

Newest first. Each entry: decision, why, and what would make us revisit it.

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
