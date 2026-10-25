-- Gusty stage 5: a private overview for the founder. Counts and costs only, never anyone's ideas.

-- Who may see the overview. Only added by hand in the SQL Editor; the app can't read or change it.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Everything the admin page shows, in one call. Days are UTC. Costs are estimates from token counts.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'people', (
      select jsonb_build_object(
        'total', count(*),
        'withEmail', count(*) filter (where not coalesce(u.is_anonymous, false)),
        'guests', count(*) filter (where coalesce(u.is_anonymous, false)),
        'newThisWeek', count(*) filter (where u.created_at >= now() - interval '7 days')
      )
      from auth.users u
    ),
    'projects', (
      select jsonb_build_object(
        'total', count(*),
        'newThisWeek', count(*) filter (where p.created_at >= now() - interval '7 days')
      )
      from public.projects p
    ),
    'cost', (
      select jsonb_build_object(
        'today', coalesce(sum(r.cost_usd) filter (where r.created_at >= today::timestamp at time zone 'utc'), 0),
        'week', coalesce(sum(r.cost_usd) filter (where r.created_at >= now() - interval '7 days'), 0),
        'month', coalesce(sum(r.cost_usd), 0)
      )
      from public.ai_runs r
      where r.created_at >= now() - interval '30 days'
    ),
    'days', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'runs', d.runs, 'errors', d.errors, 'cost', d.cost) order by d.day desc), '[]'::jsonb)
      from (
        select g.day::date as day,
               count(r.id) as runs,
               count(r.id) filter (where r.status in ('error', 'declined')) as errors,
               coalesce(sum(r.cost_usd), 0) as cost
        from generate_series(today - 13, today, interval '1 day') as g(day)
        left join public.ai_runs r on (r.created_at at time zone 'utc')::date = g.day::date
        group by g.day
      ) d
    ),
    'tasks', (
      select coalesce(jsonb_agg(jsonb_build_object('task', t.task, 'runs', t.runs, 'demo', t.demo, 'errors', t.errors, 'cost', t.cost) order by t.runs desc), '[]'::jsonb)
      from (
        select r.task,
               count(*) as runs,
               count(*) filter (where r.status = 'demo') as demo,
               count(*) filter (where r.status in ('error', 'declined')) as errors,
               sum(r.cost_usd) as cost
        from public.ai_runs r
        where r.created_at >= now() - interval '7 days'
        group by r.task
      ) t
    ),
    'errors', (
      select coalesce(jsonb_agg(jsonb_build_object('reason', e.reason, 'count', e.count, 'last', e.last) order by e.count desc), '[]'::jsonb)
      from (
        select coalesce(r.error, r.status) as reason, count(*) as count, max(r.created_at) as last
        from public.ai_runs r
        where r.created_at >= now() - interval '7 days' and r.status in ('error', 'declined')
        group by 1
      ) e
    )
  );
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
