-- ============================================================================
-- 02_ensure_prop_rls_policies.sql   ⚠️ REVIEW BEFORE RUNNING — changes RLS
-- ============================================================================
-- DO NOT run this blindly. Run 01_audit_rls_policies.sql FIRST and read the
-- results. Only run this if the audit shows a prop_* table with RLS disabled
-- or a missing/too-broad policy. This script is written to be SAFE to re-run
-- (idempotent): it enables RLS and (re)creates a strict own-rows policy set so
-- each authenticated user can only read/insert/update/delete rows where
-- user_id = auth.uid().
--
-- ASSUMPTIONS (verify against your schema before running):
--   • Every prop_* table below has a `user_id uuid` column that stores the
--     owning auth user's id (the app inserts user_id: user.id on every row).
--   • You want plain per-user isolation (user_id = auth.uid()). If your model
--     is instead per-COMPANY with multiple users sharing data, STOP — these
--     policies would wrongly hide teammates' rows, and you need a company_id /
--     membership-based policy instead. (Today PropertyOps is 1 user per
--     account, so per-user is correct.)
--   • These policies do NOT depend on the x-product header. The prop_* tables
--     are PropertyOps-only, so user_id scoping alone gives tenant isolation.
--
-- If any assumption is wrong, tell me and I will adjust before you run it.
-- ============================================================================

do $$
declare
  t text;
  prop_tables text[] := array[
    'prop_properties',
    'prop_tenants',
    'prop_compliance',
    'prop_maintenance',
    'prop_payments',
    'prop_documents',
    'prop_settings'
  ];
begin
  foreach t in array prop_tables loop
    -- Skip tables that don't exist in this project (defensive).
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t
    ) then
      raise notice 'skipping % (table not found)', t;
      continue;
    end if;

    -- 1) Enable RLS.
    execute format('alter table public.%I enable row level security;', t);

    -- 2) Drop any prior copies of OUR policies so this script is re-runnable.
    --    (Only drops the four named below; leaves any other policies untouched.)
    execute format('drop policy if exists %I on public.%I;', t || '_own_select', t);
    execute format('drop policy if exists %I on public.%I;', t || '_own_insert', t);
    execute format('drop policy if exists %I on public.%I;', t || '_own_update', t);
    execute format('drop policy if exists %I on public.%I;', t || '_own_delete', t);

    -- 3) Create strict own-rows policies.
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = auth.uid());',
      t || '_own_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid());',
      t || '_own_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t || '_own_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = auth.uid());',
      t || '_own_delete', t);

    raise notice 'RLS ensured on %', t;
  end loop;
end $$;

-- Re-run 01_audit_rls_policies.sql afterwards to confirm the gap report (query 3)
-- comes back empty.
