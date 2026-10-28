-- "Tell us what you think": short, optional feedback from testers. Read only by the founder (admin).

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid default auth.uid() references auth.users (id) on delete set null,
  worked text check (char_length(worked) <= 2000),
  confusing text check (char_length(confusing) <= 2000),
  other text check (char_length(other) <= 2000),
  -- Where they were (path with ids removed), so feedback lands next to the right moment.
  page text check (char_length(page) <= 200),
  created_at timestamptz not null default now(),
  check (coalesce(worked, '') <> '' or coalesce(confusing, '') <> '' or coalesce(other, '') <> '')
);

create index feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- How many messages the caller sent in the last day (the table itself stays unreadable to them).
create function public.feedback_sent_today() returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.feedback
  where owner_id = auth.uid() and created_at > now() - interval '1 day';
$$;

revoke all on function public.feedback_sent_today() from public, anon;
grant execute on function public.feedback_sent_today() to authenticated;

-- People can send feedback (as themselves), at most 20 a day; nobody can read it back through the app.
create policy "People can send feedback"
  on public.feedback for insert to authenticated
  with check ((select auth.uid()) = owner_id and public.feedback_sent_today() < 20);

revoke all on public.feedback from anon, authenticated;
grant insert (worked, confusing, other, page) on public.feedback to authenticated;

-- The founder's view: the latest 100 messages, newest first.
create function public.admin_feedback() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'worked', f.worked, 'confusing', f.confusing, 'other', f.other, 'page', f.page, 'at', f.created_at
    ) order by f.created_at desc)
    from (select * from public.feedback order by created_at desc limit 100) f
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_feedback() from public, anon;
grant execute on function public.admin_feedback() to authenticated;
