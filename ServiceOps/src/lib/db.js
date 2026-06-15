import { supabase } from './supabase'
import { PRODUCT } from '../config/product'

/* ==================================================================
   TENANTS  (shared `garages` table, scoped by `product` column)
   ------------------------------------------------------------------
   The table is still called `garages` for backwards-compatibility
   with TyreOps/GarageOps. A `product` column distinguishes rows.
   Every query here filters by PRODUCT.id so each product only ever
   sees its own tenants.
   ================================================================== */

const TABLE = 'garages'

/** Is this email a platform admin for THIS product? */
export async function checkIsAdmin(email) {
  if (!email) return false
  const { data, error } = await supabase
    .from('platform_admins')
    .select('email, product')
    .eq('email', email.toLowerCase().trim())
    .or(`product.eq.${PRODUCT.id},product.eq.all`)
    .maybeSingle()
  if (error) {
    console.error('checkIsAdmin error:', error)
    return false
  }
  return !!data
}
/** Create a trial garage for THIS product on the signed-in user's
    account, via the shared join_product DB function. Idempotent:
    if a garage for this product already exists, its id is returned. */
export async function joinProduct(garageName) {
  const { data, error } = await supabase.rpc('join_product', {
    p_product: PRODUCT.id,
    p_garage_name: garageName || '',
  })
  if (error) throw error
  return data
}
/** Fetch the tenant row for a given auth user id, scoped to product. */
export async function getTenantByUserId(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('product', PRODUCT.id)
    .maybeSingle()
  if (error) {
    console.error('getTenantByUserId error:', error)
    return null
  }
  return data
}

/** Live status check used by TrialGuard. */
export async function getTenantStatus(tenantId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('status, trial_ends')
    .eq('id', tenantId)
    .single()
  if (error) throw error
  return data
}

/* ---- Admin panel operations (all product-scoped) ---------------- */

export async function getAllTenants() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('product', PRODUCT.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function updateTenantTier(id, tier) {
  const { error } = await supabase.from(TABLE).update({ tier }).eq('id', id)
  if (error) throw error
}

export async function updateTenantStatus(id, status) {
  const { error } = await supabase.from(TABLE).update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteTenant(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}
