// /api/stripe-webhook.js
// ============================================================
// Stripe webhook receiver. Verifies the signature, then syncs subscription
// state into the product_members table.
//
// Handled events:
//   checkout.session.completed     -> activate: status=active, tier, ids stored
//   customer.subscription.updated  -> re-sync tier/status from the live sub
//   customer.subscription.deleted  -> status=suspended  (FAIL CLOSED)
//
// REQUIRED server-side env vars (NO VITE_ prefix):
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY     (bypasses RLS; keep secret)
//
// VERCEL QUIRK: Stripe signature verification needs the RAW request body, so
// we disable Vercel's automatic body parsing and read the stream ourselves.
// ============================================================

import Stripe from 'stripe'
import { safeTier, tierForPriceId } from './_billing-config.js'

// Tell Vercel NOT to parse the body — we need the raw bytes for the signature.
export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(typeof c === 'string' ? Buffer.from(c) : c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// PATCH a product_members row via the Supabase REST API using the service-role
// key (bypasses RLS). Throws on any non-2xx so the webhook returns 500 and
// Stripe retries.
async function patchMember(id, patch) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/product_members?id=eq.${encodeURIComponent(id)}`
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`Supabase update failed (${r.status}): ${t}`)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripeKey || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe env vars not set' })
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase service env vars not set' })
  }

  const stripe = new Stripe(stripeKey)

  // 1) Verify the signature against the RAW body.
  let event
  try {
    const raw = await readRawBody(req)
    const sig = req.headers['stripe-signature']
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  // 2) Act on the events we care about.
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.updated': {
        const obj = event.data.object
        const md = obj.metadata || {}
        // garageId comes from metadata (set on both session & subscription);
        // for the checkout session we also accept client_reference_id.
        const garageId = md.garageId || obj.client_reference_id
        const product = md.product || 'tyreops'
        if (!garageId) {
          console.error(`${event.type}: no garageId in metadata; ignoring`)
          break
        }

        // Prefer the tier implied by the ACTUAL subscribed price; fall back to
        // metadata. Either way clamp through safeTier so we never grant a tier
        // the customer didn't pay for (fail closed, never gold by accident).
        let priceId = null
        if (event.type === 'customer.subscription.updated') {
          priceId = obj.items?.data?.[0]?.price?.id || null
        }
        const tier = safeTier(product, tierForPriceId(product, priceId) || md.tier)

        // IDs live in different fields depending on the event shape.
        const stripeCustomerId =
          typeof obj.customer === 'string' ? obj.customer : obj.customer?.id || null
        const stripeSubscriptionId =
          event.type === 'checkout.session.completed'
            ? typeof obj.subscription === 'string'
              ? obj.subscription
              : obj.subscription?.id || null
            : obj.id

        const patch = { status: 'active', tier }
        if (stripeCustomerId) patch.stripe_customer_id = stripeCustomerId
        if (stripeSubscriptionId) patch.stripe_subscription_id = stripeSubscriptionId

        // Persist the paid renewal date so the app can show "Plan renews on …"
        // without a live Stripe call. current_period_end lives on the SUBSCRIPTION
        // object (customer.subscription.updated), not the checkout session — so it
        // is captured on the subscription event that fires right after checkout.
        // Stripe gives it as a UNIX timestamp (seconds); store as an ISO date
        // (YYYY-MM-DD) to match the existing date-only trial_ends column.
        if (typeof obj.current_period_end === 'number') {
          patch.current_period_end = new Date(obj.current_period_end * 1000)
            .toISOString()
            .slice(0, 10)
        }

        // On a subscription update, if Stripe says it's no longer live
        // (past_due, canceled, unpaid, ...), fail closed: suspend.
        if (event.type === 'customer.subscription.updated') {
          const live = ['active', 'trialing'].includes(obj.status)
          if (!live) patch.status = 'suspended'
        }

        await patchMember(garageId, patch)
        break
      }

      case 'customer.subscription.deleted': {
        const obj = event.data.object
        const md = obj.metadata || {}
        const garageId = md.garageId
        if (!garageId) {
          console.error('subscription.deleted: no garageId in metadata; ignoring')
          break
        }
        // FAIL CLOSED: subscription gone => lose access.
        await patchMember(garageId, { status: 'suspended' })
        break
      }

      default:
        // Acknowledge unhandled types so Stripe stops retrying them.
        break
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    console.error('stripe-webhook handler error:', err)
    return res.status(500).json({ error: err.message })
  }
}
