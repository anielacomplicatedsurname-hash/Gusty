-- Explore, slice 1: funding opportunities the founder curates and checks. Gusty can read a funder's page
-- to fill in the details, but nothing is shown until the founder has checked it and published it.
-- Anyone can read published opportunities; only admins can add or change them. Safe to run more than once.

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'funding' check (kind in ('funding')),
  title text not null check (char_length(title) between 1 and 200),
  funder text not null default '' check (char_length(funder) <= 200),
  url text not null check (url ~ '^https://' and char_length(url) <= 1000),
  summary text not null default '' check (char_length(summary) <= 600),
  who_for text not null default '' check (char_length(who_for) <= 600),
  amount text not null default '' check (char_length(amount) <= 120),
  deadline date,
  deadline_note text not null default '' check (char_length(deadline_note) <= 120),
  regions text[] not null default '{}' check (regions <@ array['uk', 'europe', 'international']::text[]),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- When the founder last checked the details against the funder's page.
  checked_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists opportunities_published_idx on public.opportunities (status, deadline);

drop trigger if exists opportunities_touch_updated_at on public.opportunities;
create trigger opportunities_touch_updated_at
  before update on public.opportunities
  for each row execute function public.touch_updated_at();

alter table public.opportunities enable row level security;

drop policy if exists "Anyone reads published opportunities" on public.opportunities;
drop policy if exists "Admins read all opportunities" on public.opportunities;
drop policy if exists "Admins add opportunities" on public.opportunities;
drop policy if exists "Admins change opportunities" on public.opportunities;
drop policy if exists "Admins delete opportunities" on public.opportunities;
create policy "Anyone reads published opportunities" on public.opportunities for select to anon, authenticated
  using (status = 'published');
create policy "Admins read all opportunities" on public.opportunities for select to authenticated
  using ((select public.is_admin()));
create policy "Admins add opportunities" on public.opportunities for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins change opportunities" on public.opportunities for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete opportunities" on public.opportunities for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.opportunities from anon, authenticated;
grant select on public.opportunities to anon, authenticated;
grant insert (kind, title, funder, url, summary, who_for, amount, deadline, deadline_note, regions, status, checked_at)
  on public.opportunities to authenticated;
grant update (title, funder, url, summary, who_for, amount, deadline, deadline_note, regions, status, checked_at)
  on public.opportunities to authenticated;
grant delete on public.opportunities to authenticated;
