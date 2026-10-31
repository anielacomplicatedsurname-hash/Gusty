-- Drafting answers: one answer per question in an application space. Gusty can draft it in the person's
-- voice from their project and story; the person edits it and it becomes theirs. Gaps Gusty couldn't fill
-- are listed (and marked [in brackets] in the draft), never made up. Owner-only. Safe to run more than once.

create table if not exists public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The question as the funder wrote it, and a normalised key so the same question maps to one answer.
  question_key text not null check (char_length(question_key) between 1 and 600),
  question text not null check (char_length(question) between 1 and 600),
  answer text not null default '' check (char_length(answer) <= 10000),
  -- ai: Gusty's draft, untouched · user: written or edited by the person
  source text not null default 'user' check (source in ('ai', 'user')),
  gaps jsonb not null default '[]'::jsonb,
  drafted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, question_key)
);
create index if not exists application_answers_app_idx on public.application_answers (application_id);

alter table public.application_answers enable row level security;
drop policy if exists "Owners read" on public.application_answers;
drop policy if exists "Owners add to their applications" on public.application_answers;
drop policy if exists "Owners update" on public.application_answers;
drop policy if exists "Owners delete" on public.application_answers;
create policy "Owners read" on public.application_answers for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners add to their applications" on public.application_answers for insert to authenticated with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.applications a
    where a.id = application_id and a.project_id = application_answers.project_id and a.owner_id = (select auth.uid())));
create policy "Owners update" on public.application_answers for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete" on public.application_answers for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.application_answers from anon, authenticated;
grant select, delete on public.application_answers to authenticated;
grant insert (application_id, project_id, question_key, question, answer, source, gaps, drafted_at)
  on public.application_answers to authenticated;
grant update (answer, source, gaps, drafted_at) on public.application_answers to authenticated;

drop trigger if exists application_answers_touch_updated_at on public.application_answers;
create trigger application_answers_touch_updated_at
  before update on public.application_answers
  for each row execute function public.touch_updated_at();

-- Bringing guest projects into an account also moves their answers.
create or replace function public.claim_guest_projects(p_token_hash text) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  guest uuid;
  moved integer;
begin
  if me is null or coalesce((select u.is_anonymous from auth.users u where u.id = me), true) then
    raise exception 'sign in to your account first' using errcode = '42501';
  end if;

  delete from public.project_transfers t
   where t.token_hash = p_token_hash and t.created_at > now() - interval '1 hour'
  returning t.from_user into guest;

  if guest is null or guest = me
     or not coalesce((select u.is_anonymous from auth.users u where u.id = guest), false) then
    return 0;
  end if;

  update public.projects set owner_id = me where owner_id = guest;
  get diagnostics moved = row_count;
  update public.project_facts set owner_id = me where owner_id = guest;
  update public.project_directions set owner_id = me where owner_id = guest;
  update public.project_stages set owner_id = me where owner_id = guest;
  update public.next_steps set owner_id = me where owner_id = guest;
  update public.step_questions set owner_id = me where owner_id = guest;
  update public.opportunity_searches set owner_id = me where owner_id = guest;
  update public.found_opportunities set owner_id = me where owner_id = guest;
  update public.funding_routes set owner_id = me where owner_id = guest;
  update public.project_documents set owner_id = me where owner_id = guest;
  update public.project_summaries set owner_id = me where owner_id = guest;
  update public.fact_suggestions set owner_id = me where owner_id = guest;
  update public.project_evidence set owner_id = me where owner_id = guest;
  update public.research_runs set owner_id = me where owner_id = guest;
  update public.project_voice set owner_id = me where owner_id = guest;
  update public.applications set owner_id = me where owner_id = guest;
  update public.application_materials set owner_id = me where owner_id = guest;
  update public.application_answers set owner_id = me where owner_id = guest;
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
