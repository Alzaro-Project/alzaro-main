-- ============================================================================
-- 003_soloops_encrypt_smtp_pass.sql   ⚠️ RUN ONLY AFTER the paired code is deployed
-- ============================================================================
-- Encrypts soloops_settings.smtp_pass at rest, mirroring PropertyOps'
-- sql/03_encrypt_smtp_pass_at_rest.sql. The key lives in Supabase Vault and
-- never leaves the database — not the browser, not the app env.
--
--   • Browser save path is UNCHANGED: Settings still upserts the plaintext
--     password (over TLS); a BEFORE-write trigger encrypts it into
--     smtp_pass_enc and nulls the plaintext column, so plaintext is never at
--     rest — and can never be selected back by client-side code.
--   • /api/send-email reads the password via the SECURITY DEFINER RPC
--     public.soloops_smtp_secret(), which decrypts ONLY the calling user's row
--     (auth.uid()). send-email already calls this RPC and falls back to the
--     plaintext column while it doesn't exist, so there is no downtime window.
--
-- ORDER OF OPERATIONS:
--   1. Deploy the app (send-email already tries soloops_smtp_secret first).
--   2. Run THIS script in the Supabase SQL editor (as the default postgres role).
--   3. Done — new saves are encrypted, existing rows are migrated below.
--
-- Requires: pgcrypto and Supabase Vault (both preinstalled on Supabase).
-- Safe to re-run (idempotent). Shares the 'alzaro_smtp_key' Vault secret and
-- public._smtp_enc_key() accessor with the PropertyOps migration — running
-- both scripts in either order is fine.
-- ============================================================================

create extension if not exists pgcrypto;

-- 1) One random 256-bit symmetric key in Vault, created once (shared with
--    PropertyOps — no-op if that migration already created it).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'alzaro_smtp_key') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'alzaro_smtp_key',
      'Symmetric key for encrypting per-company SMTP passwords at rest'
    );
  end if;
end $$;

-- 2) Ciphertext column.
alter table public.soloops_settings add column if not exists smtp_pass_enc bytea;

-- 3) Internal key accessor. SECURITY DEFINER so it can read Vault; locked down
--    so clients cannot call it directly. Identical to the PropertyOps version —
--    create or replace keeps the scripts order-independent.
create or replace function public._smtp_enc_key()
  returns text
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'alzaro_smtp_key' limit 1
$$;
revoke all on function public._smtp_enc_key() from public;
revoke all on function public._smtp_enc_key() from anon;
revoke all on function public._smtp_enc_key() from authenticated;

-- 4) BEFORE-write trigger: whenever a non-empty plaintext smtp_pass arrives,
--    encrypt it into smtp_pass_enc and blank the plaintext. When smtp_pass is
--    null/'' (the settings page's "leave blank to keep current"), do nothing,
--    so the stored ciphertext is preserved.
create or replace function public._soloops_settings_encrypt_smtp()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, extensions
as $$
begin
  if new.smtp_pass is not null and new.smtp_pass <> '' then
    new.smtp_pass_enc := pgp_sym_encrypt(new.smtp_pass, public._smtp_enc_key());
    new.smtp_pass := null;
  end if;
  return new;
end
$$;

drop trigger if exists soloops_settings_encrypt_smtp on public.soloops_settings;
create trigger soloops_settings_encrypt_smtp
  before insert or update on public.soloops_settings
  for each row execute function public._soloops_settings_encrypt_smtp();

-- 5) Migrate any existing plaintext passwords, then null the plaintext.
update public.soloops_settings
   set smtp_pass_enc = pgp_sym_encrypt(smtp_pass, public._smtp_enc_key()),
       smtp_pass = null
 where smtp_pass is not null and smtp_pass <> '';

-- 6) Read-side RPC: returns the DECRYPTED password for the CALLING user's row
--    only (auth.uid()). SECURITY DEFINER so it can use the key, but scoped to
--    the caller's own row — a user can never read another trader's password.
create or replace function public.soloops_smtp_secret()
  returns text
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select pgp_sym_decrypt(smtp_pass_enc, public._smtp_enc_key())
  from public.soloops_settings
  where user_id = auth.uid() and smtp_pass_enc is not null
  limit 1
$$;
revoke all on function public.soloops_smtp_secret() from public;
revoke all on function public.soloops_smtp_secret() from anon;
grant execute on function public.soloops_smtp_secret() to authenticated;

-- Sanity check (optional): should return 0 once migration is done.
-- select count(*) as remaining_plaintext from public.soloops_settings
--   where smtp_pass is not null and smtp_pass <> '';
