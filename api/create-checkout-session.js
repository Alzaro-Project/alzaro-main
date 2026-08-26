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
// canonical apex host (www 301-redirects to apex in vercel.json, so www must
// never be used for API-facing URLs) so the post-checkout return is consistent.
// APP_BASE_URL can override for staging.
function appBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '')
  return 'https://alzaro.co.uk'
}

// Verify the given product_members row belongs to the caller. Reads user_id
// (plus the stored Stripe ids, needed for the existing-subscriber path) with
// the service-role key (bypasses RLS). Returns { err, row }:
//   err = null when ownership is confirmed, else { status, error } to return.
//   row = { stripe_customer_id, stripe_subscription_id } when confirmed.
//   - row not found            -> 404 (nothing to bill)
//   - user_id mismatch         -> 403 (fail closed)
//   - can't verify (no key /   -> 403 (fail closed rather than allow)
//     no caller id / fetch err)
async function verifyOwnership({ supabaseUrl, garageId, product, callerId }) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key || !callerId) {
    console.error('Ownership check: missing service-role key or caller id; refusing')
    return { err: { status: 403, error: 'Unable to verify account ownership' } }
  }
  try {
    const url =
      `${supabaseUrl}/rest/v1/product_members` +
      `?id=eq.${encodeURIComponent(garageId)}` +
      `&product=eq.${encodeURIComponent(product)}` +
      `&select=user_id,stripe_customer_id,stripe_subscription_id`
    const r = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    if (!r.ok) return { err: { status: 403, error: 'Unable to verify account ownership' } }
    const rows = await r.json()
    if (!rows?.length) return { err: { status: 404, error: 'Account not found' } }
    if (rows[0].user_id !== callerId) return { err: { status: 403, error: 'This account does not belong to you' } }
    return { err: null, row: rows[0] }
  } catch (e) {
    console.error('Ownership check failed:', e)
    return { err: { status: 403, error: 'Unable to verify account ownership' } }
  }
}

// A stored stripe_subscription_id alone is NOT proof of a live subscription —
// cancelled accounts keep a stale value. Verify liveness against the Stripe
// API. Statuses that mean "there is a real subscription to modify": active,
// trialing, past_due (past_due should update via the portal, not stack a
// second sub). canceled / incomplete_expired / retrieval failure -> not live.
async function liveSubscription(stripe, subscriptionId) {
  if (!subscriptionId) return null
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    return ['active', 'trialing', 'past_due'].includes(sub?.status) ? sub : null
  } catch (e) {
    // Unknown / deleted subscription id -> treat as no live subscription.
    return null
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
    const { err: ownerErr, row: memberRow } = await verifyOwnership({ supabaseUrl, garageId, product, callerId })
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

    // --- Existing subscriber? Route to the Billing Portal, NEVER a new
    // checkout (Bug #14: checkout always CREATES a subscription, so an active
    // subscriber changing plans ended up paying for two at once). Liveness is
    // verified against Stripe — a stale stored id on a cancelled account still
    // gets a fresh checkout as it should. ---
    const existingSub = await liveSubscription(stripe, memberRow?.stripe_subscription_id)
    if (existingSub) {
      const returnUrl = `${base}${settingsPath}?billing=updated`
      const portalCustomer =
        (typeof existingSub.customer === 'string' ? existingSub.customer : existingSub.customer?.id) ||
        memberRow?.stripe_customer_id
      try {
        // Deep-link straight into the plan-change flow for THIS subscription.
        // Requires the Customer Portal configuration to allow subscription
        // updates with our prices (Stripe Dashboard -> Settings -> Billing ->
        // Customer portal).
        const flow = await stripe.billingPortal.sessions.create({
          customer: portalCustomer,
          return_url: returnUrl,
          flow_data: {
            type: 'subscription_update',
            subscription_update: { subscription: existingSub.id },
          },
        })
        return res.status(200).json({ url: flow.url, portal: true })
      } catch (e) {
        // Portal config may not allow the update flow yet — fall back to a
        // plain portal session so the user can still manage the existing
        // subscription. Never fall back to checkout: that recreates Bug #14.
        console.error('Portal update-flow failed, falling back to plain portal:', e.message)
        const plain = await stripe.billingPortal.sessions.create({
          customer: portalCustomer,
          return_url: returnUrl,
        })
        return res.status(200).json({ url: plain.url, portal: true })
      }
    }
    // --- End existing-subscriber routing ---

    // Put the lookup keys on BOTH the session and the subscription so the
    // webhook can find the product_members row from either event shape.
    const metadata = {
      garageId: String(garageId),
      email,
      product,
      tier: resolvedTier,
    }

    // Reuse the stored Stripe customer when we have one (e.g. a returning
    // customer whose old subscription was cancelled). `customer_email` on its
    // own creates a brand-new Stripe customer object on EVERY checkout, which
    // is how duplicate customers piled up. Verify the stored id still exists
    // and isn't deleted; otherwise fall back to customer_email.
    let existingCustomerId = null
    if (memberRow?.stripe_customer_id) {
      try {
        const cust = await stripe.customers.retrieve(memberRow.stripe_customer_id)
        if (cust && !cust.deleted) existingCustomerId = cust.id
      } catch (e) {
        // Unknown id (e.g. from a deleted customer or an old test-mode run) —
        // ignore and let checkout create a fresh customer.
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(existingCustomerId ? { customer: existingCustomerId } : { customer_email: email }),
      client_reference_id: String(garageId),
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
      success_url: `${base}${settingsPath}?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}${settingsPath}?billing=cancelled`,
    })

    return res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('create-checkout-session failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
