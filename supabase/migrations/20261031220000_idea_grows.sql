-- The idea grows with the steps. After a finished step, Gusty now updates its own unconfirmed guesses and
-- fills gaps in "Here's what I understood" straight away (each change says which step it came from and can
-- be undone), still asks before changing anything the person wrote or confirmed, and folds away open
-- questions a step has answered. Safe to run more than once.

alter table public.fact_suggestions add column if not exists fact_id uuid references public.project_facts (id) on delete cascade;
alter table public.fact_suggestions add column if not exists previous text check (previous is null or char_length(previous) between 1 and 300);
alter table public.fact_suggestions add column if not exists previous_source text
  check (previous_source is null or previous_source in ('user', 'ai_from_user', 'ai_suggestion'));

-- 'question' = an open question answered in a step (value holds the short answer).
alter table public.fact_suggestions drop constraint if exists fact_suggestions_kind_check;
alter table public.fact_suggestions add constraint fact_suggestions_kind_check
  check (kind in ('summary', 'audience', 'place', 'stage', 'need', 'question'));
-- 'applied' = Gusty made the change, which can be undone; 'undone' = the person undid it.
alter table public.fact_suggestions drop constraint if exists fact_suggestions_status_check;
alter table public.fact_suggestions add constraint fact_suggestions_status_check
  check (status in ('pending', 'accepted', 'dismissed', 'applied', 'undone'));

create index if not exists fact_suggestions_fact_idx on public.fact_suggestions (fact_id);

-- A change can only point at an item in the same project, which the person owns.
drop policy if exists "Owners add suggestions to their projects" on public.fact_suggestions;
create policy "Owners add suggestions to their projects" on public.fact_suggestions for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
    and (fact_id is null or exists (
      select 1 from public.project_facts f where f.id = fact_id and f.project_id = fact_suggestions.project_id
        and f.owner_id = (select auth.uid()))));

grant insert (project_id, step_id, kind, value, reason, status, fact_id, previous, previous_source)
  on public.fact_suggestions to authenticated;
