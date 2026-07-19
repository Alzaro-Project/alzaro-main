// /api/create-checkout-session.js
// ============================================================
// Vercel serverless function — creates a Stripe Checkout Session
// (mode: subscription) for a TyreOps tier and returns its URL for the
// browser to redirect to.
//
// REQUIRED server-side env vars (NO VITE_ prefix):
//   STRIPE_SECRET_KEY            - Stripe secret key (test or live)
//   SUPABASE_URL                 - used only to validate the caller's session
//   SUPABASE_ANON_KEY            - "
// OPTIONAL:
//   APP_BASE_URL                 - origin for success/cancel URLs; falls back
//                                  to the request origin, then alzaro.co.uk
//
// SECURITY: requires a valid Supabase session token in the Authorization
// header (same pattern as send-email.js).
// ============================================================

import Stripe from 'stripe'
import { priceIdFor, safeTier } from './_billing-config.js'

// Canonical base for success/cancel redirects. We always send users back to the
// canonical www host (not the request origin, which could be the apex domain or
// a preview URL) so the post-checkout return is consistent across verticals.
// APP_BASE_URL can override for staging.
function appBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  return 'https://www.alzaro.co.uk'
}

// Verify the given product_members row belongs to the caller. Reads user_id
// with the service-role key (bypasses RLS). Returns null when ownership is
// confirmed, or an { status, error } object to return to the client.
//   - row not found            -> 404 (nothing to bill)
//   - user_id mismatch         -> 403 (fail closed)
//   - can't verify (no key /   -> 403 (fail closed rather than allow)
//     no caller id / fetch err)
async function verifyOwnership({ supabaseUrl, garageId, product, callerId }) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !callerId) {
    console.error('Ownership check: missing service-role key or caller id; refusing')
    return { status: 403, error: 'Unable to verify account ownership' }
  }
  try {
    const url =
      `${supabaseUrl}/rest/v1/product_members` +
      `?id=eq.${encodeURIComponent(garageId)}` +
      `&product=eq.${encodeURIComponent(product)}` +
      `&select=user_id`
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    if (!r.ok) return { status: 403, error: 'Unable to verify account ownership' }
    const rows = await r.json()
    if (!rows?.length) return { status: 404, error: 'Account not found' }
    if (rows[0].user_id !== callerId) return { status: 403, error: 'This account does not belong to you' }
    return null
  } catch (e) {
    console.error('Ownership check failed:', e)
    return { status: 403, error: 'Unable to verify account ownership' }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // --- Auth check: only a logged-in user may start a checkout ---
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
    // Who is the caller? Needed to verify they own the garageId they passed.
    let callerId = null
    try { callerId = (await authCheck.json())?.id || null } catch (e) {}
    // --- End auth check ---

    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (!stripeKey) {
      return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set on server' })
    }

    const { email, garageId, product = 'tyreops', tier } = req.body || {}
    if (!email || !garageId) {
      return res.status(400).json({ error: 'Missing required fields: email, garageId' })
    }

    // --- Ownership check: the garageId must belong to the caller ---
    // Without this, any logged-in user could start a checkout against another
    // account's product_members row by guessing its id. Uses the service-role
    // key to read the row's user_id (bypasses RLS). Fails closed on mismatch.
    const ownerErr = await verifyOwnership({ supabaseUrl, garageId, product, callerId })
    if (ownerErr) return res.status(ownerErr.status).json({ error: ownerErr.error })
    // --- End ownership check ---

    // Fail closed: clamp the requested tier to a known paid tier for this
    // product. Unknown / missing tier -> lowest tier, never gold.
    const resolvedTier = safeTier(product, tier)
    const priceId = priceIdFor(product, resolvedTier)
    if (!priceId) {
      return res
        .status(400)
        .json({ error: `No Stripe price configured for ${product}/${resolvedTier}` })
    }

    const stripe = new Stripe(stripeKey)
    // Return the user to THIS vertical's own settings page. `product` is the
    // route prefix for every billed vertical (tyreops, garageops, ...).
    const base = appBaseUrl()
    const settingsPath = `/${product}/settings`

    // Put the lookup keys on BOTH the session and the subscription so the
    // webhook can find the product_members row from either event shape.
    const metadata = {
      garageId: String(garageId),
      email,
      product,
      tier: resolvedTier,
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: String(garageId),
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
      success_url: `${base}${settingsPath}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${settingsPath}?billing=cancelled`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    // Detail stays in the server log — Stripe/fetch errors can carry internal
    // detail that doesn't belong in a client response.
    console.error('create-checkout-session failed:', err)
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' })
  }
}
