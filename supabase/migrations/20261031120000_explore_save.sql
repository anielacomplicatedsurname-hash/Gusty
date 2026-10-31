-- Explore, quick wins: what kind of opportunity each result is, and saving the ones a person likes to
-- their project. Safe to run more than once.

alter table public.found_opportunities
  add column if not exists kind text not null default 'grant',
  add column if not exists saved_at timestamptz;

alter table public.found_opportunities drop constraint if exists found_opportunities_kind_check;
alter table public.found_opportunities add constraint found_opportunities_kind_check check (kind in (
  'grant', 'crowdfunding', 'residency', 'fellowship', 'prize', 'commission', 'sponsorship', 'in_kind',
  'accelerator', 'social_investment', 'other'));

create index if not exists found_opportunities_saved_idx on public.found_opportunities (project_id, saved_at)
  where saved_at is not null;

grant insert (kind) on public.found_opportunities to authenticated;
grant update (saved_at) on public.found_opportunities to authenticated;

drop policy if exists "Owners update what was found" on public.found_opportunities;
create policy "Owners update what was found" on public.found_opportunities for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
