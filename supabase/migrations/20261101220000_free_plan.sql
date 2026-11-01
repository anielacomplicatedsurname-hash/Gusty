-- The free plan: up to 3 projects at a time, and deep searches per calendar month (1, plus 1 more after
-- giving feedback). The project limit is enforced here so no route can get round it. People who already
-- have more than 3 keep them; they just can't start another until they're under 3. Admins aren't limited.
-- Safe to run more than once.

create or replace function public.enforce_project_limit() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin()
     and (select count(*) from public.projects p where p.owner_id = new.owner_id) >= 3 then
    raise exception 'project limit reached' using errcode = 'P0001', hint = 'project_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_limit on public.projects;
create trigger projects_limit before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- Feedback can't be read back from the app; this says only whether the person has sent any since a date,
-- for the extra deep search. It never returns what they wrote.
create or replace function public.my_feedback_since(since timestamptz) returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.feedback f where f.owner_id = auth.uid() and f.created_at >= since;
$$;

revoke all on function public.my_feedback_since(timestamptz) from public, anon;
grant execute on function public.my_feedback_since(timestamptz) to authenticated;
revoke all on function public.enforce_project_limit() from public, anon, authenticated;
