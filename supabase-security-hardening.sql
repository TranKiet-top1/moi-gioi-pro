-- Môi giới Pro - Security hardening for sensitive listing data.
-- Run this file in Supabase SQL Editor after backing up the database.
-- Frontend must use public_premises_view for lists and RPCs for phone/map details.

create extension if not exists pgcrypto;

begin;

-- ---------------------------------------------------------------------------
-- 1) Schema updates
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.premises enable row level security;

alter table public.premises
  add column if not exists owner_phone text,
  add column if not exists owner_name text,
  add column if not exists exact_address text,
  add column if not exists map_url text,
  add column if not exists internal_note text,
  add column if not exists source_note text,
  add column if not exists is_deleted boolean default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists is_featured boolean default false,
  add column if not exists featured_order int default 0,
  add column if not exists featured_at timestamptz,
  add column if not exists featured_by uuid;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'premises' and column_name = 'contact_phone'
  ) then
    execute 'update public.premises set owner_phone = contact_phone where owner_phone is null and contact_phone is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'premises' and column_name = 'address'
  ) then
    execute 'update public.premises set exact_address = address where exact_address is null and address is not null';
  end if;
end $$;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text default 'free_trial',
  plan_type text not null default 'free_trial',
  status text not null default 'active',
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

do $$
begin
  execute 'update public.user_subscriptions set plan_type = coalesce(plan_type, plan, ''free_trial''), plan = coalesce(plan, plan_type, ''free_trial'')';
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_subscriptions' and column_name = 'plan_name'
  ) then
    execute 'update public.user_subscriptions set plan_type = coalesce(plan_type, plan_name, ''free_trial'')';
  end if;
end $$;

create table if not exists public.owner_phone_access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  premise_id uuid not null references public.premises(id) on delete cascade,
  plan_type text not null,
  accessed_at timestamptz not null default now(),
  access_date date not null default current_date,
  ip_address inet,
  user_agent text
);

create unique index if not exists ux_owner_phone_access_logs_day
  on public.owner_phone_access_logs(user_id, premise_id, access_date);

create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.premises(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique(user_id, listing_id)
);

create table if not exists public.client_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  client_name text,
  share_slug text unique,
  is_public boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.client_collections(id) on delete cascade,
  listing_id uuid not null references public.premises(id) on delete cascade,
  sort_order int default 0,
  note_for_client text,
  created_at timestamptz not null default now(),
  unique(collection_id, listing_id)
);

alter table if exists public.saved_listings enable row level security;
alter table if exists public.client_collections enable row level security;
alter table if exists public.client_collection_items enable row level security;
alter table public.owner_phone_access_logs enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.admin_logs enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Helpers
-- ---------------------------------------------------------------------------

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

