-- ============================================================================
-- 01_audit_rls_policies.sql   (READ-ONLY — safe to run, changes nothing)
-- ============================================================================
-- PURPOSE
--   Confirms whether every PropertyOps (prop_*) table has Row Level Security
--   ENABLED and, critically, whether it has SELECT / INSERT / UPDATE / DELETE
--   policies. The PropertyOps client issues UPDATE/DELETE by row id only
--   (e.g. .update(...).eq("id", x)) with NO user_id filter, so RLS is the ONLY
--   thing isolating one company's data from another's. If a table has RLS on
--   but is MISSING an UPDATE or DELETE policy, writes silently fail; if RLS is
--   OFF (or a policy is too broad), any logged-in user can read/modify another
--   tenant's rows using the public anon key.
--
--   (This exact class of bug has already happened once in this codebase — see
--   SoloOps/migrations/002_soloops_rls.sql, where a table shipped RLS-enabled
--   with zero policies. Run this to be sure PropertyOps is not in that state.)
--
-- HOW TO USE
--   Paste into the Supabase SQL editor and Run. Review the two result sets.
--   Every prop_* table should show rls_enabled = true AND have four policy
--   rows (or equivalent) all scoped by (user_id = auth.uid()).
-- ============================================================================

-- 1) Is RLS enabled on each prop_* table?
select
  n.nspname                                   as schema,
  c.relname                                   as table,
  c.relrowsecurity                            as rls_enabled,
  c.relforcerowsecurity                       as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'prop\_%'
order by c.relname;

-- 2) What policies exist, and what do they check?
--    cmd = the command the policy applies to (SELECT/INSERT/UPDATE/DELETE/ALL).
--    qual        = the USING expression (row visibility / which rows an
--                  UPDATE/DELETE may touch).
--    with_check  = the WITH CHECK expression (what an INSERT/UPDATE may write).
--    You want, for each table, per-command policies whose expression is
--    (user_id = auth.uid()). A table that appears in result (1) but NOT here
--    for a given command has NO policy for that command.
select
  schemaname   as schema,
  tablename    as table,
  policyname   as policy,
  cmd,
  roles,
  qual         as using_expr,
  with_check   as with_check_expr
from pg_policies
where schemaname = 'public'
  and tablename like 'prop\_%'
order by tablename, cmd, policyname;

-- 3) Quick gap report: prop_* tables that are MISSING a policy for one or more
--    of the four write/read commands. Anything listed here is a hole.
with tbls as (
  select c.relname as tablename
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'prop\_%'
),
cmds(cmd) as (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'))
select t.tablename as table, x.cmd as missing_command
from tbls t
cross join cmds x
where not exists (
  select 1 from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = t.tablename
    and (p.cmd = x.cmd or p.cmd = 'ALL')
)
order by t.tablename, x.cmd;
