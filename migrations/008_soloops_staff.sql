-- =============================================================================
-- 008_soloops_staff.sql
-- SoloOps multi-user: Gold accounts get 2 staff seats. The owner picks which
-- sections the staff member can use; enforcement is HERE (RLS), the UI only
-- mirrors it.
--
-- REVIEW ONLY — run AFTER the code deploy (the app tolerates this table being
-- absent, so code-first keeps the no-downtime window).
--
-- Additive: CREATE TABLE/FUNCTION/POLICY only. The two REVOKEs at the bottom
-- are column *privilege* changes (no data touched) — see the comment there.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. The staff register: one row per (owner, staff member)
-- -----------------------------------------------------------------------------
create table if not exists public.soloops_staff (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users(id) on delete cascade,
  staff_user_id  uuid references auth.users(id) on delete cascade,
  staff_email    text not null,
  -- { "dashboard": true, "income": true, "items": false, "expenses": false,
  --   "receipts": false, "reports": false }  — keys match the app's NAV.
  permissions    jsonb not null default '{}'::jsonb,
  -- invited = account created & emailed, hasn't necessarily logged in yet.
  -- Both invited and active grant access; revoke = delete the row.
  status         text not null default 'invited'
                 check (status in ('invited', 'active')),
  -- True when the invite created this auth account (vs. linking an email that
  -- already had an Alzaro login). Gates the owner's set-password power: you
  -- may reset a password only on an account you created — never take over a
  -- login the person owned before joining your workspace.
  created_via_invite boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint soloops_staff_no_self check (owner_id <> staff_user_id),
  constraint soloops_staff_owner_email_uniq unique (owner_id, staff_email)
);

create index if not exists soloops_staff_staff_idx
  on public.soloops_staff (staff_user_id) where staff_user_id is not null;

alter table public.soloops_staff enable row level security;

-- Owner manages their own staff rows. INSERT deliberately has NO policy:
-- rows are created only by /api/staff.js (service role), which is where the
-- Gold check and the seat limit live.
drop policy if exists soloops_staff_owner_select on public.soloops_staff;
create policy soloops_staff_owner_select on public.soloops_staff
  for select using (owner_id = auth.uid());
drop policy if exists soloops_staff_owner_update on public.soloops_staff;
create policy soloops_staff_owner_update on public.soloops_staff
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists soloops_staff_owner_delete on public.soloops_staff;
create policy soloops_staff_owner_delete on public.soloops_staff
  for delete using (owner_id = auth.uid());

