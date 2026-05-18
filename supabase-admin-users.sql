-- Account and membership management for Moi gioi Pro.
-- Run after supabase-security-policies.sql so public.is_admin() exists.

begin;

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.profiles
  alter column role set default 'user';

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'basic', 'pro')),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  started_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists idx_user_subscriptions_user_id on public.user_subscriptions(user_id);
create index if not exists idx_user_subscriptions_plan on public.user_subscriptions(plan);
create index if not exists idx_user_subscriptions_status on public.user_subscriptions(status);
create index if not exists idx_user_subscriptions_expires_at on public.user_subscriptions(expires_at);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_last_seen_at on public.profiles(last_seen_at);

alter table public.user_subscriptions enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "user_subscriptions_select_own_or_admin" on public.user_subscriptions;
create policy "user_subscriptions_select_own_or_admin"
on public.user_subscriptions
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "user_subscriptions_admin_manage" on public.user_subscriptions;
create policy "user_subscriptions_admin_manage"
on public.user_subscriptions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_profile_updated_at on public.profiles;
create trigger trg_touch_profile_updated_at
before update on public.profiles
for each row
execute function public.touch_profile_updated_at();

create or replace function public.touch_user_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_subscription_updated_at on public.user_subscriptions;
create trigger trg_touch_user_subscription_updated_at
before update on public.user_subscriptions
for each row
execute function public.touch_user_subscription_updated_at();

create or replace function public.ensure_current_user_profile_and_subscription()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.profiles (id, email, role, last_seen_at)
  values (auth.uid(), auth.jwt() ->> 'email', 'user', now())
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        last_seen_at = now(),
        updated_at = now();

  insert into public.user_subscriptions (user_id, plan, status, started_at, expires_at)
  values (auth.uid(), 'free', 'active', now(), null)
  on conflict (user_id) do nothing;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, created_at, updated_at)
  values (new.id, new.email, 'user', now(), now())
  on conflict (id) do nothing;

  insert into public.user_subscriptions (user_id, plan, status, started_at, expires_at)
  values (new.id, 'free', 'active', now(), null)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_user_profile on auth.users;
create trigger trg_handle_new_user_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

commit;
