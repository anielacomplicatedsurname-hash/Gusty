-- Funding readiness and routes: roughly how much a project needs (the person's own answer), and Gusty's
-- suggested funding routes for it (labelled as Gusty's estimate, replaced each time they're asked for).
-- Safe to run more than once.

alter table public.projects
  add column if not exists funding_need text check (funding_need in ('under_1k', '1k_10k', '10k_50k', 'over_50k', 'unsure'));
grant update (funding_need) on public.projects to authenticated;

create table if not exists public.funding_routes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position smallint not null default 0,
  route text not null check (route in ('small_grant', 'council', 'crowdfunding', 'sponsorship', 'larger_grant',
    'residency', 'prize', 'social_investment', 'earned_income')),
  focus text not null default 'community' check (focus in ('social', 'environmental', 'arts_culture', 'community',
    'education', 'health', 'other')),
  fit text not null default 'possible' check (fit in ('strong', 'possible')),
  why text not null default '' check (char_length(why) <= 400),
  first_step text not null default '' check (char_length(first_step) <= 300),
  created_at timestamptz not null default now()
);

create index if not exists funding_routes_project_idx on public.funding_routes (project_id, position);

alter table public.funding_routes enable row level security;

drop policy if exists "Owners read their funding routes" on public.funding_routes;
drop policy if exists "Owners add funding routes to their projects" on public.funding_routes;
drop policy if exists "Owners delete their funding routes" on public.funding_routes;
create policy "Owners read their funding routes" on public.funding_routes for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add funding routes to their projects" on public.funding_routes for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners delete their funding routes" on public.funding_routes for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.funding_routes from anon, authenticated;
grant select, delete on public.funding_routes to authenticated;
grant insert (project_id, position, route, focus, fit, why, first_step) on public.funding_routes to authenticated;

-- Bringing guest projects into an account also moves their funding routes.
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
