# Security and privacy

## Principles (directive §18)
- Least privilege; secure by default; GDPR-aware. Legal review before public launch.
- Users can export and delete their data.
- Uploaded documents, web pages, PDFs and retrieved text are **untrusted input** — never instructions to the AI
  or the system. AI outputs are schema-validated before anything is saved; actions need user approval.
- Log errors and usage (tokens, cost), not the content of people's ideas (`ai_runs` stores no content).
- The idea is passed to the model inside `<idea>` tags with an instruction to treat it as text, not instructions; closing tags inside it are neutralised. Model output is schema-validated and length-limited before it is saved.
- AI calls run only on the server; the key never reaches the browser. 30 readings per person per day.

## Secrets
- Never committed. `.env*` is git-ignored except `.env.example`, which holds names only.
- Production values live in the Render dashboard (`sync: false` in `render.yaml`).
- **Browser-safe:** `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (protected by RLS; committed in `render.yaml`).
- **Server-only:** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`. Never prefix with `NEXT_PUBLIC_`, never paste into chat.

## Data access (built in stage 2)
- Supabase Row Level Security on every table; default deny. Each project readable only by its owner.
- Column grants: clients may only write `title` and `idea` on projects; reading items can only be added to the person's own projects. Signed-out visitors have no table access.
- Guest (anonymous) accounts can save projects; adding an email requires confirming a link.
- Sign-in redirects only go to same-site paths (`safeNextPath`), and Supabase only allows listed redirect URLs.
- Deleting a user deletes their projects (`on delete cascade`).
- Tenant-owned tables carry `organisation_id` from the first migration.
- Private routes (`/[lang]/projects`, `/[lang]/admin`, conversations) are access-controlled on the server and `noindex`.
  `robots.txt` is a hint, not protection.
- Admin is role-based and checked on the server and in RLS.

## Current hardening
- Response headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`; no `X-Powered-By`.
- Health endpoint reveals no configuration.
- Fonts self-hosted: visitors' browsers make no requests to Google.

## To do before public launch
CAPTCHA on guest sign-in, custom SMTP for auth emails, clean-up of abandoned guest accounts, Content Security Policy, rate limiting on AI endpoints, privacy policy and data processing records,
data export and deletion flows, dependency audit in CI, Supabase backups (Pro plan).
