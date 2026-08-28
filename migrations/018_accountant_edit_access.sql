-- ============================================================
-- 018: Accountant edit access (TyreOps first)
--
-- Adds an owner-controlled "can_edit" flag to accountant_links
-- (default OFF — no existing accountant gains write access),
-- a helper mirroring accountant_can_acct but stricter, and
-- UPDATE policies on invoices + invoice_lines for TyreOps.
--
-- Stricter than read access on purpose:
--   - link must be 'active' (an invited-but-not-accepted
--     accountant can read once accepted, but never write)
--   - can_edit must be explicitly true
-- Idempotent: safe to run more than once.
-- ============================================================

-- 1) owner-controlled flag, off by default
alter table public.accountant_links
  add column if not exists can_edit boolean not null default false;

-- 2) helper: may this accountant WRITE to this account's data?
create or replace function public.accountant_can_edit_acct(p_account uuid, p_product text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.product_members pm
    join public.accountant_links l
      on l.client_id = pm.user_id and l.product = pm.product
    where pm.id = p_account
      and pm.product = p_product
      and l.accountant_user_id = auth.uid()
      and l.status = 'active'
      and l.can_edit = true
      and pm.status in ('trial', 'active')
  );
$function$;

-- 3) UPDATE policies (TyreOps). USING gates which rows can be
-- targeted; WITH CHECK uses the same expression so the row can't
-- be moved to another account/product by the update.
drop policy if exists acct_w_tyre_invoices on public.invoices;
create policy acct_w_tyre_invoices on public.invoices
  for update
  using (accountant_can_edit_acct(account_id, 'tyreops'::text))
  with check (accountant_can_edit_acct(account_id, 'tyreops'::text));

drop policy if exists acct_w_tyre_invoice_lines on public.invoice_lines;
create policy acct_w_tyre_invoice_lines on public.invoice_lines
  for update
  using (accountant_can_edit_acct(account_id, 'tyreops'::text))
  with check (accountant_can_edit_acct(account_id, 'tyreops'::text));
