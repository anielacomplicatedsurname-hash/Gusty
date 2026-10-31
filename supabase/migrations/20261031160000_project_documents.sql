-- Bringing in an existing project from a PDF. The file itself is never kept: only what Gusty learned from
-- it (a short summary and what's already been done), which the owner can read and delete.
-- Safe to run more than once.

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  filename text not null default '' check (char_length(filename) <= 200),
  pages smallint check (pages between 1 and 1000),
  summary text not null default '' check (char_length(summary) <= 3000),
  done text[] not null default '{}' check (cardinality(done) <= 12),
  created_at timestamptz not null default now()
);

create index if not exists project_documents_project_idx on public.project_documents (project_id, created_at);

alter table public.project_documents enable row level security;

drop policy if exists "Owners read their documents" on public.project_documents;
drop policy if exists "Owners add documents to their projects" on public.project_documents;
drop policy if exists "Owners delete their documents" on public.project_documents;
create policy "Owners read their documents" on public.project_documents for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add documents to their projects" on public.project_documents for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners delete their documents" on public.project_documents for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.project_documents from anon, authenticated;
grant select, delete on public.project_documents to authenticated;
grant insert (project_id, filename, pages, summary, done) on public.project_documents to authenticated;

-- Bringing guest projects into an account also moves what Gusty learned from their documents.
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
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;