-- Staff may see their own mapping (the app reads it at boot to learn who
-- their owner is and what they're allowed). No staff UPDATE policy — that
-- would let staff raise their own permissions.
drop policy if exists soloops_staff_self_select on public.soloops_staff;
create policy soloops_staff_self_select on public.soloops_staff
  for select using (staff_user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 2. Helpers used by every staff policy
--    Gold gate is INSIDE the helper: the moment the owner stops being a Gold
--    (trial/active) member, every staff grant in the product dies at once.
-- -----------------------------------------------------------------------------
create or replace function public.soloops_is_staff(p_owner uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.soloops_staff s
    join public.product_members pm
      on pm.user_id = s.owner_id and pm.product = 'soloops'
    where s.staff_user_id = auth.uid()
      and s.owner_id = p_owner
      and s.status in ('invited', 'active')
      and pm.tier = 'gold'
      and pm.status in ('trial', 'active')
  );
$$;

create or replace function public.soloops_staff_can(p_owner uuid, p_perms text[])
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.soloops_staff s
    join public.product_members pm
      on pm.user_id = s.owner_id and pm.product = 'soloops'
    where s.staff_user_id = auth.uid()
      and s.owner_id = p_owner
      and s.status in ('invited', 'active')
      and pm.tier = 'gold'
      and pm.status in ('trial', 'active')
      and exists (
        select 1 from unnest(p_perms) k
        where coalesce(s.permissions ->> k, 'false') = 'true'
      )
  );
$$;

revoke all on function public.soloops_is_staff(uuid) from public;
revoke all on function public.soloops_staff_can(uuid, text[]) from public;
grant execute on function public.soloops_is_staff(uuid) to authenticated;
grant execute on function public.soloops_staff_can(uuid, text[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Staff grants on the data tables (additive policies; the owner's own
--    policies are untouched — permissive policies OR together).
--    Read access is wider than write: e.g. the reports permission can SEE
--    invoices and expenses but change nothing.
-- -----------------------------------------------------------------------------

-- invoices --------------------------------------------------------------------
drop policy if exists soloops_staff_r_invoices on public.soloops_invoices;
create policy soloops_staff_r_invoices on public.soloops_invoices for select
  using (soloops_staff_can(user_id, array['income','dashboard','reports']));
drop policy if exists soloops_staff_i_invoices on public.soloops_invoices;
create policy soloops_staff_i_invoices on public.soloops_invoices for insert
  with check (soloops_staff_can(user_id, array['income']));
drop policy if exists soloops_staff_u_invoices on public.soloops_invoices;
create policy soloops_staff_u_invoices on public.soloops_invoices for update
  using (soloops_staff_can(user_id, array['income']))
  with check (soloops_staff_can(user_id, array['income']));
drop policy if exists soloops_staff_d_invoices on public.soloops_invoices;
create policy soloops_staff_d_invoices on public.soloops_invoices for delete
  using (soloops_staff_can(user_id, array['income']));

-- invoice line items ----------------------------------------------------------
drop policy if exists soloops_staff_r_invoice_lines on public.soloops_invoice_lines;
create policy soloops_staff_r_invoice_lines on public.soloops_invoice_lines for select
  using (soloops_staff_can(user_id, array['income','dashboard','reports']));
drop policy if exists soloops_staff_i_invoice_lines on public.soloops_invoice_lines;
create policy soloops_staff_i_invoice_lines on public.soloops_invoice_lines for insert
  with check (soloops_staff_can(user_id, array['income']));
drop policy if exists soloops_staff_u_invoice_lines on public.soloops_invoice_lines;
create policy soloops_staff_u_invoice_lines on public.soloops_invoice_lines for update
  using (soloops_staff_can(user_id, array['income']))
  with check (soloops_staff_can(user_id, array['income']));
drop policy if exists soloops_staff_d_invoice_lines on public.soloops_invoice_lines;
create policy soloops_staff_d_invoice_lines on public.soloops_invoice_lines for delete
  using (soloops_staff_can(user_id, array['income']));

-- expenses --------------------------------------------------------------------
-- receipts may UPDATE an expense (the has_receipt/receipt_name flags set when
-- a receipt file is matched) but can't create or delete expenses.
drop policy if exists soloops_staff_r_expenses on public.soloops_expenses;
create policy soloops_staff_r_expenses on public.soloops_expenses for select
  using (soloops_staff_can(user_id, array['expenses','receipts','dashboard','reports']));
drop policy if exists soloops_staff_i_expenses on public.soloops_expenses;
create policy soloops_staff_i_expenses on public.soloops_expenses for insert
  with check (soloops_staff_can(user_id, array['expenses']));
drop policy if exists soloops_staff_u_expenses on public.soloops_expenses;
create policy soloops_staff_u_expenses on public.soloops_expenses for update
  using (soloops_staff_can(user_id, array['expenses','receipts']))
  with check (soloops_staff_can(user_id, array['expenses','receipts']));
drop policy if exists soloops_staff_d_expenses on public.soloops_expenses;
create policy soloops_staff_d_expenses on public.soloops_expenses for delete
  using (soloops_staff_can(user_id, array['expenses']));

-- mileage ---------------------------------------------------------------------
drop policy if exists soloops_staff_r_mileage on public.soloops_mileage;
create policy soloops_staff_r_mileage on public.soloops_mileage for select
  using (soloops_staff_can(user_id, array['expenses','reports','dashboard']));
drop policy if exists soloops_staff_i_mileage on public.soloops_mileage;
create policy soloops_staff_i_mileage on public.soloops_mileage for insert
  with check (soloops_staff_can(user_id, array['expenses','reports']));
drop policy if exists soloops_staff_u_mileage on public.soloops_mileage;
create policy soloops_staff_u_mileage on public.soloops_mileage for update
  using (soloops_staff_can(user_id, array['expenses','reports']))
  with check (soloops_staff_can(user_id, array['expenses','reports']));
drop policy if exists soloops_staff_d_mileage on public.soloops_mileage;
create policy soloops_staff_d_mileage on public.soloops_mileage for delete
  using (soloops_staff_can(user_id, array['expenses','reports']));

-- clients ---------------------------------------------------------------------
-- income/expenses can create clients too: saving an invoice or expense for a
-- new name auto-creates the client record (ensureClient).
drop policy if exists soloops_staff_r_clients on public.soloops_clients;
create policy soloops_staff_r_clients on public.soloops_clients for select
  using (soloops_staff_can(user_id, array['items','income','expenses','dashboard','reports']));
drop policy if exists soloops_staff_i_clients on public.soloops_clients;
create policy soloops_staff_i_clients on public.soloops_clients for insert
  with check (soloops_staff_can(user_id, array['items','income','expenses']));
drop policy if exists soloops_staff_u_clients on public.soloops_clients;
create policy soloops_staff_u_clients on public.soloops_clients for update
  using (soloops_staff_can(user_id, array['items','income','expenses']))
  with check (soloops_staff_can(user_id, array['items','income','expenses']));
drop policy if exists soloops_staff_d_clients on public.soloops_clients;
create policy soloops_staff_d_clients on public.soloops_clients for delete
  using (soloops_staff_can(user_id, array['items']));

-- items -----------------------------------------------------------------------
drop policy if exists soloops_staff_r_items on public.soloops_items;
create policy soloops_staff_r_items on public.soloops_items for select
  using (soloops_staff_can(user_id, array['items','income','expenses']));
drop policy if exists soloops_staff_i_items on public.soloops_items;
create policy soloops_staff_i_items on public.soloops_items for insert
  with check (soloops_staff_can(user_id, array['items']));
drop policy if exists soloops_staff_u_items on public.soloops_items;
create policy soloops_staff_u_items on public.soloops_items for update
  using (soloops_staff_can(user_id, array['items']))
  with check (soloops_staff_can(user_id, array['items']));
drop policy if exists soloops_staff_d_items on public.soloops_items;
create policy soloops_staff_d_items on public.soloops_items for delete
  using (soloops_staff_can(user_id, array['items']));

-- auto-categorisation rules ---------------------------------------------------
drop policy if exists soloops_staff_r_rules on public.soloops_rules;
create policy soloops_staff_r_rules on public.soloops_rules for select
  using (soloops_staff_can(user_id, array['expenses']));
drop policy if exists soloops_staff_i_rules on public.soloops_rules;
create policy soloops_staff_i_rules on public.soloops_rules for insert
  with check (soloops_staff_can(user_id, array['expenses']));
drop policy if exists soloops_staff_u_rules on public.soloops_rules;
create policy soloops_staff_u_rules on public.soloops_rules for update
  using (soloops_staff_can(user_id, array['expenses']))
  with check (soloops_staff_can(user_id, array['expenses']));

-- documents (receipt files) ---------------------------------------------------
drop policy if exists soloops_staff_r_documents on public.soloops_documents;
create policy soloops_staff_r_documents on public.soloops_documents for select
  using (soloops_staff_can(user_id, array['receipts','expenses']));
drop policy if exists soloops_staff_i_documents on public.soloops_documents;
create policy soloops_staff_i_documents on public.soloops_documents for insert
  with check (soloops_staff_can(user_id, array['receipts','expenses']));
drop policy if exists soloops_staff_d_documents on public.soloops_documents;
create policy soloops_staff_d_documents on public.soloops_documents for delete
  using (soloops_staff_can(user_id, array['receipts','expenses']));

-- workspace identity (read-only for any staff of that owner) ------------------
drop policy if exists soloops_staff_r_access on public.soloops_access;
create policy soloops_staff_r_access on public.soloops_access for select
  using (soloops_is_staff(user_id));

-- Business settings, read-only: invoice previews/PDFs need the owner's
-- address, VAT and bank details. Write stays owner-only. The SMTP secret
-- columns are shut off below for everyone.
drop policy if exists soloops_staff_r_settings on public.soloops_settings;
create policy soloops_staff_r_settings on public.soloops_settings for select
  using (soloops_is_staff(user_id));

-- Owner's SoloOps membership row (tier/status/trial) — the app gates staff
-- pages on the OWNER's tier, and TrialGuard checks it too. Scoped to soloops
-- rows only; the other verticals' rows stay invisible.
drop policy if exists soloops_staff_r_member on public.product_members;
create policy soloops_staff_r_member on public.product_members for select
  using (product = 'soloops' and soloops_is_staff(user_id));

-- -----------------------------------------------------------------------------
-- 4. Storage: the soloops-files bucket. Paths are '<owner uuid>/…', so grant
--    staff access by the first path segment. Regex-guard before ::uuid so a
--    non-uuid folder name can't error the cast.
-- -----------------------------------------------------------------------------
drop policy if exists soloops_staff_storage_r on storage.objects;
create policy soloops_staff_storage_r on storage.objects for select
  using (
    bucket_id = 'soloops-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and soloops_staff_can(((storage.foldername(name))[1])::uuid,
                          array['receipts','expenses','income'])
  );
drop policy if exists soloops_staff_storage_i on storage.objects;
create policy soloops_staff_storage_i on storage.objects for insert
  with check (
    bucket_id = 'soloops-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and soloops_staff_can(((storage.foldername(name))[1])::uuid,
                          array['receipts','expenses'])
  );
drop policy if exists soloops_staff_storage_d on storage.objects;
create policy soloops_staff_storage_d on storage.objects for delete
  using (
    bucket_id = 'soloops-files'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and soloops_staff_can(((storage.foldername(name))[1])::uuid,
                          array['receipts','expenses'])
  );

-- -----------------------------------------------------------------------------
-- 5. Lock the SMTP secret columns away from ALL client-side reads.
--    NOT a data change: REVOKE here only removes column read *privilege* from
--    the authenticated role. Nothing client-side selects these columns (the
--    app reads an explicit column list; /api/send-email gets the password
--    server-side via the security-definer RPC) — this just makes that a
--    guarantee instead of a convention, which matters now that staff can
--    SELECT the settings row.
-- -----------------------------------------------------------------------------
revoke select (smtp_pass_enc) on public.soloops_settings from authenticated;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'soloops_settings'
      and column_name = 'smtp_pass'
  ) then
    execute 'revoke select (smtp_pass) on public.soloops_settings from authenticated';
  end if;
end $$;
