-- The project bank: everything that makes the case for a project, kept in one place for applications.
-- - project_evidence: the person's own experience (past projects, past wins, what people said, numbers),
--   and research Gusty found online (always with its source link and the date it was found).
-- - research_runs: Gusty's research searches, for the small daily allowance and the "searching" note.
-- - project_voice: a short description of how the person writes, so drafts can sound like them.
-- Owner-only, like everything else. Safe to run more than once.

create table if not exists public.project_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- person: the person's own words · research: found online by Gusty, with a source
  origin text not null default 'person' check (origin in ('person', 'research')),
  kind text not null check (kind in ('past_project', 'win', 'quote', 'number', 'other', 'research')),
  text text not null check (char_length(text) between 1 and 1000),
  title text not null default '' check (char_length(title) <= 300),
  publisher text not null default '' check (char_length(publisher) <= 200),
  year text not null default '' check (char_length(year) <= 20),
  relevance text not null default '' check (char_length(relevance) <= 400),
  url text not null default '' check (url = '' or (url like 'https://%' and char_length(url) <= 1000)),
  found_at timestamptz,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((origin = 'research') = (kind = 'research')),
  check (origin = 'person' or (url <> '' and title <> '' and found_at is not null))
);
create index if not exists project_evidence_project_idx on public.project_evidence (project_id, origin, position, created_at);

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists research_runs_owner_idx on public.research_runs (owner_id, created_at);
create index if not exists research_runs_project_idx on public.research_runs (project_id, created_at);

create table if not exists public.project_voice (
  project_id uuid primary key references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 1200),
  -- ai: Gusty's description from the person's writing · user: written or edited by the person
  source text not null default 'ai' check (source in ('ai', 'user')),
  updated_at timestamptz not null default now()
);

alter table public.project_evidence enable row level security;
alter table public.research_runs enable row level security;
alter table public.project_voice enable row level security;

do $$
declare t text;
begin
  foreach t in array array['project_evidence', 'research_runs', 'project_voice'] loop
    execute format('drop policy if exists "Owners read" on public.%I', t);
    execute format('drop policy if exists "Owners add to their projects" on public.%I', t);
    execute format('drop policy if exists "Owners update" on public.%I', t);
    execute format('drop policy if exists "Owners delete" on public.%I', t);
    execute format('create policy "Owners read" on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format('create policy "Owners add to their projects" on public.%I for insert to authenticated with check (
      (select auth.uid()) = owner_id
      and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())))', t);
    execute format('create policy "Owners update" on public.%I for update to authenticated
      using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
    execute format('create policy "Owners delete" on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

grant select, delete on public.project_evidence to authenticated;
grant insert (project_id, origin, kind, text, title, publisher, year, relevance, url, found_at, position)
  on public.project_evidence to authenticated;
grant update (kind, text, url) on public.project_evidence to authenticated;

-- Runs can't be deleted from the app, so the daily allowance can't be reset by removing them.
grant select on public.research_runs to authenticated;
grant insert (project_id) on public.research_runs to authenticated;
grant update (status, finished_at) on public.research_runs to authenticated;

grant select, delete on public.project_voice to authenticated;
grant insert (project_id, description, source, updated_at) on public.project_voice to authenticated;
grant update (description, source, updated_at) on public.project_voice to authenticated;

drop trigger if exists project_evidence_touch_updated_at on public.project_evidence;
create trigger project_evidence_touch_updated_at
  before update on public.project_evidence
  for each row execute function public.touch_updated_at();

-- Bringing guest projects into an account also moves the project bank.
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
