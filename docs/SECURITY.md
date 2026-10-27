# Security and privacy

## Principles (directive §18)
- Least privilege; secure by default; GDPR-aware. Legal review before public launch.
- Users can export and delete their data.
- Uploaded documents, web pages, PDFs and retrieved text are **untrusted input** — never instructions to the AI
  or the system. AI outputs are schema-validated before anything is saved; actions need user approval.
- Log errors and usage (tokens, cost), not the content of people's ideas (`ai_runs` stores no content).
- The idea is passed to the model inside `<idea>` tags with an instruction to treat it as text, not instructions; closing tags inside it are neutralised. Model output is schema-validated and length-limited before it is saved.
- AI calls run only on the server; the key never reaches the browser. 30 readings and 60 AI calls in total per person per day.

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
- Admin is checked inside the database (see below).

## Current hardening
- Response headers: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`; no `X-Powered-By`.
- Health endpoint reveals no configuration.
- Fonts self-hosted: visitors' browsers make no requests to Google.
- Content Security Policy: everything from Gusty's own address only; no plugins, no framing, forms only post to Gusty. Inline scripts are still allowed (Next.js needs them); `unsafe-eval` only in development.
- HSTS: browsers always use HTTPS.
- Service worker caches only public, versioned files (`/_next/static/`, `/brand/`, `/icons/`) and the offline page. Pages and API responses are never cached, so private projects never stay on a shared device. An e2e test checks this.

## Admin overview (built in stage 5)
- `/[lang]/admin` shows counts and estimated costs only: people, projects, AI requests by feature and day, problem reasons. It never shows ideas, titles, emails or anything people wrote.
- Admins are listed in `public.admins`, which the app can't read or write; they are added by hand in the SQL Editor.
- `admin_overview()` checks `is_admin()` inside the database and refuses everyone else, so the page can't be opened by changing the browser.
- To everyone who isn't an admin, the page looks exactly like a missing page. It is `noindex` and not linked anywhere.

## Email
- Sign-in emails are sent by Supabase through Resend, from `hello@heygusty.com` (SPF and DKIM verified). The
  Resend key can only send email and lives only in the Supabase dashboard.
- Emails say what the link does, that it works once and expires, and that ignoring it changes nothing.

## Bringing guest projects into an account
- "Sign in and keep my projects" stores a random secret in an `httpOnly` cookie (path `/api/auth`, one hour)
  and only its SHA-256 in `project_transfers`, which the app can't read.
- After the sign-in link is confirmed in that same browser, `claim_guest_projects()` moves the guest's rows to
  the signed-in account and deletes the empty guest account. It refuses unless the caller is a real (not guest)
  account, only ever moves from a guest account, and each secret works once.

## Your data (built in stage 5)
- **Download:** "Download my projects" on My Projects returns a JSON file of every project with its reading, directions and steps (`/api/export`, owner only via RLS, `no-store`).
- **Delete a project:** removes it and everything attached (`on delete cascade`).
- **Delete my account:** `delete_my_account()` is a `security definer` function that only ever deletes the caller (`auth.uid()`); signed-out visitors can't run it. Everything they own goes with it. Both deletions ask for confirmation first.

## Security review (stage 5, 2026-10-25)
Checked: every table has Row Level Security; every `security definer` function pins `search_path`;
signed-out visitors can't call any function; private pages are `noindex` and checked on the server;
no secrets in the code or browser bundle; `pnpm audit --prod` finds no known vulnerabilities.

Fixed:
- **Sign-in redirect:** a link with a hidden tab or line break (`next=/%09/evil.example`) could send someone
  to another site after signing in. Hidden characters are now refused and the destination must be Gusty itself.
- **Email links** are always built from the public site address, never from the request.
- **Leftover permissions** on `organisations` and `touch_updated_at` removed (already blocked by RLS).
- **Usage log bounds:** one AI call can't be logged as costing over $1 or using over 200,000 tokens.

Known, accepted for testers (to address before public launch):
- **AI spending across many guest accounts.** Limits are per person; someone could make many guest
  accounts. The firm cap is the monthly spend limit in the Anthropic Console (founder setting). Supabase
  also limits new guest accounts per IP address (Authentication → Rate Limits). CAPTCHA closes this.
- **Usage log is written by the person's own session**, so a determined person could add fake rows for
  themselves, which would show in the admin totals (within the bounds above). It can't touch anyone else's data.
- **Email requests** can be sent to any address, within Supabase's hourly email limit. CAPTCHA closes this too.

## To do before public launch
CAPTCHA on guest sign-in, clean-up of abandoned guest accounts, stricter CSP (nonces instead of inline scripts), privacy policy and data processing records,
dependency audit in CI, Supabase backups (Pro plan).
