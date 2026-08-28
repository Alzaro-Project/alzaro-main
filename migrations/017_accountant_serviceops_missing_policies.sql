-- ============================================================
-- Accountant portal: missing ServiceOps read policies
-- Adds accountant SELECT access to the two tables that were
-- skipped: svc_properties and svc_bookings.
-- Pattern copied from the existing acct_r_svc_* policies
-- (e.g. acct_r_svc_customers). ServiceOps scopes by user_id.
-- Idempotent: safe to run more than once.
-- ============================================================

-- Properties/sites (shown alongside customers under the Customers permission)
drop policy if exists acct_r_svc_properties on public.svc_properties;
create policy acct_r_svc_properties on public.svc_properties
  for select using (
    accountant_can(user_id, 'serviceops'::text,
      array['customers'::text, 'invoicing'::text, 'reports'::text, 'dashboard'::text])
  );

-- Bookings (shown under the Diary permission)
drop policy if exists acct_r_svc_bookings on public.svc_bookings;
create policy acct_r_svc_bookings on public.svc_bookings
  for select using (
    accountant_can(user_id, 'serviceops'::text,
      array['diary'::text, 'dashboard'::text, 'reports'::text])
  );
