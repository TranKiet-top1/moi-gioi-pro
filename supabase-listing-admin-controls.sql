-- Listing admin controls for Moi gioi Pro.
-- Run after supabase-security-policies.sql so public.is_admin() exists.

begin;

alter table public.premises
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists is_featured boolean not null default false,
  add column if not exists featured_order int not null default 0,
  add column if not exists featured_at timestamptz,
  add column if not exists featured_by uuid references auth.users(id);

create index if not exists idx_premises_is_deleted on public.premises(is_deleted);
create index if not exists idx_premises_is_featured on public.premises(is_featured);
create index if not exists idx_premises_featured_order on public.premises(featured_order);
create index if not exists idx_premises_featured_at on public.premises(featured_at);

create table if not exists public.phone_view_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  listing_id uuid,
  viewed_at timestamptz not null default now()
);

create index if not exists idx_phone_view_logs_user_id on public.phone_view_logs(user_id);
create index if not exists idx_phone_view_logs_listing_id on public.phone_view_logs(listing_id);
create index if not exists idx_phone_view_logs_viewed_at on public.phone_view_logs(viewed_at);

alter table public.phone_view_logs enable row level security;

drop policy if exists "phone_view_logs_insert_own_or_admin" on public.phone_view_logs;
create policy "phone_view_logs_insert_own_or_admin"
on public.phone_view_logs
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "phone_view_logs_admin_read" on public.phone_view_logs;
create policy "phone_view_logs_admin_read"
on public.phone_view_logs
for select
to authenticated
using (public.is_admin());

-- Existing premises update/delete policies should already restrict writes to admin.
-- Keep sensitive owner phone safer long-term by moving phone/source fields to a protected table or view.

commit;
