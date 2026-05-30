-- ==================================================================
-- ALZARO OPS — Shared schema changes for multi-product portals
-- Run this in the Supabase SQL editor (project: cxsaeftacozyphuejuxo)
-- ==================================================================

-- 1) Add a `product` column to the shared tenants table.
--    Existing TyreOps rows are backfilled to 'tyreops'.
alter table garages add column if not exists product text not null default 'tyreops';

-- 2) Make sure each tenant row links to its auth user.
alter table garages add column if not exists user_id uuid references auth.users(id);

-- 3) Helpful columns the portals expect (no-ops if they already exist).
alter table garages add column if not exists status text default 'trial';      -- active | trial | suspended
alter table garages add column if not exists tier text default 'starter';
alter table garages add column if not exists trial_ends timestamptz;
alter table garages add column if not exists email text;
alter table garages add column if not exists phone text;
alter table garages add column if not exists address text;
alter table garages add column if not exists created_at timestamptz default now();

-- 4) Platform admins table (drives checkIsAdmin).
--    `product` = a specific product id, or 'all' for an owner across everything.
create table if not exists platform_admins (
  email text primary key,
  product text not null default 'all',
  created_at timestamptz default now()
);

-- Add yourself as the owner-admin for every product:
-- insert into platform_admins (email, product) values ('you@alzaro.co.uk', 'all');

-- 5) Index for the per-product tenant queries the admin panel runs.
create index if not exists idx_garages_product on garages (product);
create index if not exists idx_garages_user on garages (user_id);

-- ------------------------------------------------------------------
-- NOTE on registration: the Login screen calls supabase.auth.signUp
-- with metadata { tenant_name, product }. To turn that into a row in
-- `garages`, add a trigger on auth.users (recommended) OR insert the
-- row from the app right after sign-up. A trigger keeps it server-side:
-- ------------------------------------------------------------------
-- create or replace function handle_new_tenant()
-- returns trigger language plpgsql security definer as $$
-- begin
--   insert into garages (user_id, name, email, product, status, tier, trial_ends, created_at)
--   values (
--     new.id,
--     coalesce(new.raw_user_meta_data->>'tenant_name', new.email),
--     new.email,
--     coalesce(new.raw_user_meta_data->>'product', 'serviceops'),
--     'trial', 'starter', now() + interval '14 days', now()
--   );
--   return new;
-- end; $$;
--
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute function handle_new_tenant();
