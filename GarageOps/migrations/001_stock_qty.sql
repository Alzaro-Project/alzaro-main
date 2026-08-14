-- ============================================================
-- Stock migration — quantity tracking for Parts
-- ------------------------------------------------------------
-- Adds the two columns the GarageOps Stock page reads/writes on
-- the existing `parts` table:
--   qty      current units on the shelf
--   min_qty  low-stock alert level (0 = no alert)
-- Run this in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

alter table public.parts
  add column if not exists qty integer not null default 0,
  add column if not exists min_qty integer not null default 0;
