# Supabase setup (production project)

Project: `https://xxordvjyxfjkidfenqla.supabase.co`. Do these in the Supabase dashboard.

## Once, before the first deploy that uses the database
1. **Create the tables.** SQL Editor → New query → paste the whole of
   `supabase/migrations/20261025000000_projects.sql` → Run. It should say "Success. No rows returned".
2. **Guest sign-in.** Authentication → Sign In / Providers → turn on **Allow anonymous sign-ins**.
3. **Where sign-in links go.** Authentication → URL Configuration:
   - Site URL: `https://gusty-web.onrender.com` (later: the real domain)
   - Redirect URLs: add `https://gusty-web.onrender.com/**`
4. **Email confirmation** stays on (the default): Authentication → Sign In / Providers → Email → "Confirm email".

## Migrations so far (run in this order)
1. `20261025000000_projects.sql` (stage 2, done)
2. `20261025120000_interpretation.sql` (stage 3, done)
3. `20261025140000_titles_and_ai_errors.sql` (titles, AI failure reasons)
4. `20261025160000_next_steps.sql` (stage 4: directions, steps, preferences)
5. `20261025180000_delete_my_account.sql` (stage 5: lets people delete their own account)
6. `20261025200000_admin.sql` (stage 5: the admin overview)

## Making yourself an admin
Sign in to Gusty with your email first, then in the SQL Editor run (with your own email):
```sql
insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
```
The overview is at `/en/admin`. To remove someone: `delete from public.admins where user_id = '…';`.
The app itself can never add admins.

If Gusty ever can't read ideas, open **Table Editor → ai_runs**: the `error` column says why
(`key` = the API key was refused, `busy` = rate-limited or overloaded).

## Each later migration
New files in `supabase/migrations/` are run the same way, in filename order, before merging the
pull request that adds them. (When this gets frequent, automate it with the Supabase CLI in CI.)

## Before inviting real users
- **Email sending:** Supabase's built-in email only reaches the project's own team members and is
  heavily rate-limited. Set up custom SMTP (Authentication → Emails → SMTP Settings), for example
  with Resend, Postmark or Brevo, so sign-in links reach everyone.
- **Bot protection:** turn on CAPTCHA (Authentication → Attack Protection) to limit fake guest accounts.
- **Backups:** the Pro plan adds daily backups.

## Local development
`npx supabase start` runs a private copy with the same migrations, plus a test inbox at
http://127.0.0.1:54324 for sign-in emails. `npx supabase db reset` rebuilds it from the migrations.
