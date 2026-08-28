-- ============================================================
-- 019: Accountant corrections — purchases + customers (TyreOps)
--
-- Extends the "Allow invoice corrections" toggle (migration 018,
-- accountant_links.can_edit) to also cover purchase batches and
-- customer records. Same helper, same rules: link must be active
-- AND the client must have switched editing on. View-only
-- accountants are unaffected. Inventory, dashboard and VAT stay
-- read-only — they're computed/operational, not bookkeeping.
-- Idempotent: safe to run more than once.
-- ============================================================

drop policy if exists acct_w_tyre_batches on public.batches;
create policy acct_w_tyre_batches on public.batches
  for update
  using (accountant_can_edit_acct(account_id, 'tyreops'::text))
  with check (accountant_can_edit_acct(account_id, 'tyreops'::text));

drop policy if exists acct_w_tyre_customers on public.customers;
create policy acct_w_tyre_customers on public.customers
  for update
  using (accountant_can_edit_acct(account_id, 'tyreops'::text))
  with check (accountant_can_edit_acct(account_id, 'tyreops'::text));
