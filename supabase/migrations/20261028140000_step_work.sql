-- "Work on this step with Gusty": up to three simple questions per step, the person's answers,
-- and their own notes. The person's answers are never replaced by Gusty.

create table public.step_questions (
  id uuid primary key default gen_random_uuid(),
  step_id uuid not null references public.next_steps (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  question text not null check (char_length(question) between 1 and 300),
  hint text not null default '' check (char_length(hint) <= 300),
  answer text not null default '' check (char_length(answer) <= 2000),
  -- 'active' questions are shown; 'replaced' ones were swapped for different questions.
  status text not null default 'active' check (status in ('active', 'replaced')),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index step_questions_step_idx on public.step_questions (step_id, status, position);

create trigger step_questions_touch_updated_at
  before update on public.step_questions
  for each row execute function public.touch_updated_at();

alter table public.step_questions enable row level security;

create policy "Owners read their step questions" on public.step_questions for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy "Owners add questions to their own steps" on public.step_questions for insert to authenticated
  with check ((select auth.uid()) = owner_id
    and exists (select 1 from public.next_steps s
                where s.id = step_id and s.project_id = step_questions.project_id and s.owner_id = (select auth.uid())));
create policy "Owners update their step questions" on public.step_questions for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners delete their step questions" on public.step_questions for delete to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on public.step_questions from anon, authenticated;
grant select, delete on public.step_questions to authenticated;
grant insert (step_id, project_id, question, hint, position) on public.step_questions to authenticated;
grant update (question, hint, answer, status) on public.step_questions to authenticated;

-- The person's own notes while working on a step.
alter table public.next_steps add column notes text not null default '' check (char_length(notes) <= 4000);
grant update (notes) on public.next_steps to authenticated;
