-- Gusty stage 4: directions, small next steps, experience modes and help when stuck.

-- Up to three directions a project could take; one recommended, one chosen.
create table public.project_directions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  reason text not null default '' check (char_length(reason) <= 300),
  recommended boolean not null default false,
  chosen boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index project_directions_project_idx on public.project_directions (project_id, position);

-- Small, concrete next steps. Done steps are kept, so progress is never lost.
create table public.next_steps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  direction_id uuid references public.project_directions (id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  detail text not null default '' check (char_length(detail) <= 500),
  minutes smallint check (minutes between 1 and 240),
  status text not null default 'open' check (status in ('open', 'done', 'replaced')),
  source text not null default 'ai' check (source in ('ai', 'user')),
  position smallint not null default 0,
  explanation text check (char_length(explanation) <= 800),
  starter text check (char_length(starter) <= 1500),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index next_steps_project_idx on public.next_steps (project_id, status, position);

create trigger next_steps_touch_updated_at
  before update on public.next_steps
  for each row execute function public.touch_updated_at();

-- How much each person wants to see at once. Changing it never changes their data.
create table public.user_preferences (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  experience_mode text not null default 'guide' check (experience_mode in ('simple', 'guide', 'everything')),
  updated_at timestamptz not null default now()
);

create trigger user_preferences_touch_updated_at
  before update on public.user_preferences
  for each row execute function public.touch_updated_at();

-- Row Level Security: everything belongs to its owner, and only to their own projects.
alter table public.project_directions enable row level security;
alter table public.next_steps enable row level security;
alter table public.user_preferences enable row level security;

create policy "Owners read their directions" on public.project_directions for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add directions to their projects" on public.project_directions for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners update their directions" on public.project_directions for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their directions" on public.project_directions for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners read their steps" on public.next_steps for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add steps to their projects" on public.next_steps for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid())));
create policy "Owners update their steps" on public.next_steps for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their steps" on public.next_steps for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy "People read their preferences" on public.user_preferences for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "People create their preferences" on public.user_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "People update their preferences" on public.user_preferences for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.project_directions, public.next_steps, public.user_preferences from anon, authenticated;

grant select, delete on public.project_directions to authenticated;
grant insert (project_id, label, reason, recommended, position) on public.project_directions to authenticated;
grant update (chosen) on public.project_directions to authenticated;

grant select, delete on public.next_steps to authenticated;
grant insert (project_id, direction_id, title, detail, minutes, source, position) on public.next_steps to authenticated;
grant update (title, detail, status, position, explanation, starter, done_at) on public.next_steps to authenticated;

grant select on public.user_preferences to authenticated;
grant insert (experience_mode) on public.user_preferences to authenticated;
grant update (experience_mode) on public.user_preferences to authenticated;
