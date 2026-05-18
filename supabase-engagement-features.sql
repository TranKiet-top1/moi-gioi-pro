create extension if not exists pgcrypto;

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
  share_slug text not null unique,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.client_collections(id) on delete cascade,
  listing_id uuid not null references public.premises(id) on delete cascade,
  sort_order int not null default 0,
  note_for_client text,
  created_at timestamptz not null default now(),
  unique(collection_id, listing_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text,
  type text not null default 'system',
  listing_id uuid references public.premises(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_saved_listings_user on public.saved_listings(user_id);
create index if not exists idx_saved_listings_listing on public.saved_listings(listing_id);
create index if not exists idx_client_collections_user on public.client_collections(user_id);
create index if not exists idx_client_collections_slug on public.client_collections(share_slug);
create index if not exists idx_collection_items_collection on public.client_collection_items(collection_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, is_read);

alter table public.saved_listings enable row level security;
alter table public.client_collections enable row level security;
alter table public.client_collection_items enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "users_manage_own_saved_listings" on public.saved_listings;
create policy "users_manage_own_saved_listings"
on public.saved_listings
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_manage_own_collections" on public.client_collections;
create policy "users_manage_own_collections"
on public.client_collections
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "public_read_public_collections" on public.client_collections;
create policy "public_read_public_collections"
on public.client_collections
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "users_manage_own_collection_items" on public.client_collection_items;
create policy "users_manage_own_collection_items"
on public.client_collection_items
for all
to authenticated
using (
  exists (
    select 1 from public.client_collections c
    where c.id = collection_id and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.client_collections c
    where c.id = collection_id and c.user_id = auth.uid()
  )
);

drop policy if exists "public_read_public_collection_items" on public.client_collection_items;
create policy "public_read_public_collection_items"
on public.client_collection_items
for select
to anon, authenticated
using (
  exists (
    select 1 from public.client_collections c
    where c.id = collection_id and c.is_public = true
  )
);

drop policy if exists "users_manage_own_notifications" on public.notifications;
create policy "users_manage_own_notifications"
on public.notifications
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
