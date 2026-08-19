-- =============================================================================
-- 014_garageops_staff.sql
-- GarageOps multi-user. The register (garage_staff), helper functions and
-- shared-table policies shipped in 013 — this adds GarageOps' OWN tables
-- plus supplemental read policies on the shared tables so GarageOps' nav
-- permission keys (database, items, calendar, reports…) grant what its
-- screens actually need. Policies are permissive, so these simply OR with
-- 013's — nothing there changes.
--
-- Run BEFORE the code deploy. Additive only.
--
-- GarageOps permission keys: dashboard, invoices, customers, items,
-- database, purchases, calendar, reports. Settings never grantable.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Supplemental grants on the SHARED tables for GarageOps' keys
-- ----------------------------------------------------------------------------
drop policy if exists garage_staff_r2_customers on public.customers;
create policy garage_staff_r2_customers on public.customers for select
  using (garage_staff_can_acct(account_id, array['database','calendar','reports']));
drop policy if exists garage_staff_w2_customers on public.customers;
create policy garage_staff_w2_customers on public.customers for insert
  with check (garage_staff_can_acct(account_id, array['database','calendar']));
drop policy if exists garage_staff_u2_customers on public.customers;
create policy garage_staff_u2_customers on public.customers for update
  using (garage_staff_can_acct(account_id, array['database','calendar']))
  with check (garage_staff_can_acct(account_id, array['database','calendar']));

drop policy if exists garage_staff_r2_invoices on public.invoices;
create policy garage_staff_r2_invoices on public.invoices for select
  using (garage_staff_can_acct(account_id, array['reports','database','calendar']));

drop policy if exists garage_staff_r2_invoice_lines on public.invoice_lines;
create policy garage_staff_r2_invoice_lines on public.invoice_lines for select
  using (garage_staff_can_acct(account_id, array['reports','database']));

-- ----------------------------------------------------------------------------
-- 2. GarageOps' own tables (all account_id-scoped)
-- ----------------------------------------------------------------------------

-- jobs + job_lines ------------------------------------------------------------
drop policy if exists garage_staff_r_jobs on public.jobs;
create policy garage_staff_r_jobs on public.jobs for select
  using (garage_staff_can_acct(account_id, array['database','invoices','dashboard','calendar','reports']));
drop policy if exists garage_staff_i_jobs on public.jobs;
create policy garage_staff_i_jobs on public.jobs for insert
  with check (garage_staff_can_acct(account_id, array['database','invoices','calendar']));
drop policy if exists garage_staff_u_jobs on public.jobs;
create policy garage_staff_u_jobs on public.jobs for update
  using (garage_staff_can_acct(account_id, array['database','invoices','calendar']))
  with check (garage_staff_can_acct(account_id, array['database','invoices','calendar']));
drop policy if exists garage_staff_d_jobs on public.jobs;
create policy garage_staff_d_jobs on public.jobs for delete
  using (garage_staff_can_acct(account_id, array['database','invoices']));

drop policy if exists garage_staff_r_job_lines on public.job_lines;
create policy garage_staff_r_job_lines on public.job_lines for select
  using (garage_staff_can_acct(account_id, array['database','invoices','dashboard','calendar','reports']));
drop policy if exists garage_staff_i_job_lines on public.job_lines;
create policy garage_staff_i_job_lines on public.job_lines for insert
  with check (garage_staff_can_acct(account_id, array['database','invoices','calendar']));
drop policy if exists garage_staff_u_job_lines on public.job_lines;
create policy garage_staff_u_job_lines on public.job_lines for update
  using (garage_staff_can_acct(account_id, array['database','invoices','calendar']))
  with check (garage_staff_can_acct(account_id, array['database','invoices','calendar']));
drop policy if exists garage_staff_d_job_lines on public.job_lines;
create policy garage_staff_d_job_lines on public.job_lines for delete
  using (garage_staff_can_acct(account_id, array['database','invoices']));

-- vehicles --------------------------------------------------------------------
drop policy if exists garage_staff_r_vehicles on public.vehicles;
create policy garage_staff_r_vehicles on public.vehicles for select
  using (garage_staff_can_acct(account_id, array['database','customers','invoices','calendar','dashboard','reports']));
drop policy if exists garage_staff_i_vehicles on public.vehicles;
create policy garage_staff_i_vehicles on public.vehicles for insert
  with check (garage_staff_can_acct(account_id, array['database','customers','calendar']));
drop policy if exists garage_staff_u_vehicles on public.vehicles;
create policy garage_staff_u_vehicles on public.vehicles for update
  using (garage_staff_can_acct(account_id, array['database','customers','calendar']))
  with check (garage_staff_can_acct(account_id, array['database','customers','calendar']));
drop policy if exists garage_staff_d_vehicles on public.vehicles;
create policy garage_staff_d_vehicles on public.vehicles for delete
  using (garage_staff_can_acct(account_id, array['database']));

-- parts + part_batches --------------------------------------------------------
drop policy if exists garage_staff_r_parts on public.parts;
create policy garage_staff_r_parts on public.parts for select
  using (garage_staff_can_acct(account_id, array['items','purchases','invoices','dashboard','database']));
drop policy if exists garage_staff_i_parts on public.parts;
create policy garage_staff_i_parts on public.parts for insert
  with check (garage_staff_can_acct(account_id, array['items','purchases']));
drop policy if exists garage_staff_u_parts on public.parts;
create policy garage_staff_u_parts on public.parts for update
  using (garage_staff_can_acct(account_id, array['items','purchases','invoices']))
  with check (garage_staff_can_acct(account_id, array['items','purchases','invoices']));
