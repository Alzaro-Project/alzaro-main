-- ============================================================
-- Accountant portal: missing GarageOps read policies
-- Adds accountant SELECT access to the three tables that were
-- skipped: services, labour_rates, part_batches.
-- Pattern copied from the existing acct_r_g_* policies
-- (e.g. acct_r_g_parts / acct_r_g_jobs).
-- Idempotent: safe to run more than once.
-- ============================================================

-- Services (shown under the Items permission; service lines also
-- appear on invoices and in reports)
drop policy if exists acct_r_g_services on public.services;
create policy acct_r_g_services on public.services
  for select using (
    accountant_can_acct(account_id, 'garageops'::text,
      array['items'::text, 'invoices'::text, 'reports'::text])
  );

-- Labour rates (shown under Items; used on invoices and in reports)
drop policy if exists acct_r_g_labour_rates on public.labour_rates;
create policy acct_r_g_labour_rates on public.labour_rates
  for select using (
    accountant_can_acct(account_id, 'garageops'::text,
      array['items'::text, 'invoices'::text, 'reports'::text])
  );

-- Part batches (purchase history; same permission set as acct_r_g_parts)
drop policy if exists acct_r_g_part_batches on public.part_batches;
create policy acct_r_g_part_batches on public.part_batches
  for select using (
    accountant_can_acct(account_id, 'garageops'::text,
      array['items'::text, 'purchases'::text, 'reports'::text])
  );
