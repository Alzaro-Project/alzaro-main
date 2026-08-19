-- =============================================================================
-- 013_garage_staff.sql
-- Multi-user staff for the garage-family verticals. TyreOps and GarageOps
-- share their core tables (customers, invoices, skus, batches, used_tyres,
-- invoice_lines), all scoped by account_id -> product_members.id — so ONE
-- staff table with a product column serves both. This migration wires
-- TyreOps fully and covers the SHARED tables for GarageOps in advance;
-- GarageOps' own tables (jobs, vehicles, parts…) come in its own migration.
--
-- Run BEFORE the code deploy (inert until code arrives; app fails open).
-- Additive; the REVOKE block is column privileges only.
-- =============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Staff register (shared, product-scoped)
-- ----------------------------------------------------------------------------
create table if not exists public.garage_staff (
  id                 uuid primary key default gen_random_uuid(),
  product            text not null check (product in ('tyreops', 'garageops')),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  staff_user_id      uuid references auth.users(id) on delete cascade,
  staff_email        text not null,
  -- TyreOps keys: dashboard, invoices, inventory, purchases, customers,
  --               followups, vat
  -- GarageOps keys (later): jobs, vehicles, parts, … — same jsonb, different keys.
  permissions        jsonb not null default '{}'::jsonb,
  status             text not null default 'invited'
                     check (status in ('invited', 'active')),
  created_via_invite boolean not null default false,
  created_at         timestamptz not null default now(),
  constraint garage_staff_no_self check (owner_id <> staff_user_id),
  constraint garage_staff_owner_email_uniq unique (product, owner_id, staff_email)
);

create index if not exists garage_staff_staff_idx
  on public.garage_staff (staff_user_id) where staff_user_id is not null;

alter table public.garage_staff enable row level security;

drop policy if exists garage_staff_owner_select on public.garage_staff;
create policy garage_staff_owner_select on public.garage_staff
  for select using (owner_id = auth.uid());
drop policy if exists garage_staff_owner_update on public.garage_staff;
create policy garage_staff_owner_update on public.garage_staff
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists garage_staff_owner_delete on public.garage_staff;
create policy garage_staff_owner_delete on public.garage_staff
  for delete using (owner_id = auth.uid());
drop policy if exists garage_staff_self_select on public.garage_staff;
create policy garage_staff_self_select on public.garage_staff
  for select using (staff_user_id = auth.uid());
-- No INSERT policy: rows are created only by /api/staff.js (service role),
-- which holds the tier check and seat limits. No staff UPDATE either.

-- ----------------------------------------------------------------------------
-- 2. Helpers
--    Children tables are account-scoped, so the workhorse takes an ACCOUNT id
--    and resolves the owner through product_members. Tier gate (silver/gold)
--    lives inside, matching products' seat model.
-- ----------------------------------------------------------------------------
create or replace function public.garage_staff_can_acct(p_account uuid, p_perms text[])
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.product_members pm
    join public.garage_staff s
      on s.owner_id = pm.user_id and s.product = pm.product
    where pm.id = p_account
      and pm.product in ('tyreops', 'garageops')
      and s.staff_user_id = auth.uid()
      and s.status in ('invited', 'active')
      and pm.tier in ('silver', 'gold')
      and pm.status in ('trial', 'active')
      and exists (
        select 1 from unnest(p_perms) k
        where coalesce(s.permissions ->> k, 'false') = 'true'
      )
  );
$$;

-- Row reads on user-scoped tables (product_members, product_settings).
create or replace function public.garage_is_staff_of_user(p_user uuid, p_product text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.garage_staff s
    join public.product_members pm
      on pm.user_id = s.owner_id and pm.product = s.product
    where s.staff_user_id = auth.uid()
      and s.owner_id = p_user
      and s.product = p_product
      and s.status in ('invited', 'active')
      and pm.tier in ('silver', 'gold')
      and pm.status in ('trial', 'active')
  );
$$;

