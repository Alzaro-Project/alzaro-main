-- ============================================================================
-- SoloOps Row-Level Security — ownership only (idempotent)
-- ============================================================================
-- 001 enabled RLS on the SoloOps tables but shipped no policies, so with RLS on
-- and no policy the tables deny all access to the anon/authenticated roles
-- (invoice line items etc. are locked). This migration adds ownership policies
-- so a logged-in user can read/write ONLY their own rows.
--
-- SCOPE (per review decision):
--   * Ownership only: user_id = auth.uid() on every soloops_* table the
--     front-end touches. This matches the current client trust model and
--     restores access immediately.
--   * Tier/status enforcement (blocking basic/expired users from inserting
--     bronze+ rows by joining the shared product_members table) is DEFERRED —
--     it needs careful review against join_product + the Stripe webhook so it
--     can't lock out paying users. Not included here.
--
-- IDEMPOTENT: `enable row level security` is safe to re-run; each policy is
-- dropped-if-exists then recreated under a stable name, so re-running only
-- ever replaces this migration's own policies (it never touches policies you
-- created by another name).
--
-- CONFIRMED FROM CODE: every table below is written by the front-end with
-- user_id = the caller's auth id (session.user.id), so user_id = auth.uid()
-- is the correct owner test. The service-role key (webhook / server RPCs)
-- bypasses RLS and is unaffected.
--
-- REVIEW NOTES:
--   * soloops_access was NOT created/altered by 001. It's included here for a
--     consistent ownership model (it has user_id and is read/written by the
--     app). If it already has its own working policies you'd rather keep as the
--     sole control, remove it from the table list below before running.
--   * Storage: document files live in the 'soloops-files' storage bucket.
--     Bucket access is governed by storage.objects policies, NOT table RLS, and
--     is intentionally out of scope for this migration.
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'soloops_invoices',
    'soloops_invoice_lines',
    'soloops_expenses',
    'soloops_mileage',
    'soloops_clients',
    'soloops_rules',
    'soloops_documents',
    'soloops_settings',
    'soloops_access'
  ];
begin
  foreach t in array tables loop
    -- Enable RLS (no-op if already enabled).
    execute format('alter table public.%I enable row level security', t);

    -- Replace this migration's own ownership policy idempotently.
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format($p$
      create policy %I on public.%I
        for all
        to authenticated
        using (user_id = auth.uid())
        with check (user_id = auth.uid())
    $p$, t || '_owner', t);
  end loop;
end $$;

-- ============================================================================
-- DEFERRED (bug #7, part 2) — a later, separately reviewed migration:
--   * Tier/status enforcement: restrict INSERT on bronze+ tables (expenses,
--     documents, mileage, invoice_lines, …) to callers whose product_members
--     row for product='soloops' has an active status and a sufficient tier.
--   * Unique index on soloops_invoices (user_id, number) — the backend
--     equivalent of the client-side invoice-number uniqueness check.
-- These read the shared product_members table and can lock out legitimate
-- users if the tier/status logic is wrong, so they are intentionally excluded
-- from this ownership-only migration.
-- ============================================================================
