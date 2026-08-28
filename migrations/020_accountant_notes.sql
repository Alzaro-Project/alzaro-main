-- ============================================================
-- 020: Accountant notes — "flag it for the client"
--
-- Lets an accountant leave correction requests / guidance for
-- their client (optionally tied to one invoice). The client
-- sees open notes in their app and marks them resolved.
-- Works regardless of the can_edit toggle — flagging is not
-- editing.
--
-- TyreOps/GarageOps shape (account_id scoped). Idempotent.
-- ============================================================

-- helper: is the caller an accountant actively linked to this
-- account (any permission level)? Like accountant_can_acct but
-- without requiring a specific section permission.
create or replace function public.accountant_is_linked_acct(p_account uuid, p_product text)
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
      and pm.status in ('trial', 'active')
  );
$function$;

create table if not exists public.accountant_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  product text not null,
  invoice_id text,                    -- optional: which invoice this is about
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_by uuid not null default auth.uid(),   -- the accountant
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.accountant_notes enable row level security;

-- accountant: create notes for linked clients, see/manage their own notes
drop policy if exists acct_notes_insert on public.accountant_notes;
create policy acct_notes_insert on public.accountant_notes
  for insert
  with check (
    created_by = auth.uid()
    and accountant_is_linked_acct(account_id, product)
  );

drop policy if exists acct_notes_select_accountant on public.accountant_notes;
create policy acct_notes_select_accountant on public.accountant_notes
  for select using (accountant_is_linked_acct(account_id, product));

drop policy if exists acct_notes_update_accountant on public.accountant_notes;
create policy acct_notes_update_accountant on public.accountant_notes
  for update
  using (created_by = auth.uid() and accountant_is_linked_acct(account_id, product))
  with check (created_by = auth.uid() and accountant_is_linked_acct(account_id, product));

drop policy if exists acct_notes_delete_accountant on public.accountant_notes;
create policy acct_notes_delete_accountant on public.accountant_notes
  for delete using (created_by = auth.uid() and accountant_is_linked_acct(account_id, product));

-- client (garage owner/staff): read + resolve notes on their own account
drop policy if exists acct_notes_select_client on public.accountant_notes;
create policy acct_notes_select_client on public.accountant_notes
  for select using (user_belongs_to_garage(account_id));

drop policy if exists acct_notes_update_client on public.accountant_notes;
create policy acct_notes_update_client on public.accountant_notes
  for update
  using (user_belongs_to_garage(account_id))
  with check (user_belongs_to_garage(account_id));

-- fast lookups
create index if not exists accountant_notes_account_idx
  on public.accountant_notes (account_id, product, status);