revoke all on function public.garage_staff_can_acct(uuid, text[]) from public;
revoke all on function public.garage_is_staff_of_user(uuid, text) from public;
grant execute on function public.garage_staff_can_acct(uuid, text[]) to authenticated;
grant execute on function public.garage_is_staff_of_user(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. User-scoped rows: owner's membership (tier gating, the "garage" object)
--    and product_settings (business details). Read-only for staff.
-- ----------------------------------------------------------------------------
drop policy if exists garage_staff_r_member on public.product_members;
create policy garage_staff_r_member on public.product_members for select
  using (product in ('tyreops', 'garageops') and garage_is_staff_of_user(user_id, product));

drop policy if exists garage_staff_r_psettings on public.product_settings;
create policy garage_staff_r_psettings on public.product_settings for select
  using (product in ('tyreops', 'garageops') and garage_is_staff_of_user(user_id, product));

-- ----------------------------------------------------------------------------
-- 4. Shared account-scoped tables. Permission arrays include BOTH products'
--    relevant keys — a staff member simply won't hold keys their product's UI
--    never grants, so the extra names are inert.
-- ----------------------------------------------------------------------------

-- customers -------------------------------------------------------------------
drop policy if exists garage_staff_r_customers on public.customers;
create policy garage_staff_r_customers on public.customers for select
  using (garage_staff_can_acct(account_id, array['customers','invoices','followups','dashboard','jobs','vehicles']));
drop policy if exists garage_staff_i_customers on public.customers;
create policy garage_staff_i_customers on public.customers for insert
  with check (garage_staff_can_acct(account_id, array['customers','jobs']));
drop policy if exists garage_staff_u_customers on public.customers;
create policy garage_staff_u_customers on public.customers for update
  using (garage_staff_can_acct(account_id, array['customers','followups','jobs']))
  with check (garage_staff_can_acct(account_id, array['customers','followups','jobs']));
drop policy if exists garage_staff_d_customers on public.customers;
create policy garage_staff_d_customers on public.customers for delete
  using (garage_staff_can_acct(account_id, array['customers']));

-- invoices --------------------------------------------------------------------
drop policy if exists garage_staff_r_invoices on public.invoices;
create policy garage_staff_r_invoices on public.invoices for select
  using (garage_staff_can_acct(account_id, array['invoices','dashboard','vat','customers','jobs']));
drop policy if exists garage_staff_i_invoices on public.invoices;
create policy garage_staff_i_invoices on public.invoices for insert
  with check (garage_staff_can_acct(account_id, array['invoices','jobs']));
drop policy if exists garage_staff_u_invoices on public.invoices;
create policy garage_staff_u_invoices on public.invoices for update
  using (garage_staff_can_acct(account_id, array['invoices','jobs']))
  with check (garage_staff_can_acct(account_id, array['invoices','jobs']));
drop policy if exists garage_staff_d_invoices on public.invoices;
create policy garage_staff_d_invoices on public.invoices for delete
  using (garage_staff_can_acct(account_id, array['invoices']));

-- invoice_lines ---------------------------------------------------------------
drop policy if exists garage_staff_r_invoice_lines on public.invoice_lines;
create policy garage_staff_r_invoice_lines on public.invoice_lines for select
  using (garage_staff_can_acct(account_id, array['invoices','dashboard','vat','jobs']));
drop policy if exists garage_staff_i_invoice_lines on public.invoice_lines;
create policy garage_staff_i_invoice_lines on public.invoice_lines for insert
  with check (garage_staff_can_acct(account_id, array['invoices','jobs']));
drop policy if exists garage_staff_u_invoice_lines on public.invoice_lines;
create policy garage_staff_u_invoice_lines on public.invoice_lines for update
  using (garage_staff_can_acct(account_id, array['invoices','jobs']))
  with check (garage_staff_can_acct(account_id, array['invoices','jobs']));
drop policy if exists garage_staff_d_invoice_lines on public.invoice_lines;
create policy garage_staff_d_invoice_lines on public.invoice_lines for delete
  using (garage_staff_can_acct(account_id, array['invoices']));

-- skus ------------------------------------------------------------------------
drop policy if exists garage_staff_r_skus on public.skus;
create policy garage_staff_r_skus on public.skus for select
  using (garage_staff_can_acct(account_id, array['inventory','purchases','invoices','dashboard','jobs','parts']));
drop policy if exists garage_staff_i_skus on public.skus;
create policy garage_staff_i_skus on public.skus for insert
  with check (garage_staff_can_acct(account_id, array['inventory','purchases']));
drop policy if exists garage_staff_u_skus on public.skus;
create policy garage_staff_u_skus on public.skus for update
  using (garage_staff_can_acct(account_id, array['inventory','purchases','invoices']))
  with check (garage_staff_can_acct(account_id, array['inventory','purchases','invoices']));
drop policy if exists garage_staff_d_skus on public.skus;
create policy garage_staff_d_skus on public.skus for delete
  using (garage_staff_can_acct(account_id, array['inventory']));

-- batches ---------------------------------------------------------------------
drop policy if exists garage_staff_r_batches on public.batches;
create policy garage_staff_r_batches on public.batches for select
  using (garage_staff_can_acct(account_id, array['inventory','purchases','invoices','dashboard','vat']));
drop policy if exists garage_staff_i_batches on public.batches;
create policy garage_staff_i_batches on public.batches for insert
  with check (garage_staff_can_acct(account_id, array['inventory','purchases']));
drop policy if exists garage_staff_u_batches on public.batches;
create policy garage_staff_u_batches on public.batches for update
  using (garage_staff_can_acct(account_id, array['inventory','purchases','invoices']))
  with check (garage_staff_can_acct(account_id, array['inventory','purchases','invoices']));
drop policy if exists garage_staff_d_batches on public.batches;
create policy garage_staff_d_batches on public.batches for delete
  using (garage_staff_can_acct(account_id, array['inventory','purchases']));

-- used_tyres ------------------------------------------------------------------
drop policy if exists garage_staff_r_used_tyres on public.used_tyres;
create policy garage_staff_r_used_tyres on public.used_tyres for select
  using (garage_staff_can_acct(account_id, array['inventory','invoices','dashboard']));
drop policy if exists garage_staff_i_used_tyres on public.used_tyres;
create policy garage_staff_i_used_tyres on public.used_tyres for insert
  with check (garage_staff_can_acct(account_id, array['inventory']));
drop policy if exists garage_staff_u_used_tyres on public.used_tyres;
create policy garage_staff_u_used_tyres on public.used_tyres for update
  using (garage_staff_can_acct(account_id, array['inventory','invoices']))
  with check (garage_staff_can_acct(account_id, array['inventory','invoices']));
drop policy if exists garage_staff_d_used_tyres on public.used_tyres;
create policy garage_staff_d_used_tyres on public.used_tyres for delete
  using (garage_staff_can_acct(account_id, array['inventory']));

-- ----------------------------------------------------------------------------
-- 5. Lock SMTP secret columns on product_settings away from client reads
--    (privilege change only; conditional on the columns existing).
-- ----------------------------------------------------------------------------
do $$
declare col text;
begin
  foreach col in array array['smtp_pass', 'smtp_pass_enc', 'smtp_password'] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'product_settings' and column_name = col
    ) then
      execute format('revoke select (%I) on public.product_settings from authenticated', col);
    end if;
  end loop;
end $$;