create or replace function public.current_plan_type(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((
    select lower(coalesce(us.plan_type, 'free_trial'))
    from public.user_subscriptions us
    where us.user_id = p_user_id
      and us.status = 'active'
      and (us.expires_at is null or us.expires_at > now())
    order by us.created_at desc
    limit 1
  ), 'free_trial');
$$;

create or replace function public.get_today_phone_access_count(p_user_id uuid)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(distinct premise_id)::int
  from public.owner_phone_access_logs
  where user_id = p_user_id
    and access_date = current_date;
$$;

create or replace function public.get_my_plan()
returns table (
  plan_type text,
  status text,
  started_at timestamptz,
  expires_at timestamptz,
  days_left int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  return query
  select
    coalesce(us.plan_type, 'free_trial')::text,
    coalesce(us.status, 'active')::text,
    us.started_at,
    us.expires_at,
    case
      when us.expires_at is null then null
      else greatest(0, ceil(extract(epoch from (us.expires_at - now())) / 86400)::int)
    end
  from public.user_subscriptions us
  where us.user_id = auth.uid()
  order by us.created_at desc
  limit 1;

  if not found then
    return query select 'free_trial'::text, 'active'::text, null::timestamptz, null::timestamptz, null::int;
  end if;
end;
$$;

create or replace function public.get_my_quota_status()
returns table (
  plan_type text,
  phone_limit_per_day int,
  phone_used_today int,
  phone_remaining_today int,
  saved_limit int,
  saved_used int,
  album_item_limit int,
  album_item_used int
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_phone_limit int;
  v_saved_limit int;
  v_album_limit int;
  v_phone_used int;
  v_saved_used int := 0;
  v_album_used int := 0;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập';
  end if;

  v_plan := public.current_plan_type(v_uid);
  v_phone_limit := case when v_plan = 'pro' then 20 when v_plan = 'basic' then 7 else 0 end;
  v_saved_limit := case when v_plan = 'pro' then null when v_plan = 'basic' then 3 else 0 end;
  v_album_limit := case when v_plan = 'pro' then null when v_plan = 'basic' then 3 else 0 end;
  v_phone_used := public.get_today_phone_access_count(v_uid);

  if to_regclass('public.saved_listings') is not null then
    select count(*)::int into v_saved_used from public.saved_listings where user_id = v_uid;
  end if;

  if to_regclass('public.client_collections') is not null
     and to_regclass('public.client_collection_items') is not null then
    select count(cci.*)::int
    into v_album_used
    from public.client_collection_items cci
    join public.client_collections cc on cc.id = cci.collection_id
    where cc.user_id = v_uid;
  end if;

  return query select
    v_plan,
    v_phone_limit,
    v_phone_used,
    case when v_phone_limit is null then null else greatest(0, v_phone_limit - v_phone_used) end,
    v_saved_limit,
    v_saved_used,
    v_album_limit,
    v_album_used;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) Safe public view
-- ---------------------------------------------------------------------------

create or replace view public.public_premises_view as
select
  p.id,
  coalesce(p.code, 'Mặt bằng') as title,
  p.code,
  p.area,
  p.price,
  p.district,
  p.ward,
  p.city,
  p.street as street_name,
  p.street,
  p.road_type as property_type,
  p.road_type,
  p.frontage,
  p.direction,
  p.ket_cau as suitable_for,
  p.ket_cau,
  p.width,
  p.length,
  p.floors,
  p.pn,
  p.wc,
  p.images as images_public,
  p.images,
  p.status,
  p.is_approved,
  p.rented_reported_at,
  p.rented_confirmed_at,
  p.rented_reporter_email,
  p.reactivate_reported_at,
  p.reactivate_confirmed_at,
  p.reactivate_reporter_email,
  p.is_featured,
  p.featured_order,
  p.featured_at,
  p.is_deleted,
  p.created_at,
  p.updated_at
from public.premises p
where coalesce(p.is_deleted, false) = false;

grant select on public.public_premises_view to anon, authenticated;

revoke select on public.premises from anon, authenticated;
grant select (
  id, code, images, price, area, width, length, floors, pn, wc,
  ket_cau, road_type, frontage, direction, status, ward, district,
  city, street, created_at, updated_at, is_approved, rented_reported_at,
  rented_confirmed_at, rented_reporter_email, reactivate_reported_at,
  reactivate_confirmed_at, reactivate_reporter_email,
  is_featured, featured_order, featured_at, is_deleted
) on public.premises to anon, authenticated;

-- Column-level hardening for sensitive premise columns.
do $$
declare
  col_name text;
begin
  foreach col_name in array array[
    'owner_phone', 'owner_name', 'exact_address', 'map_url', 'lat', 'lng',
    'internal_note', 'source_note', 'contact_phone', 'address', 'owner_note',
    'source_phone', 'contact_name'
  ]
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'premises' and column_name = col_name
    ) then
      execute format('revoke select (%I) on public.premises from anon, authenticated', col_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Sensitive RPCs
-- ---------------------------------------------------------------------------

drop function if exists public.reveal_owner_phone(uuid);

create or replace function public.reveal_owner_phone(p_premise_id uuid)
returns table (
  owner_phone text,
  phone_remaining_today int,
  phone_limit_per_day int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_premise_id uuid := p_premise_id;
  v_plan text;
  v_limit int;
  v_used int;
  v_phone text;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập để xem số chủ';
  end if;

  v_plan := case when public.is_admin() then 'admin' else public.current_plan_type(v_uid) end;
  v_limit := case when v_plan = 'admin' then null when v_plan = 'pro' then 20 when v_plan = 'basic' then 7 else 0 end;

  if v_plan not in ('admin', 'basic', 'pro') then
    raise exception 'Bạn cần nâng cấp gói để xem số chủ';
  end if;

  select coalesce(p.owner_phone, p.contact_phone)
  into v_phone
  from public.premises p
  where p.id = v_premise_id
    and coalesce(p.is_deleted, false) = false;

  if v_phone is null or length(trim(v_phone)) = 0 then
    raise exception 'Tin này chưa có số chủ';
  end if;

  v_used := public.get_today_phone_access_count(v_uid);
  if v_limit is not null
     and not exists (
       select 1 from public.owner_phone_access_logs l
       where l.user_id = v_uid
         and l.premise_id = v_premise_id
         and l.access_date = current_date
     )
     and v_used >= v_limit then
    raise exception 'Bạn đã hết lượt xem số chủ hôm nay';
  end if;

  insert into public.owner_phone_access_logs(user_id, premise_id, plan_type, access_date)
  values (v_uid, v_premise_id, v_plan, current_date)
  on conflict (user_id, premise_id, access_date) do nothing;

  v_used := public.get_today_phone_access_count(v_uid);
  return query select v_phone, case when v_limit is null then null else greatest(0, v_limit - v_used) end, v_limit;
end;
$$;

drop function if exists public.get_premise_sensitive_detail(uuid);

create or replace function public.get_premise_sensitive_detail(p_premise_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_premise_id uuid := p_premise_id;
  v_uid uuid := auth.uid();
  v_plan text;
  p public.premises%rowtype;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập để xem thông tin chi tiết';
  end if;

  select * into p
  from public.premises
  where id = v_premise_id
    and coalesce(is_deleted, false) = false;

  if not found then
    raise exception 'Không tìm thấy mặt bằng';
  end if;

  v_plan := case when public.is_admin() then 'admin' else public.current_plan_type(v_uid) end;

  if v_plan = 'free_trial' then
    raise exception 'Bạn cần nâng cấp gói để xem thông tin chi tiết';
  end if;

  if v_plan = 'basic' then
    return jsonb_build_object(
      'plan_type', v_plan,
      'map_precision', 'small',
      'district', p.district,
      'ward', p.ward,
      'street_name', p.street
    );
  end if;

  return jsonb_build_object(
    'plan_type', v_plan,
    'map_precision', 'full',
    'exact_address', coalesce(p.exact_address, p.address),
    'map_url', p.map_url,
    'lat', p.lat,
    'lng', p.lng,
    'owner_name', case when v_plan = 'admin' then p.owner_name else null end,
    'source_note', case when v_plan in ('admin', 'pro') then p.source_note else null end,
    'internal_note', case when v_plan = 'admin' then p.internal_note else null end
  );
end;
$$;

grant execute on function public.reveal_owner_phone(uuid) to authenticated;
grant execute on function public.get_premise_sensitive_detail(uuid) to authenticated;
grant execute on function public.get_today_phone_access_count(uuid) to authenticated;
grant execute on function public.get_my_plan() to authenticated;
grant execute on function public.get_my_quota_status() to authenticated;

drop function if exists public.get_premise_map_detail(uuid);

create or replace function public.get_premise_map_detail(p_premise_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_lat numeric;
  v_lng numeric;
  p public.premises%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object(
      'can_view_map', false,
      'map_level', 'none',
      'message', 'Bạn cần đăng nhập để xem bản đồ.'
    );
  end if;

  select * into p
  from public.premises
  where id = p_premise_id
    and coalesce(is_deleted, false) = false;

  if not found then
    return jsonb_build_object(
      'can_view_map', false,
      'map_level', 'none',
      'message', 'Không tìm thấy mặt bằng.'
    );
  end if;

  v_plan := case when public.is_admin() then 'admin' else public.current_plan_type(v_uid) end;

  if v_plan not in ('admin', 'basic', 'pro') then
    return jsonb_build_object(
      'can_view_map', false,
      'map_level', 'none',
      'message', 'Bạn cần nâng cấp gói để xem bản đồ.'
    );
  end if;

  if v_plan = 'basic' then
    v_lat := case when p.lat is null then null else round(p.lat::numeric, 3) end;
    v_lng := case when p.lng is null then null else round(p.lng::numeric, 3) end;
    return jsonb_build_object(
      'can_view_map', true,
      'map_level', 'limited',
      'lat', v_lat,
      'lng', v_lng,
      'district', p.district,
      'ward', p.ward,
      'street_name', p.street,
      'message', 'Vị trí đang được hiển thị tương đối theo quyền Basic.'
    );
  end if;

  return jsonb_build_object(
    'can_view_map', true,
    'map_level', 'full',
    'lat', p.lat,
    'lng', p.lng,
    'map_url', p.map_url,
    'exact_address', coalesce(p.exact_address, p.address),
    'district', p.district,
    'ward', p.ward,
    'street_name', p.street,
    'message', 'Vị trí chi tiết theo quyền Pro/Admin.'
  );
end;
$$;

grant execute on function public.get_premise_map_detail(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Quota triggers
-- ---------------------------------------------------------------------------

create or replace function public.enforce_saved_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := public.current_plan_type(new.user_id);
  v_count int;
begin
  if v_plan = 'basic' then
    select count(*)::int into v_count from public.saved_listings where user_id = new.user_id;
    if v_count >= 3 then
      raise exception 'Gói Basic chỉ lưu được tối đa 3 tin';
    end if;
  elsif v_plan = 'free_trial' then
    raise exception 'Bạn cần nâng cấp gói để lưu tin';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_saved_listing_limit on public.saved_listings;
create trigger trg_enforce_saved_listing_limit
before insert on public.saved_listings
for each row execute function public.enforce_saved_listing_limit();

create or replace function public.enforce_album_item_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan text;
  v_count int;
begin
  select user_id into v_owner from public.client_collections where id = new.collection_id;
  if v_owner is null then
    raise exception 'Không tìm thấy album gửi khách';
  end if;
  v_plan := public.current_plan_type(v_owner);
  if v_plan = 'basic' then
    select count(*)::int into v_count from public.client_collection_items where collection_id = new.collection_id;
    if v_count >= 3 then
      raise exception 'Gói Basic chỉ thêm tối đa 3 tin vào album gửi khách';
    end if;
  elsif v_plan = 'free_trial' then
    raise exception 'Bạn cần nâng cấp gói để dùng album gửi khách';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_album_item_limit on public.client_collection_items;
create trigger trg_enforce_album_item_limit
before insert on public.client_collection_items
for each row execute function public.enforce_album_item_limit();

-- ---------------------------------------------------------------------------
-- 6) RLS policies
-- ---------------------------------------------------------------------------

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_self_select on public.user_subscriptions;
create policy subscriptions_self_select on public.user_subscriptions
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists subscriptions_admin_write on public.user_subscriptions;
create policy subscriptions_admin_write on public.user_subscriptions
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists phone_logs_self_select on public.owner_phone_access_logs;
create policy phone_logs_self_select on public.owner_phone_access_logs
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists admin_logs_admin_select on public.admin_logs;
create policy admin_logs_admin_select on public.admin_logs
for select using (public.is_admin());

drop policy if exists admin_logs_admin_insert on public.admin_logs;
create policy admin_logs_admin_insert on public.admin_logs
for insert with check (public.is_admin());

drop policy if exists premises_public_safe_rows on public.premises;
create policy premises_public_safe_rows on public.premises
for select using (coalesce(is_deleted, false) = false and coalesce(is_approved, true) = true);

drop policy if exists premises_admin_write on public.premises;
create policy premises_admin_write on public.premises
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists saved_listings_owner_all on public.saved_listings;
create policy saved_listings_owner_all on public.saved_listings
for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists client_collections_owner_all on public.client_collections;
create policy client_collections_owner_all on public.client_collections
for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

drop policy if exists client_collection_items_owner_all on public.client_collection_items;
create policy client_collection_items_owner_all on public.client_collection_items
for all
using (
  exists (
    select 1 from public.client_collections c
    where c.id = collection_id and (c.user_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.client_collections c
    where c.id = collection_id and (c.user_id = auth.uid() or public.is_admin())
  )
);

commit;
