-- Gusty stage 2: organisations and projects.
-- Every tenant-owned table carries organisation_id from day one (white-label readiness).
-- Row Level Security: a project is visible and editable only by its owner.

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- The default organisation. White-label organisations are added later.
insert into public.organisations (id, slug, name)
values ('00000000-0000-0000-0000-000000000001', 'gusty', 'Gusty');

alter table public.organisations enable row level security;
-- No policies: clients cannot read or change organisations yet.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null
    default '00000000-0000-0000-0000-000000000001'
    references public.organisations (id),
  owner_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  idea text not null check (char_length(idea) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_updated_idx on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

create policy "Owners can read their projects"
  on public.projects for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can create their projects"
  on public.projects for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Owners can update their projects"
  on public.projects for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their projects"
  on public.projects for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Least privilege: signed-out visitors get nothing; signed-in users may only set
-- the title and idea. Owner, organisation and timestamps come from defaults.
revoke all on public.projects from anon, authenticated;
grant select, delete on public.projects to authenticated;
grant insert (title, idea) on public.projects to authenticated;
grant update (title, idea) on public.projects to authenticated;

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();
