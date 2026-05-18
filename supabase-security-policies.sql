-- Supabase RLS checklist for Môi giới Pro.
-- Run this in Supabase Dashboard > SQL Editor after backing up your project.
-- Assumptions:
--   public.profiles(id uuid primary key references auth.users, email text, role text)
--   public.premises has creator_email text and optional approval/report columns used by the frontend.
-- Adjust column names if your database differs.

begin;

alter table public.profiles enable row level security;
alter table public.premises enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'staff'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own_staff" on public.profiles;
create policy "profiles_insert_own_staff"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and email = (auth.jwt() ->> 'email')
  and role = 'staff'
);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_user_profile on auth.users;
create trigger trg_handle_new_user_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

drop policy if exists "premises_select_authenticated" on public.premises;
create policy "premises_select_authenticated"
on public.premises
for select
to authenticated
using (
  public.is_admin()
  or coalesce(is_approved, true) = true
  or creator_email = (auth.jwt() ->> 'email')
);

drop policy if exists "premises_insert_staff_or_admin" on public.premises;
create policy "premises_insert_staff_or_admin"
on public.premises
for insert
to authenticated
with check (
  public.is_admin()
  or creator_email = (auth.jwt() ->> 'email')
);

drop policy if exists "premises_admin_update_delete" on public.premises;
create policy "premises_admin_update_delete"
on public.premises
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Optional but recommended: make new staff-created posts wait for approval.
-- If this trigger conflicts with your existing schema, remove it and enforce the same logic in your app.
create or replace function public.set_premise_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.creator_email is null then
    new.creator_email := auth.jwt() ->> 'email';
  end if;

  if public.is_admin() then
    new.is_approved := coalesce(new.is_approved, true);
  else
    new.is_approved := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_set_premise_defaults on public.premises;
create trigger trg_set_premise_defaults
before insert on public.premises
for each row execute function public.set_premise_defaults();

drop policy if exists "premise_images_select_authenticated" on storage.objects;
create policy "premise_images_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'premise-images');

drop policy if exists "premise_images_insert_authenticated" on storage.objects;
create policy "premise_images_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'premise-images');

drop policy if exists "premise_images_admin_update_delete" on storage.objects;
create policy "premise_images_admin_update_delete"
on storage.objects
for all
to authenticated
using (bucket_id = 'premise-images' and public.is_admin())
with check (bucket_id = 'premise-images' and public.is_admin());

commit;

-- Storage note:
-- If bucket premise-images is public, anyone with a URL can view images.
-- For stricter control, make the bucket private and replace getPublicUrl() in the app with signed URLs.
