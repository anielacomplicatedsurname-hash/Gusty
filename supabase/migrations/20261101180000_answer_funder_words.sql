-- Drafts in the funder's language. Each answer remembers whether the person asked Gusty to sound like the
-- funder (the default) or more like themselves, and which of the funder's own words and phrases the draft
-- uses, so they can be highlighted. Safe to run more than once.

alter table public.application_answers add column if not exists style text not null default 'funder'
  check (style in ('funder', 'mine'));
alter table public.application_answers add column if not exists funder_words jsonb not null default '[]'::jsonb;

grant insert (application_id, project_id, question_key, question, answer, source, gaps, drafted_at, style, funder_words)
  on public.application_answers to authenticated;
grant update (answer, source, gaps, drafted_at, style, funder_words) on public.application_answers to authenticated;
