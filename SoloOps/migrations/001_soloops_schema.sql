-- ============================================================================
-- SoloOps schema migration (idempotent)
-- ============================================================================
-- Accumulated from the bug-sweep "Separate deliverables" list. Covers every
-- table/column/index the SoloOps front-end reads or writes that may not yet
-- exist in the live Supabase database.
--
-- SAFETY / REVIEW NOTES:
--   * There are NO tracked SQL files in the repo, so the exact live schema
--     could not be confirmed. Everything here is written to be idempotent
--     (CREATE TABLE / ADD COLUMN / CREATE INDEX ... IF NOT EXISTS) so it is
--     safe to run whether or not the objects already exist.
--   * Column NAMES are CONFIRMED from the application code (the payloads passed
--     to insert/update/upsert and the columns read back). Where that is the
--     case it is marked "confirmed".
--   * Column TYPES, primary keys, default values and the assumption that the
--     base tables already exist are INFERRED from usage + Supabase conventions
--     and are marked "inferred". Review these against the live DB before running.
--   * Scoped to soloops_* tables only. Does NOT touch the shared product_members
--     table. RLS tier/status enforcement and the invoice (user_id, number)
--     unique index (bug #7) are intentionally left for a separate, dedicated
--     migration — see the placeholder at the bottom.
--
-- Requires the pgcrypto extension for gen_random_uuid() (enabled by default on
-- Supabase). Uncomment if your project doesn't have it:
-- create extension if not exists pgcrypto;
-- ============================================================================


-- ----------------------------------------------------------------------------
-- soloops_invoice_lines  (bug #5)
-- ----------------------------------------------------------------------------
-- Columns confirmed from Forms.jsx save(): invoice_id, user_id, description,
-- qty, unit_price, position. Types inferred. id/created_at inferred (convention).
create table if not exists public.soloops_invoice_lines (
  id          uuid primary key default gen_random_uuid(),  -- inferred
  invoice_id  uuid not null,                                -- confirmed (FK added below)
  user_id     uuid not null,                                -- confirmed
  description text,                                         -- confirmed
  qty         numeric not null default 0,                   -- confirmed (Number(l.qty))
  unit_price  numeric not null default 0,                   -- confirmed (Number(l.unit_price))
  position    integer not null default 0,                   -- confirmed (idx)
  created_at  timestamptz not null default now()            -- inferred
);

-- Ensure the invoice_id -> soloops_invoices(id) FK exists WITH ON DELETE CASCADE.
-- If a non-cascading FK already exists (table pre-dated this migration), replace
-- it. Kept in a DO block so it is idempotent and independent of the old FK name.
do $$
declare fk_name text;
begin
  -- Find any existing FK on soloops_invoice_lines that references soloops_invoices.
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where con.contype = 'f'
    and rel.relname = 'soloops_invoice_lines'
    and con.confrelid = 'public.soloops_invoices'::regclass;

  -- Drop it unless it's already our cascading constraint.
  if fk_name is not null and fk_name <> 'soloops_invoice_lines_invoice_id_cascade_fkey' then
    execute format('alter table public.soloops_invoice_lines drop constraint %I', fk_name);
  end if;

  -- (Re)create the cascading FK if it isn't there.
  if not exists (
    select 1 from pg_constraint
    where conname = 'soloops_invoice_lines_invoice_id_cascade_fkey'
  ) then
    alter table public.soloops_invoice_lines
      add constraint soloops_invoice_lines_invoice_id_cascade_fkey
      foreign key (invoice_id) references public.soloops_invoices(id) on delete cascade;
  end if;
end $$;

create index if not exists soloops_invoice_lines_invoice_id_idx
  on public.soloops_invoice_lines (invoice_id);


-- ----------------------------------------------------------------------------
-- soloops_invoices : add vat_rate, due_date, notes  (confirmed from Forms.jsx)
-- ----------------------------------------------------------------------------
alter table public.soloops_invoices add column if not exists vat_rate numeric not null default 0; -- confirmed
alter table public.soloops_invoices add column if not exists due_date date;                        -- confirmed (nullable)
alter table public.soloops_invoices add column if not exists notes    text;                        -- confirmed (nullable)


-- ----------------------------------------------------------------------------
-- soloops_clients : add kind, email, phone, address, notes
-- ----------------------------------------------------------------------------
-- Confirmed from Clients.jsx payload + ensureClient(). kind is 'customer' |
-- 'supplier' | 'both'; default 'customer' matches app fallbacks. Types inferred.
alter table public.soloops_clients add column if not exists kind    text not null default 'customer'; -- confirmed
alter table public.soloops_clients add column if not exists email   text;                             -- confirmed
alter table public.soloops_clients add column if not exists phone   text;                             -- confirmed
alter table public.soloops_clients add column if not exists address text;                             -- confirmed
alter table public.soloops_clients add column if not exists notes   text;                             -- confirmed


-- ----------------------------------------------------------------------------
-- soloops_expenses : add source, has_receipt, receipt_name
-- ----------------------------------------------------------------------------
-- Confirmed: insertExpense writes source ('manual'|'import'); updateExpenseReceipt
-- writes has_receipt=true and receipt_name. Types inferred.
alter table public.soloops_expenses add column if not exists source       text not null default 'manual'; -- confirmed
alter table public.soloops_expenses add column if not exists has_receipt  boolean not null default false;  -- confirmed
alter table public.soloops_expenses add column if not exists receipt_name text;                             -- confirmed


-- ----------------------------------------------------------------------------
-- soloops_documents : add expense_id
-- ----------------------------------------------------------------------------
-- Confirmed from Receipts.jsx insert (links a receipt document to an expense).
-- Nullable: plain uploads have no expense. ON DELETE SET NULL so deleting an
-- expense doesn't delete an attached document record (inferred, conservative).
alter table public.soloops_documents add column if not exists expense_id uuid; -- confirmed

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'soloops_documents_expense_id_fkey'
  ) then
    alter table public.soloops_documents
      add constraint soloops_documents_expense_id_fkey
      foreign key (expense_id) references public.soloops_expenses(id) on delete set null;
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- soloops_settings : one row per user + extended columns
-- ----------------------------------------------------------------------------
-- saveSettings upserts with onConflict:'user_id', so user_id MUST be unique.
-- Base columns (business_name, address, phone, email) confirmed from persist().
create table if not exists public.soloops_settings (
  user_id       uuid primary key,   -- confirmed (upsert conflict target)
  business_name text,               -- confirmed
  address       text,               -- confirmed
  phone         text,               -- confirmed
  email         text                -- confirmed
);

-- If the table pre-existed without a unique/PK on user_id, guarantee one so the
-- upsert conflict target resolves. Idempotent.
do $$
begin
  -- True only if a single-column unique/primary index already covers user_id
  -- (indnatts = 1 avoids matching a composite index that merely includes it).
  if not exists (
    select 1
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = 'public.soloops_settings'::regclass
      and (i.indisunique or i.indisprimary)
      and i.indnatts = 1
      and a.attname = 'user_id'
  ) then
    alter table public.soloops_settings
      add constraint soloops_settings_user_id_key unique (user_id);
  end if;
end $$;

-- Extended columns — all confirmed from Settings.jsx persist() payload.
alter table public.soloops_settings add column if not exists vat_registered      boolean not null default false;   -- confirmed
alter table public.soloops_settings add column if not exists vat_number          text;                             -- confirmed
alter table public.soloops_settings add column if not exists vat_scheme          text not null default 'standard'; -- confirmed
alter table public.soloops_settings add column if not exists flat_rate           numeric not null default 16.5;    -- confirmed
alter table public.soloops_settings add column if not exists smtp_provider       text not null default 'custom';   -- confirmed
alter table public.soloops_settings add column if not exists smtp_host           text;                             -- confirmed
alter table public.soloops_settings add column if not exists smtp_port           integer not null default 587;     -- confirmed
alter table public.soloops_settings add column if not exists smtp_secure         boolean not null default false;   -- confirmed
alter table public.soloops_settings add column if not exists smtp_user           text;                             -- confirmed
alter table public.soloops_settings add column if not exists smtp_pass           text;                             -- confirmed
alter table public.soloops_settings add column if not exists smtp_from_name      text;                             -- confirmed
alter table public.soloops_settings add column if not exists smtp_from_email     text;                             -- confirmed
alter table public.soloops_settings add column if not exists smtp_reply_to       text;                             -- confirmed (Settings.jsx persist / send-email SMTP_COLS)
alter table public.soloops_settings add column if not exists email_footer        text;                             -- confirmed
alter table public.soloops_settings add column if not exists bank_name           text;                             -- confirmed
alter table public.soloops_settings add column if not exists bank_account_name   text;                             -- confirmed
alter table public.soloops_settings add column if not exists bank_sort_code      text;                             -- confirmed
alter table public.soloops_settings add column if not exists bank_account_number text;                             -- confirmed
alter table public.soloops_settings add column if not exists payment_terms       text;                             -- confirmed
alter table public.soloops_settings add column if not exists logo_url            text;                             -- confirmed
alter table public.soloops_settings add column if not exists updated_at          timestamptz;                      -- confirmed


-- ----------------------------------------------------------------------------
-- soloops_rules : unique (user_id, pattern)
-- ----------------------------------------------------------------------------
-- upsertRule/upsertRules use onConflict:'user_id,pattern', which REQUIRES this
-- unique constraint to exist or the upsert errors. Confirmed from db.js.
create unique index if not exists soloops_rules_user_id_pattern_key
  on public.soloops_rules (user_id, pattern);


-- ============================================================================
-- DEFERRED (bug #7) — do NOT enable without separate review:
--   * unique index on soloops_invoices (user_id, number)
--   * RLS policies joining the shared product_members table to enforce
--     tier/status server-side.
-- These touch behaviour beyond plain schema and read a shared table, so they
-- will be delivered as their own reviewed migration when bug #7 is addressed.
-- ============================================================================
