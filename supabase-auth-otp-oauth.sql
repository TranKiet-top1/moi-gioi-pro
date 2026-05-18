-- Môi giới Pro - Verified Auth setup for Email OTP/Magic Link, Google OAuth and Phone OTP.
-- Run this in Supabase SQL Editor after enabling providers in Authentication settings.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text,
  avatar_url text,
  auth_provider text,
  is_email_verified boolean default false,
  is_phone_verified boolean default false,
  role text default 'user',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_seen_at timestamptz
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists auth_provider text,
  add column if not exists is_email_verified boolean default false,
  add column if not exists is_phone_verified boolean default false,
  add column if not exists role text default 'user',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists last_seen_at timestamptz;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text default 'free_trial',
  plan_type text default 'free_trial',
  status text default 'active',
  started_at timestamptz default now(),
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_subscriptions
  add column if not exists plan text default 'free_trial',
  add column if not exists plan_type text default 'free_trial',
  add column if not exists status text default 'active',
  add column if not exists started_at timestamptz default now(),
  add column if not exists expires_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists idx_profiles_email_unique
  on public.profiles(lower(email))
  where email is not null;

create unique index if not exists idx_profiles_phone_unique
  on public.profiles(phone)
  where phone is not null;

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_last_seen_at on public.profiles(last_seen_at);
create index if not exists idx_user_subscriptions_user_id on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions(status);
create index if not exists idx_user_subscriptions_plan_type on public.user_subscriptions(plan_type);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, 'user')) = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_user_subscriptions_touch_updated_at on public.user_subscriptions;
create trigger trg_user_subscriptions_touch_updated_at
before update on public.user_subscriptions
for each row execute function public.touch_updated_at();

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and old.role is distinct from new.role then
    raise exception 'Bạn không được tự sửa vai trò tài khoản';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_profile_role_escalation on public.profiles;
create trigger trg_prevent_profile_role_escalation
before update on public.profiles
for each row execute function public.prevent_profile_role_escalation();

create or replace function public.default_auth_provider(new_user auth.users)
returns text
language plpgsql
stable
as $$
begin
  if new_user.raw_app_meta_data ? 'provider' then
    return coalesce(new_user.raw_app_meta_data->>'provider', 'email');
  end if;
  if new_user.phone is not null then return 'phone'; end if;
  return 'email';
end;
$$;

create or replace function public.upsert_profile_and_trial_for_user(new_user auth.users)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_provider text := public.default_auth_provider(new_user);
  v_full_name text := coalesce(
    new_user.raw_user_meta_data->>'full_name',
    new_user.raw_user_meta_data->>'name'
  );
  v_avatar text := coalesce(
    new_user.raw_user_meta_data->>'avatar_url',
    new_user.raw_user_meta_data->>'picture'
  );
begin
  insert into public.profiles (
    id, email, phone, full_name, avatar_url, auth_provider,
    is_email_verified, is_phone_verified, role, last_seen_at
  )
  values (
    new_user.id,
    new_user.email,
    new_user.phone,
    v_full_name,
    v_avatar,
    v_provider,
    new_user.email_confirmed_at is not null or v_provider = 'google',
    new_user.phone_confirmed_at is not null,
    'user',
    now()
  )
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        phone = coalesce(excluded.phone, public.profiles.phone),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        auth_provider = coalesce(excluded.auth_provider, public.profiles.auth_provider),
        is_email_verified = public.profiles.is_email_verified or excluded.is_email_verified,
        is_phone_verified = public.profiles.is_phone_verified or excluded.is_phone_verified,
        last_seen_at = now();

  insert into public.user_subscriptions (
    user_id, plan, plan_type, status, started_at, expires_at
  )
  select new_user.id, 'free_trial', 'free_trial', 'active', now(), now() + interval '7 days'
  where not exists (
    select 1
    from public.user_subscriptions us
    where us.user_id = new_user.id
      and us.status = 'active'
      and (us.expires_at is null or us.expires_at > now())
  );
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.upsert_profile_and_trial_for_user(new);
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user_profile on auth.users;
create trigger trg_handle_new_user_profile
after insert or update of email_confirmed_at, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data
on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.ensure_current_user_profile_and_subscription()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users%rowtype;
begin
  if auth.uid() is null then
    return;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if not found then
    return;
  end if;

  perform public.upsert_profile_and_trial_for_user(v_user);
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_subscriptions enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own_safe on public.profiles;
create policy profiles_update_own_safe
on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert
on public.profiles
for insert
with check (id = auth.uid() or public.is_admin());

drop policy if exists user_subscriptions_select_own_or_admin on public.user_subscriptions;
create policy user_subscriptions_select_own_or_admin
on public.user_subscriptions
for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists user_subscriptions_admin_manage on public.user_subscriptions;
create policy user_subscriptions_admin_manage
on public.user_subscriptions
for all
using (public.is_admin())
with check (public.is_admin());

grant execute on function public.ensure_current_user_profile_and_subscription() to authenticated;
