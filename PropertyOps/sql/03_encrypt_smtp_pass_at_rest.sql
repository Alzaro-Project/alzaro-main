-- ============================================================================
-- 03_encrypt_smtp_pass_at_rest.sql   ⚠️ RUN ONLY AFTER the paired code is deployed
-- ============================================================================
-- Encrypts prop_settings.smtp_pass at rest using a key held in Supabase Vault.
-- The key never leaves the database — not the browser, not the app env.
--
--   • Browser save path is UNCHANGED: the settings page still upserts the
--     plaintext password (over TLS); a BEFORE-write trigger encrypts it into
--     smtp_pass_enc and nulls the plaintext column, so plaintext is never at
--     rest.
--   • /api/send-email reads the password back via the SECURITY DEFINER RPC
--     public.prop_smtp_secret(), which decrypts ONLY the calling user's row
--     (auth.uid()). The updated send-email calls this RPC and falls back to the
--     plaintext column if the RPC isn't present yet — so running this migration
--     is safe with no downtime once that code is live.
--
-- ORDER OF OPERATIONS (no window either way, thanks to the code fallback):
--   1. Deploy the branch (the send-email that tries the RPC, else plaintext).
--   2. Run THIS script in the Supabase SQL editor (as the default postgres role).
--   3. Done — new saves are encrypted, existing rows were migrated below, and
--      send-email now reads via the RPC.
--
-- Requires: pgcrypto (preinstalled on Supabase) and Supabase Vault (the `vault`
-- schema, preinstalled). Safe to re-run (idempotent).
-- ============================================================================

-- pgcrypto provides pgp_sym_encrypt/decrypt. Preinstalled on Supabase; this is a
-- no-op if already present.
create extension if not exists pgcrypto;

-- 1) One random 256-bit symmetric key in Vault, created once. Key material is
--    generated from core gen_random_uuid() (no schema-qualification headaches)
--    and stored encrypted by Vault. Never appears in code or app config.
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

-- 2) Ciphertext column (text; pgp_sym_encrypt returns bytea, stored as its
--    armored/text form via encode is unnecessary — we keep bytea in a bytea col).
alter table public.prop_settings add column if not exists smtp_pass_enc bytea;

-- 3) Internal key accessor. SECURITY DEFINER so it can read Vault; locked down so
--    clients cannot call it directly (only the definer functions below use it).
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
--    null/'' (the settings page's "leave blank to keep current"), do nothing, so
--    the stored ciphertext is preserved.
create or replace function public._prop_settings_encrypt_smtp()
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

drop trigger if exists prop_settings_encrypt_smtp on public.prop_settings;
create trigger prop_settings_encrypt_smtp
  before insert or update on public.prop_settings
  for each row execute function public._prop_settings_encrypt_smtp();

-- 5) Migrate any existing plaintext passwords, then null the plaintext.
update public.prop_settings
   set smtp_pass_enc = pgp_sym_encrypt(smtp_pass, public._smtp_enc_key()),
       smtp_pass = null
 where smtp_pass is not null and smtp_pass <> '';

-- 6) Read-side RPC: returns the DECRYPTED password for the CALLING user's row
--    only (auth.uid()). SECURITY DEFINER so it can use the key, but scoped to the
--    caller's own row — a user can never read another company's password.
create or replace function public.prop_smtp_secret()
  returns text
  language sql
  stable
  security definer
  set search_path = public, extensions
as $$
  select pgp_sym_decrypt(smtp_pass_enc, public._smtp_enc_key())
  from public.prop_settings
  where user_id = auth.uid() and smtp_pass_enc is not null
  limit 1
$$;
revoke all on function public.prop_smtp_secret() from public;
revoke all on function public.prop_smtp_secret() from anon;
grant execute on function public.prop_smtp_secret() to authenticated;

-- Sanity check (optional): should return 0 once migration is done.
-- select count(*) as remaining_plaintext from public.prop_settings
--   where smtp_pass is not null and smtp_pass <> '';
