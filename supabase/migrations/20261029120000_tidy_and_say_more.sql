-- Gusty's tidied copy of answers and notes (spelling, grammar, phrasing), shown in "What you've
-- worked out" next to the person's own words, which are always kept. And a mark on answers where
-- the person used "Help me say more", so Gusty's additions stay labelled.

alter table public.step_questions
  add column if not exists answer_tidied text not null default '' check (char_length(answer_tidied) <= 2400),
  add column if not exists assisted boolean not null default false;

alter table public.next_steps
  add column if not exists notes_tidied text not null default '' check (char_length(notes_tidied) <= 4800);

grant update (answer_tidied, assisted) on public.step_questions to authenticated;
grant update (notes_tidied) on public.next_steps to authenticated;

-- A tidied copy belongs to one version of the text: when the person changes their words,
-- the old tidied copy is cleared (unless the same update sets a new one).
create or replace function public.clear_stale_tidied() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_table_name = 'step_questions' then
    if new.answer is distinct from old.answer and new.answer_tidied is not distinct from old.answer_tidied then
      new.answer_tidied := '';
    end if;
  elsif new.notes is distinct from old.notes and new.notes_tidied is not distinct from old.notes_tidied then
    new.notes_tidied := '';
  end if;
  return new;
end;
$$;

drop trigger if exists step_questions_clear_stale_tidied on public.step_questions;
create trigger step_questions_clear_stale_tidied
  before update on public.step_questions
  for each row execute function public.clear_stale_tidied();

drop trigger if exists next_steps_clear_stale_tidied on public.next_steps;
create trigger next_steps_clear_stale_tidied
  before update on public.next_steps
  for each row execute function public.clear_stale_tidied();
