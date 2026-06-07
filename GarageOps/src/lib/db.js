-- ============================================================
-- OPTION B: one email, one garage PER PRODUCT
-- ------------------------------------------------------------
-- 1. Removes the "one garage per email" lock on garage_users
--    and replaces it with "no duplicate links".
-- 2. Adds join_product(): a trusted function that creates a
--    fresh 14-day trial garage for the signed-in user on a
--    product they don't have yet. Idempotent — calling it twice
--    returns the existing garage instead of duplicating.
--
-- Verified against the live handle_new_user_garage() trigger:
-- it plain-inserts (no ON CONFLICT), so dropping the unique
-- email rule does not affect new signups.
-- ============================================================

-- 1. Replace the lock
alter table garage_users drop constraint if exists garage_users_email_key;
alter table garage_users
  add constraint garage_users_email_garage_key unique (email, garage_id);

-- 2. The join function (mirrors handle_new_user_garage's defaults:
--    gold tier, trial status, 14-day expiry, owner role)
create or replace function public.join_product(p_product text, p_garage_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email     text;
  v_uid       uuid;
  v_existing  uuid;
  v_garage_id uuid;
  v_name      text;
begin
  v_email := auth.jwt()->>'email';
  v_uid   := auth.uid();
  if v_email is null or v_uid is null then
    raise exception 'Not signed in';
  end if;

  if p_product not in ('tyreops', 'garageops') then
    raise exception 'Unknown product: %', p_product;
  end if;

  -- Already a member of this product? Return that garage (idempotent).
  select g.id into v_existing
  from garage_users gu
  join garages g on g.id = gu.garage_id
  where gu.email = v_email and g.product = p_product
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  v_name := coalesce(nullif(trim(p_garage_name), ''), 'New Business');

  insert into garages (user_id, name, email, tier, status, product, trial_ends)
  values (v_uid, v_name, v_email, 'gold', 'trial', p_product,
          (current_date + interval '14 days')::date)
  returning id into v_garage_id;

  insert into garage_users (garage_id, email, role)
  values (v_garage_id, v_email, 'owner');

  return v_garage_id;
end;
$$;

-- 3. Only signed-in users may call it
revoke all on function public.join_product(text, text) from public, anon;
grant execute on function public.join_product(text, text) to authenticated;
