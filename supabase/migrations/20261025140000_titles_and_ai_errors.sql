-- Gusty suggests a project title; a title the person chooses always wins.
alter table public.projects
  add column title_source text not null default 'auto'
  check (title_source in ('auto', 'ai', 'user'));

comment on column public.projects.title_source is
  'auto: first line of the idea · ai: suggested by Gusty · user: chosen by the person (never overwritten)';

grant update (title, idea, title_source) on public.projects to authenticated;

-- Why an AI call failed, for diagnosis (never content).
alter table public.ai_runs
  add column error text check (error in ('key', 'busy', 'declined', 'invalid', 'other'));

grant insert (project_id, task, model, prompt_version, status, input_tokens, output_tokens, cost_usd, error)
  on public.ai_runs to authenticated;
