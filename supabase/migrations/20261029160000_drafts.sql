-- "Help me write it": a draft Gusty started from the person's answers and notes, which they chose to keep
-- and can change freely. Shown as "started by Gusty" so it's never mistaken for their own words.
-- Safe to run more than once.

alter table public.next_steps
  add column if not exists draft text not null default '' check (char_length(draft) <= 4000);

grant update (draft) on public.next_steps to authenticated;
