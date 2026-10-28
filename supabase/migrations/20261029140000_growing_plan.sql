-- A plan that grows: Gusty plans one stage (3 to 5 steps) at a time. When a stage is done, the person
-- can ask for the next one, planned from everything they've done and worked out since.
-- Safe to run more than once.

create table if not exists public.project_stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction_id uuid references public.project_directions (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  -- Gusty's loose ideas for after this stage: shown as "Maybe later", never as a plan.
  later text[] not null default '{}' check (cardinality(later) <= 3),
  -- 'current': being worked on · 'done': finished · 'set_aside': left when the direction changed.
  status text not null default 'current' check (status in ('current', 'done', 'set_aside')),
  position smallint not null default 0,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists project_stages_project_idx on public.project_stages (project_id, position);

alter table public.project_stages enable row level security;

drop policy if exists "Owners read their stages" on public.project_stages;
drop policy if exists "Owners add stages to their projects" on public.project_stages;
drop policy if exists "Owners update their stages" on public.project_stages;
drop policy if exists "Owners delete their stages" on public.project_stages;
create policy "Owners read their stages" on public.project_stages for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add stages to their projects" on public.project_stages for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners update their stages" on public.project_stages for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their stages" on public.project_stages for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.project_stages from anon, authenticated;
grant select, delete on public.project_stages to authenticated;
grant insert (project_id, direction_id, title, later, position) on public.project_stages to authenticated;
grant update (status, done_at) on public.project_stages to authenticated;

alter table public.next_steps
  add column if not exists stage_id uuid references public.project_stages (id) on delete set null;
grant insert (stage_id), update (stage_id) on public.next_steps to authenticated;

-- Projects that already have steps get one stage holding them, named after their chosen direction.
insert into public.project_stages (project_id, owner_id, direction_id, title)
select p.id, p.owner_id, d.id, coalesce(d.label, 'First steps')
from public.projects p
left join public.project_directions d on d.project_id = p.id and d.chosen
where exists (select 1 from public.next_steps s where s.project_id = p.id and s.status in ('open', 'done'))
  and not exists (select 1 from public.project_stages st where st.project_id = p.id);

update public.next_steps s set stage_id = st.id
from public.project_stages st
where st.project_id = s.project_id and s.stage_id is null and s.status in ('open', 'done');

-- Bringing guest projects into an account now also moves stages and step answers. (Before, step
-- answers stayed with the guest account and were removed with it.)
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
