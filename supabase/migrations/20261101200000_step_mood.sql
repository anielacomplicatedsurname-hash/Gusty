-- Choosing a next step by how you feel. A step can carry the kind of work it is (talking to people,
-- writing, planning, looking things up, making something). Steps without one are sorted by their words.
-- Safe to run more than once.

alter table public.next_steps add column if not exists mood text
  check (mood is null or mood in ('social', 'writing', 'planning', 'research', 'making'));

grant insert (mood) on public.next_steps to authenticated;
grant update (mood) on public.next_steps to authenticated;
