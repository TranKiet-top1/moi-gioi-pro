create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_name text not null default 'free' check (plan_name in ('free', 'pro')),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled', 'expired')),
  start_date timestamptz not null default now(),
  end_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_plan_name on public.subscriptions(plan_name);
create index if not exists idx_subscriptions_status on public.subscriptions(status);
create index if not exists idx_subscriptions_end_date on public.subscriptions(end_date);

alter table public.subscriptions enable row level security;

drop policy if exists "users_read_own_subscription" on public.subscriptions;
create policy "users_read_own_subscription"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "admins_manage_subscriptions" on public.subscriptions;
create policy "admins_manage_subscriptions"
on public.subscriptions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.touch_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_subscription_updated_at on public.subscriptions;
create trigger trg_touch_subscription_updated_at
before update on public.subscriptions
for each row
execute function public.touch_subscription_updated_at();
