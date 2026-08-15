-- =============================================================================
-- 007_platform_support_sessions.sql
-- Audit trail for admin "View client portal" (support access) sessions.
--
-- REVIEW ONLY — do not run until /api/admin-impersonate.js is deployed.
-- Platform-level (not per-vertical). Safe to re-run.
--
-- Relies on the existing is_platform_admin() function already in this project.
-- =============================================================================

create extension if not exists pgcrypto;

create table if not exists public.platform_support_sessions (
  id              uuid primary key default gen_random_uuid(),
  admin_user_id   uuid not null references auth.users(id) on delete cascade,
  admin_email     text,
  target_user_id  uuid not null references auth.users(id) on delete cascade,
  target_email    text,
  product         text not null,          -- soloops | tyreops | garageops | serviceops | propertyops
  -- The UI doesn't ask for a reason; the API sends a standard line. The DB
  -- default is a second net so a row can never end up blank either way.
  reason          text not null default 'Support access via platform admin',
  ip              text,
  user_agent      text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz             -- stamped when the admin clicks "End session"
);

comment on table public.platform_support_sessions is
  'One row per admin support session opened against a customer account. Written by /api/admin-impersonate.js with the service-role key.';

create index if not exists pss_started_idx
  on public.platform_support_sessions (started_at desc);
create index if not exists pss_target_idx
  on public.platform_support_sessions (target_user_id, started_at desc);
create index if not exists pss_admin_idx
  on public.platform_support_sessions (admin_user_id, started_at desc);

alter table public.platform_support_sessions enable row level security;

-- Platform admins may READ the log (so it can be surfaced in /platform later).
-- There is deliberately NO insert/update/delete policy: only the service-role
-- key writes here, so an admin cannot edit or erase their own trail.
drop policy if exists pss_admin_read on public.platform_support_sessions;
create policy pss_admin_read
  on public.platform_support_sessions
  for select
  using (is_platform_admin());

-- Optional: let a customer see when their own account was accessed.
-- Recommended if you want to point at this in your privacy policy.
drop policy if exists pss_self_read on public.platform_support_sessions;
create policy pss_self_read
  on public.platform_support_sessions
  for select
  using (target_user_id = auth.uid());