drop policy if exists garage_staff_d_parts on public.parts;
create policy garage_staff_d_parts on public.parts for delete
  using (garage_staff_can_acct(account_id, array['items']));

drop policy if exists garage_staff_r_part_batches on public.part_batches;
create policy garage_staff_r_part_batches on public.part_batches for select
  using (garage_staff_can_acct(account_id, array['items','purchases','invoices','dashboard']));
drop policy if exists garage_staff_i_part_batches on public.part_batches;
create policy garage_staff_i_part_batches on public.part_batches for insert
  with check (garage_staff_can_acct(account_id, array['items','purchases']));
drop policy if exists garage_staff_u_part_batches on public.part_batches;
create policy garage_staff_u_part_batches on public.part_batches for update
  using (garage_staff_can_acct(account_id, array['items','purchases','invoices']))
  with check (garage_staff_can_acct(account_id, array['items','purchases','invoices']));
drop policy if exists garage_staff_d_part_batches on public.part_batches;
create policy garage_staff_d_part_batches on public.part_batches for delete
  using (garage_staff_can_acct(account_id, array['items','purchases']));

-- labour_rates + services -----------------------------------------------------
drop policy if exists garage_staff_r_labour_rates on public.labour_rates;
create policy garage_staff_r_labour_rates on public.labour_rates for select
  using (garage_staff_can_acct(account_id, array['items','invoices','calendar','database']));
drop policy if exists garage_staff_i_labour_rates on public.labour_rates;
create policy garage_staff_i_labour_rates on public.labour_rates for insert
  with check (garage_staff_can_acct(account_id, array['items']));
drop policy if exists garage_staff_u_labour_rates on public.labour_rates;
create policy garage_staff_u_labour_rates on public.labour_rates for update
  using (garage_staff_can_acct(account_id, array['items']))
  with check (garage_staff_can_acct(account_id, array['items']));
drop policy if exists garage_staff_d_labour_rates on public.labour_rates;
create policy garage_staff_d_labour_rates on public.labour_rates for delete
  using (garage_staff_can_acct(account_id, array['items']));

drop policy if exists garage_staff_r_services on public.services;
create policy garage_staff_r_services on public.services for select
  using (garage_staff_can_acct(account_id, array['items','invoices','calendar','database']));
drop policy if exists garage_staff_i_services on public.services;
create policy garage_staff_i_services on public.services for insert
  with check (garage_staff_can_acct(account_id, array['items']));
drop policy if exists garage_staff_u_services on public.services;
create policy garage_staff_u_services on public.services for update
  using (garage_staff_can_acct(account_id, array['items']))
  with check (garage_staff_can_acct(account_id, array['items']));
drop policy if exists garage_staff_d_services on public.services;
create policy garage_staff_d_services on public.services for delete
  using (garage_staff_can_acct(account_id, array['items']));

-- mot_reminders ---------------------------------------------------------------
drop policy if exists garage_staff_r_mot on public.mot_reminders;
create policy garage_staff_r_mot on public.mot_reminders for select
  using (garage_staff_can_acct(account_id, array['database','calendar','dashboard','customers']));
drop policy if exists garage_staff_i_mot on public.mot_reminders;
create policy garage_staff_i_mot on public.mot_reminders for insert
  with check (garage_staff_can_acct(account_id, array['database','calendar']));
drop policy if exists garage_staff_u_mot on public.mot_reminders;
create policy garage_staff_u_mot on public.mot_reminders for update
  using (garage_staff_can_acct(account_id, array['database','calendar']))
  with check (garage_staff_can_acct(account_id, array['database','calendar']));
drop policy if exists garage_staff_d_mot on public.mot_reminders;
create policy garage_staff_d_mot on public.mot_reminders for delete
  using (garage_staff_can_acct(account_id, array['database','calendar']));

-- bookings --------------------------------------------------------------------
drop policy if exists garage_staff_r_bookings on public.bookings;
create policy garage_staff_r_bookings on public.bookings for select
  using (garage_staff_can_acct(account_id, array['calendar','dashboard','database']));
drop policy if exists garage_staff_i_bookings on public.bookings;
create policy garage_staff_i_bookings on public.bookings for insert
  with check (garage_staff_can_acct(account_id, array['calendar']));
drop policy if exists garage_staff_u_bookings on public.bookings;
create policy garage_staff_u_bookings on public.bookings for update
  using (garage_staff_can_acct(account_id, array['calendar']))
  with check (garage_staff_can_acct(account_id, array['calendar']));
drop policy if exists garage_staff_d_bookings on public.bookings;
create policy garage_staff_d_bookings on public.bookings for delete
  using (garage_staff_can_acct(account_id, array['calendar']));

-- purchases -------------------------------------------------------------------
drop policy if exists garage_staff_r_purchases on public.purchases;
create policy garage_staff_r_purchases on public.purchases for select
  using (garage_staff_can_acct(account_id, array['purchases','dashboard','reports','invoices','database']));
drop policy if exists garage_staff_i_purchases on public.purchases;
create policy garage_staff_i_purchases on public.purchases for insert
  with check (garage_staff_can_acct(account_id, array['purchases']));
drop policy if exists garage_staff_u_purchases on public.purchases;
create policy garage_staff_u_purchases on public.purchases for update
  using (garage_staff_can_acct(account_id, array['purchases','invoices']))
  with check (garage_staff_can_acct(account_id, array['purchases','invoices']));
drop policy if exists garage_staff_d_purchases on public.purchases;
create policy garage_staff_d_purchases on public.purchases for delete
  using (garage_staff_can_acct(account_id, array['purchases']));
