-- SoloOps custom expense categories: add a `hidden` flag.
--
-- A row in soloops_categories can now be one of two things:
--   hidden = false  → an OWN category the owner added to the built-in list
--   hidden = true   → a TOMBSTONE for a built-in category the owner switched
--                     off. Nothing is ever deleted: expenses already filed
--                     under that category keep the name exactly as saved; the
--                     tombstone just stops the built-in being offered in the
--                     dropdowns. Restoring it is a plain delete of the
--                     tombstone row.
--
-- Deploy order is safe either way: the client selects `hidden` defensively and
-- retries without it if the column isn't there yet (see loadCategories in
-- src/lib/db.js), so the app works before and after this migration runs.
ALTER TABLE public.soloops_categories
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.soloops_categories.hidden IS
  'true = tombstone marking a built-in category the owner switched off (not an own category); the name is never removed from existing expenses, it just stops being offered in the dropdowns. Restore = delete this row.';
