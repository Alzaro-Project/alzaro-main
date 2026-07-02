// /api/create-portal-session.js
// ============================================================
// Creates a Stripe Billing Portal session so a customer can manage or cancel
// their subscription, and returns its URL.
//
// Accepts EITHER:
//   - stripeCustomerId : a Stripe customer id directly, OR
//   - garageId         : a product_members row id we resolve to its stored
//                        stripe_customer_id (so the app can call this without
//                        holding the customer id client-side).
//
// REQUIRED server-side env vars (NO VITE_ prefix):
//   STRIPE_SECRET_KEY
//   SUPABASE_URL / SUPABASE_ANON_KEY        (validate caller session)
//   SUPABASE_SERVICE_ROLE_KEY               (resolve garageId -> customer id)
// OPTIONAL:
//   APP_BASE_URL                            (return_url base)
//
// SECURITY: requires a valid Supabase session token in the Authorization header.
// ============================================================

import Stripe from 'stripe'

// Canonical base for the portal return_url. Same rationale as the checkout
// session: always the canonical www host so the return is consistent across
// verticals. APP_BASE_URL can override for staging.
function appBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  return 'https://www.alzaro.co.uk'
}

// Allow only known vertical route prefixes so the return_url can't be steered
// to an arbitrary path. Falls back to tyreops.
const KNOWN_PRODUCTS = ['tyreops', 'garageops', 'serviceops', 'propertyops', 'soloops']
function settingsPathFor(product) {
  const p = KNOWN_PRODUCTS.includes(product) ? product : 'tyreops'
  return `/${p}/settings`
}

// Look up the stored Stripe customer id for a product_members row using the
// service-role key (bypasses RLS). Returns null if none on file.
async function customerIdForGarage(garageId) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  // Match the auth-check fallback below: some deployments only set the VITE_
  // prefixed URL. Without this fallback the lookup hits `undefined/rest/...`
  // and every portal request wrongly reports "no Stripe customer on file".
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://cxsaeftacozyphuejuxo.supabase.co'
  const url =
    `${supabaseUrl}/rest/v1/product_members` +
    `?id=eq.${encodeURIComponent(garageId)}&select=stripe_customer_id`
  const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) return null
  const rows = await r.json()
  return rows?.[0]?.stripe_customer_id || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // --- Auth check: logged-in users only ---
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Not authenticated' })

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      'https://cxsaeftacozyphuejuxo.supabase.co'
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseAnonKey) {
      return res.status(500).json({ error: 'SUPABASE_ANON_KEY not set on server' })
    }
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
    })
    if (!authCheck.ok) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    // --- End auth check ---

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set on server' })
    }

    const { stripeCustomerId, garageId, product = 'tyreops' } = req.body || {}
    let customerId = stripeCustomerId || null
    if (!customerId && garageId) {
      customerId = await customerIdForGarage(garageId)
    }
    if (!customerId) {
      return res
        .status(400)
        .json({ error: 'No Stripe customer on file for this account yet' })
    }

    const stripe = new Stripe(stripeKey)
    const base = appBaseUrl()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}${settingsPathFor(product)}`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('create-portal-session failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
