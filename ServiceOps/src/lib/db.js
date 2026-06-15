import { supabase } from './supabase'
import { PRODUCT } from '../config/product'

/* ==================================================================
   TENANTS  (shared `product_members` table, scoped by `product`)
   ------------------------------------------------------------------
   All five Alzaro verticals store their membership/licence rows in
   the single `product_members` table. A `product` column distinguishes
   rows, so each product only ever sees its own members. Every query
   here filters by PRODUCT.id.

   Column mapping: the app's tenant `name` maps to `company_name` in
   product_members. Reads alias it back to `name` so the store, admin
   panel and trial guard keep working unchanged.
   ================================================================== */

const TABLE = 'product_members'

/* Normalise a product_members row into the shape the rest of the app
   expects (it historically used the `garages` schema with a `name`). */
function shapeTenant(row) {
  if (!row) return null
  return {
    ...row,
    name: row.company_name || '',
  }
}

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

/** Create a trial membership for THIS product on the signed-in user's
    account. Idempotent: if a row for this product already exists it is
    returned rather than duplicated. The DB default sets trial_ends
    (CURRENT_DATE + 14) and the trigger forces tier=gold while on trial. */
export async function joinProduct(tenantName) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  // already a member of this product?
  const existing = await getTenantByUserId(user.id)
  if (existing) return existing.id

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{
      user_id: user.id,
      email: user.email,
      product: PRODUCT.id,
      company_name: tenantName || '',
    }])
    .select('id')
    .single()
  if (error) throw error
  return data.id
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
  return shapeTenant(data)
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
  return (data || []).map(shapeTenant)
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
