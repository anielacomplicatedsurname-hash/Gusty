-- Steps feed back into the idea: when a step is finished, Gusty may suggest updates to "Here's what I
-- understood" from what the person wrote while doing it. Suggestions wait for the person: nothing changes
-- until they choose "Use this". Safe to run more than once.

create table if not exists public.fact_suggestions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  step_id uuid references public.next_steps (id) on delete set null,
  kind text not null check (kind in ('summary', 'audience', 'place', 'stage', 'need')),
  value text not null check (char_length(value) between 1 and 300),
  reason text not null default '' check (char_length(reason) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists fact_suggestions_project_idx on public.fact_suggestions (project_id, status, created_at);

alter table public.fact_suggestions enable row level security;

drop policy if exists "Owners read their suggestions" on public.fact_suggestions;
drop policy if exists "Owners add suggestions to their projects" on public.fact_suggestions;
drop policy if exists "Owners update their suggestions" on public.fact_suggestions;
drop policy if exists "Owners delete their suggestions" on public.fact_suggestions;
create policy "Owners read their suggestions" on public.fact_suggestions for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add suggestions to their projects" on public.fact_suggestions for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners update their suggestions" on public.fact_suggestions for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their suggestions" on public.fact_suggestions for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.fact_suggestions from anon, authenticated;
grant select, delete on public.fact_suggestions to authenticated;
grant insert (project_id, step_id, kind, value, reason) on public.fact_suggestions to authenticated;
grant update (status) on public.fact_suggestions to authenticated;

-- Bringing guest projects into an account also moves Gusty's pending suggestions.
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
