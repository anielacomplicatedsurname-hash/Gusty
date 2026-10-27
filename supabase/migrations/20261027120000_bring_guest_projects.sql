-- Bring a guest's projects into an existing account ("Welcome back to Gusty").
-- The guest starts a transfer, protected by a secret only their browser holds (we store its SHA-256).
-- After signing in to their account on the same device, the secret moves the guest's projects across.

create table public.project_transfers (
  token_hash text primary key check (char_length(token_hash) = 64),
  from_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.project_transfers enable row level security;
revoke all on public.project_transfers from anon, authenticated;

-- Called while still signed in as the guest.
create function public.start_project_transfer(p_token_hash text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null
     or not coalesce((select u.is_anonymous from auth.users u where u.id = auth.uid()), false) then
    raise exception 'only guests can bring their projects' using errcode = '42501';
  end if;
  delete from public.project_transfers
   where from_user = auth.uid() or created_at < now() - interval '1 day';
  insert into public.project_transfers (token_hash, from_user) values (p_token_hash, auth.uid());
end;
$$;

-- Called after signing in to the real account. Moves everything the guest owned, then removes the
-- empty guest account. Returns how many projects moved. Only ever moves from a guest account.
create function public.claim_guest_projects(p_token_hash text) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  guest uuid;
  moved integer;
begin
  if me is null or coalesce((select u.is_anonymous from auth.users u where u.id = me), true) then
    raise exception 'sign in to your account first' using errcode = '42501';
  end if;

  delete from public.project_transfers t
   where t.token_hash = p_token_hash and t.created_at > now() - interval '1 hour'
  returning t.from_user into guest;

  if guest is null or guest = me
     or not coalesce((select u.is_anonymous from auth.users u where u.id = guest), false) then
    return 0;
  end if;

  update public.projects set owner_id = me where owner_id = guest;
  get diagnostics moved = row_count;
  update public.project_facts set owner_id = me where owner_id = guest;
  update public.project_directions set owner_id = me where owner_id = guest;
  update public.next_steps set owner_id = me where owner_id = guest;
  update public.ai_runs set owner_id = me where owner_id = guest;
  delete from auth.users where id = guest;
  return moved;
end;
$$;

revoke all on function public.start_project_transfer(text) from public, anon;
revoke all on function public.claim_guest_projects(text) from public, anon;
grant execute on function public.start_project_transfer(text) to authenticated;
grant execute on function public.claim_guest_projects(text) to authenticated;
