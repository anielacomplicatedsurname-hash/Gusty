-- "Your idea, as it stands": Gusty's short summary of everything the person has said about a project, and
-- up to three things that make it different. Kept apart from the person's own words, which are never changed.
-- Its own table, so refreshing it doesn't count as the person editing the project. Safe to run more than once.

create table if not exists public.project_summaries (
  project_id uuid primary key references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  summary text not null check (char_length(summary) between 1 and 1200),
  points text[] not null default '{}' check (cardinality(points) <= 3),
  updated_at timestamptz not null default now()
);

alter table public.project_summaries enable row level security;

drop policy if exists "Owners read their summaries" on public.project_summaries;
drop policy if exists "Owners add summaries to their projects" on public.project_summaries;
drop policy if exists "Owners update their summaries" on public.project_summaries;
drop policy if exists "Owners delete their summaries" on public.project_summaries;
create policy "Owners read their summaries" on public.project_summaries for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add summaries to their projects" on public.project_summaries for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners update their summaries" on public.project_summaries for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their summaries" on public.project_summaries for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.project_summaries from anon, authenticated;
grant select, delete on public.project_summaries to authenticated;
grant insert (project_id, summary, points, updated_at) on public.project_summaries to authenticated;
grant update (summary, points, updated_at) on public.project_summaries to authenticated;

-- Bringing guest projects into an account also moves their summaries.
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
