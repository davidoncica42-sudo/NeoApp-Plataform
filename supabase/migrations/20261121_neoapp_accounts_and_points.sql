-- NeoApp account profile, point ledger, daily claim and reward redemption.
-- All balance-changing work runs in PostgreSQL and is scoped to auth.uid().

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Explorador',
  points integer not null default 0 check (points >= 0),
  last_daily_claim date,
  created_at timestamptz not null default now()
);

create table if not exists public.point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.point_transactions enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.point_transactions from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.point_transactions to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can read their own point history" on public.point_transactions;
create policy "Users can read their own point history"
  on public.point_transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.create_neoapp_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Explorador')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_neoapp_profile() from public, anon, authenticated;
drop trigger if exists on_neoapp_user_created on auth.users;
create trigger on_neoapp_user_created
  after insert on auth.users
  for each row execute procedure public.create_neoapp_profile();

create or replace function public.claim_daily_points()
returns table (points integer, claimed boolean, claim_date date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (now() at time zone 'UTC')::date;
  v_points integer;
  v_last_claim date;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.profiles
    set points = public.profiles.points + 150,
        last_daily_claim = v_today
    where id = v_user_id
      and (last_daily_claim is null or last_daily_claim < v_today)
    returning public.profiles.points into v_points;

  if found then
    insert into public.point_transactions (user_id, amount, reason)
    values (v_user_id, 150, 'Recompensa diaria');
    return query select v_points, true, v_today;
    return;
  end if;

  select p.points, p.last_daily_claim
    into v_points, v_last_claim
    from public.profiles as p
    where p.id = v_user_id;

  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  return query select v_points, false, v_last_claim;
end;
$$;

revoke all on function public.claim_daily_points() from public, anon;
grant execute on function public.claim_daily_points() to authenticated;

create or replace function public.redeem_reward(p_reward_id text)
returns table (points integer, reward_name text, cost integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_points integer;
  v_cost integer;
  v_reward_name text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select p.points into v_points
    from public.profiles as p
    where p.id = v_user_id
    for update;
  if not found then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  case p_reward_id
    when 'halo-aurora' then v_cost := 850; v_reward_name := 'Halo Aurora';
    when 'impulso-orbital' then v_cost := 1200; v_reward_name := 'Impulso orbital';
    when 'nebulosa-violeta' then v_cost := 600; v_reward_name := 'Nebulosa violeta';
    when 'lunita' then v_cost := 1800; v_reward_name := 'Lunita';
    when 'pase-explorador' then v_cost := 950; v_reward_name := 'Pase explorador';
    when 'capsula-estelar' then v_cost := 500; v_reward_name := 'Cápsula estelar';
    else raise exception 'REWARD_NOT_FOUND';
  end case;

  if v_points < v_cost then
    raise exception 'INSUFFICIENT_POINTS';
  end if;

  update public.profiles
    set points = public.profiles.points - v_cost
    where id = v_user_id
    returning public.profiles.points into v_points;
  insert into public.point_transactions (user_id, amount, reason)
    values (v_user_id, -v_cost, 'Canje: ' || v_reward_name);
  return query select v_points, v_reward_name, v_cost;
end;
$$;

revoke all on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;

