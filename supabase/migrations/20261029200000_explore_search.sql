-- Explore becomes project-specific: Gusty searches online for opportunities that fit one project, from
-- neighbourhood to international, and saves what it found (with sources) for the project's owner only.
-- The founder-curated list is removed. Safe to run more than once.

drop table if exists public.opportunities;

-- One deep search for one project. Limits are counted from these rows.
create table if not exists public.opportunity_searches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The area searched around, as the person gave it (never an address).
  place text not null default '' check (char_length(place) <= 120),
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists opportunity_searches_project_idx on public.opportunity_searches (project_id, created_at desc);
create index if not exists opportunity_searches_owner_idx on public.opportunity_searches (owner_id, created_at desc);

-- What a search found. Every row has a source link; nothing is invented or filled in from memory.
create table if not exists public.found_opportunities (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.opportunity_searches (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rank smallint not null default 0,
  title text not null check (char_length(title) between 1 and 200),
  funder text not null default '' check (char_length(funder) <= 200),
  url text not null check (url ~ '^https://' and char_length(url) <= 1000),
  summary text not null default '' check (char_length(summary) <= 600),
  who_for text not null default '' check (char_length(who_for) <= 600),
  amount text not null default '' check (char_length(amount) <= 120),
  deadline date,
  deadline_note text not null default '' check (char_length(deadline_note) <= 120),
  scale text not null check (scale in ('neighbourhood', 'local', 'regional', 'national', 'continental', 'international')),
  complexity text not null check (complexity in ('light', 'moderate', 'involved')),
  complexity_reason text not null default '' check (char_length(complexity_reason) <= 300),
  fit text not null default '' check (char_length(fit) <= 400),
  created_at timestamptz not null default now()
);

create index if not exists found_opportunities_search_idx on public.found_opportunities (search_id, rank);

alter table public.opportunity_searches enable row level security;
alter table public.found_opportunities enable row level security;

drop policy if exists "Owners read their searches" on public.opportunity_searches;
drop policy if exists "Owners start searches for their projects" on public.opportunity_searches;
drop policy if exists "Owners update their searches" on public.opportunity_searches;
drop policy if exists "Owners delete their searches" on public.opportunity_searches;
create policy "Owners read their searches" on public.opportunity_searches for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners start searches for their projects" on public.opportunity_searches for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners update their searches" on public.opportunity_searches for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their searches" on public.opportunity_searches for delete to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Owners read what was found" on public.found_opportunities;
drop policy if exists "Owners add what was found" on public.found_opportunities;
drop policy if exists "Owners delete what was found" on public.found_opportunities;
create policy "Owners read what was found" on public.found_opportunities for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add what was found" on public.found_opportunities for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.opportunity_searches s
                where s.id = search_id and s.project_id = found_opportunities.project_id and s.owner_id = (select auth.uid())));
create policy "Owners delete what was found" on public.found_opportunities for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.opportunity_searches, public.found_opportunities from anon, authenticated;
grant select, delete on public.opportunity_searches, public.found_opportunities to authenticated;
grant insert (project_id, place) on public.opportunity_searches to authenticated;
grant update (status, finished_at) on public.opportunity_searches to authenticated;
grant insert (search_id, project_id, rank, title, funder, url, summary, who_for, amount, deadline, deadline_note,
  scale, complexity, complexity_reason, fit) on public.found_opportunities to authenticated;

-- Bringing guest projects into an account also moves their searches and what was found.
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
