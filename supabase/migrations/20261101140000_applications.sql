-- The application space: one place per opportunity someone wants to apply to. People bring in the funder's
-- papers (the form or questions, guidance, terms, past winners) by PDF, pasted text or a public link. Gusty
-- keeps only what it read from them (the questions, the funder's priorities and rules, quoted, with where they
-- came from), never the files. Then Gusty shows how the project fits and where it's thin.
-- Owner-only, like everything else. Safe to run more than once.

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  found_id uuid references public.found_opportunities (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  funder text not null default '' check (char_length(funder) <= 200),
  url text not null default '' check (url = '' or (url like 'https://%' and char_length(url) <= 1000)),
  -- Gusty's view of how the project fits this funder: none yet, being worked out, ready, or failed.
  fit_status text not null default 'none' check (fit_status in ('none', 'running', 'ready', 'failed')),
  fit jsonb,
  fit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists applications_project_idx on public.applications (project_id, created_at);

create table if not exists public.application_materials (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('form', 'guidance', 'terms', 'past_winners', 'other')),
  origin text not null check (origin in ('pdf', 'paste', 'link')),
  label text not null check (char_length(label) between 1 and 300),
  url text not null default '' check (url = '' or (url like 'https://%' and char_length(url) <= 1000)),
  pages smallint,
  -- What Gusty read: questions, priorities, rules, key details and tone, each quoted as the funder put it.
  reading jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists application_materials_app_idx on public.application_materials (application_id, created_at);

alter table public.applications enable row level security;
alter table public.application_materials enable row level security;

drop policy if exists "Owners read" on public.applications;
drop policy if exists "Owners add to their projects" on public.applications;
drop policy if exists "Owners update" on public.applications;
drop policy if exists "Owners delete" on public.applications;
create policy "Owners read" on public.applications for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners add to their projects" on public.applications for insert to authenticated with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  and (found_id is null or exists (
    select 1 from public.found_opportunities f where f.id = found_id and f.project_id = applications.project_id)));
create policy "Owners update" on public.applications for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete" on public.applications for delete to authenticated using ((select auth.uid()) = owner_id);

drop policy if exists "Owners read" on public.application_materials;
drop policy if exists "Owners add to their applications" on public.application_materials;
drop policy if exists "Owners delete" on public.application_materials;
create policy "Owners read" on public.application_materials for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners add to their applications" on public.application_materials for insert to authenticated with check (
  (select auth.uid()) = owner_id
  and exists (select 1 from public.applications a
    where a.id = application_id and a.project_id = application_materials.project_id and a.owner_id = (select auth.uid())));
create policy "Owners delete" on public.application_materials for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on public.applications from anon, authenticated;
revoke all on public.application_materials from anon, authenticated;
grant select, delete on public.applications to authenticated;
grant insert (project_id, found_id, title, funder, url) on public.applications to authenticated;
grant update (title, funder, url, fit_status, fit, fit_at) on public.applications to authenticated;
grant select, delete on public.application_materials to authenticated;
grant insert (application_id, project_id, kind, origin, label, url, pages, reading) on public.application_materials to authenticated;

drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at
  before update on public.applications
  for each row execute function public.touch_updated_at();

-- Bringing guest projects into an account also moves their applications.
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
