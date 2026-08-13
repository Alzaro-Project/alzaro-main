-- ============================================================================
-- 006_soloops_expense_notes.sql — description for "Other" expenses (idempotent)
-- ============================================================================
-- REVIEW ONLY — paste into the Supabase SQL editor yourself after reviewing.
--
-- One additive column: a free-text description saved when an expense's
-- category is "Other", so vague expenses stay explainable for your records.
-- No DROP / DELETE / TRUNCATE anywhere; existing rows simply get NULL.
-- ============================================================================

alter table public.soloops_expenses add column if not exists notes text;
