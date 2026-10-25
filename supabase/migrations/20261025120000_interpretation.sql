-- Gusty stage 3: Gusty's reading of an idea, item by item, with provenance.
-- Gusty never overwrites what a person wrote or confirmed: only unconfirmed AI items are replaced.

create table public.project_facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('summary', 'audience', 'place', 'stage', 'need', 'question')),
  value text not null check (char_length(value) between 1 and 300),
  -- user: written or edited by the person · ai_from_user: Gusty restating their words ·
  -- ai_suggestion: Gusty's own inference
  source text not null check (source in ('user', 'ai_from_user', 'ai_suggestion')),
  status text not null default 'proposed' check (status in ('proposed', 'confirmed')),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_facts_project_idx on public.project_facts (project_id, kind, position);

alter table public.project_facts enable row level security;

create policy "Owners can read their project facts"
  on public.project_facts for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can add facts to their own projects"
  on public.project_facts for insert to authenticated
  with check (
    (select auth.uid()) = owner_id
    and exists (select 1 from public.projects p where p.id = project_id and p.owner_id = (select auth.uid()))
  );

create policy "Owners can update their project facts"
  on public.project_facts for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their project facts"
  on public.project_facts for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.project_facts from anon, authenticated;
grant select, delete on public.project_facts to authenticated;
grant insert (project_id, kind, value, source, status, position) on public.project_facts to authenticated;
grant update (value, source, status) on public.project_facts to authenticated;

create trigger project_facts_touch_updated_at
  before update on public.project_facts
  for each row execute function public.touch_updated_at();

-- AI usage log: what ran, on which model, how many tokens, what it cost. Never the content.
create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects (id) on delete set null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task text not null,
  model text not null,
  prompt_version text not null,
  status text not null check (status in ('ok', 'demo', 'error', 'declined')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index ai_runs_owner_created_idx on public.ai_runs (owner_id, created_at desc);

alter table public.ai_runs enable row level security;

create policy "Owners can read their AI runs"
  on public.ai_runs for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "Owners can log their AI runs"
  on public.ai_runs for insert to authenticated
  with check ((select auth.uid()) = owner_id);

revoke all on public.ai_runs from anon, authenticated;
grant select on public.ai_runs to authenticated;
grant insert (project_id, task, model, prompt_version, status, input_tokens, output_tokens, cost_usd)
  on public.ai_runs to authenticated;
