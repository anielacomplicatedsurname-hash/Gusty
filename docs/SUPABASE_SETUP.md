# Supabase setup (production project)

Project: `https://xxordvjyxfjkidfenqla.supabase.co`. Do these in the Supabase dashboard.

## Once, before the first deploy that uses the database
1. **Create the tables.** SQL Editor → New query → paste the whole of
   `supabase/migrations/20261025000000_projects.sql` → Run. It should say "Success. No rows returned".
2. **Guest sign-in.** Authentication → Sign In / Providers → turn on **Allow anonymous sign-ins**.
3. **Where sign-in links go.** Authentication → URL Configuration:
   - Site URL: `https://heygusty.com`
   - Redirect URLs: `https://heygusty.com/**`. The `/**` matters: without it Supabase only allows the bare home page and sends sign-in links to the Site URL instead (and `https://gusty-web.onrender.com/**` while links sent before the move may still be opened)
4. **Email confirmation** stays on (the default): Authentication → Sign In / Providers → Email → "Confirm email".

## Migrations so far (run in this order)
1. `20261025000000_projects.sql` (stage 2, done)
2. `20261025120000_interpretation.sql` (stage 3, done)
3. `20261025140000_titles_and_ai_errors.sql` (titles, AI failure reasons)
4. `20261025160000_next_steps.sql` (stage 4: directions, steps, preferences)
5. `20261025180000_delete_my_account.sql` (stage 5: lets people delete their own account)
6. `20261025200000_admin.sql` (stage 5: the admin overview)
7. `20261025220000_security_tightening.sql` (stage 5 security review)
8. `20261027120000_bring_guest_projects.sql` (guests can bring their projects into an existing account)
9. `20261028120000_feedback.sql` ("Tell us what you think" feedback, read on the admin page)
10. `20261028140000_step_work.sql` ("Work on this with Gusty": step questions, answers and notes)
11. `20261029120000_tidy_and_say_more.sql` (tidied answers and notes, "Help me say more" label)
12. `20261029140000_growing_plan.sql` (plans grow one stage at a time; guest step answers move with their projects)
13. `20261029160000_drafts.sql` ("Help me write it": the draft a person keeps for a step)
14. `20261029180000_opportunities.sql` (Explore: funding opportunities the founder curates; removed again by 15)
15. `20261029200000_explore_search.sql` (Explore: per-project online search and what it found)
16. `20261031120000_explore_save.sql` (Explore: kinds of opportunity, saving results to a project)
17. `20261031140000_funding_readiness.sql` (Ready for funding: amount needed, funding routes)
18. `20261031160000_project_documents.sql` (Bringing in a project from a PDF: Gusty's notes)
19. `20261031180000_project_summaries.sql` ("Your idea, as it stands": Gusty's summary)
20. `20261031200000_fact_suggestions.sql` (Gusty's suggested updates to the idea after a finished step)
21. `20261031220000_idea_grows.sql` (Gusty's changes from steps, with Undo; answered questions)
22. `20261101120000_project_bank.sql` (Project bank: your experience, research, how you write)
23. `20261101140000_applications.sql` (Application spaces: funder papers Gusty read, and the fit)
24. `20261101160000_application_answers.sql` (Answers to each question, drafted with Gusty)
25. `20261101180000_answer_funder_words.sql` (Funder-language drafts: style and the funder's words used)
26. `20261101200000_step_mood.sql` (Choosing a next step by how you feel)

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

## Email (done: Resend, from hello@heygusty.com)
- **Sending:** the domain `heygusty.com` is verified in Resend (DNS records at GoDaddy). Supabase sends through it:
  Authentication → Emails → SMTP Settings: host `smtp.resend.com`, port `465`, username `resend`,
  password = a Resend API key with sending access only (named `supabase-auth-emails`). Never commit that key.
- **Wording and look:** Authentication → Emails → Templates. For each of these, paste the subject and the
  whole file from `supabase/templates/` (local Supabase uses the same files via `supabase/config.toml`):

  | Template in Supabase | Subject | File |
  |---|---|---|
  | Confirm signup | Welcome to Gusty: confirm your email | `confirmation.html` |
  | Magic Link | Your Gusty sign-in link | `magic-link.html` |
  | Change Email Address | Keep your Gusty projects | `email-change.html` |
- **How many emails:** Authentication → Rate Limits → "Rate limit for sending emails". 30 an hour is
  plenty for testers; Resend's free plan allows 100 a day.

## Before inviting real users
- **Bot protection:** turn on CAPTCHA (Authentication → Attack Protection) to limit fake guest accounts.
- **Backups:** the Pro plan adds daily backups.

## Local development
`npx supabase start` runs a private copy with the same migrations, plus a test inbox at
http://127.0.0.1:54324 for sign-in emails. `npx supabase db reset` rebuilds it from the migrations.
