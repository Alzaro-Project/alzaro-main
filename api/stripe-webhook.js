// /api/stripe-webhook.js
// ============================================================
// Stripe webhook receiver. Verifies the signature, then syncs subscription
// state into the product_members table.
//
// Handled events:
//   checkout.session.completed     -> activate: status=active, tier, ids stored
//                                     + purchase confirmation email via Resend
//   customer.subscription.updated  -> re-sync tier/status from the live sub
//   customer.subscription.deleted  -> status=suspended  (FAIL CLOSED)
//
// REQUIRED server-side env vars (NO VITE_ prefix):
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY     (bypasses RLS; keep secret)
// OPTIONAL:
//   RESEND_API_KEY                (purchase confirmation email; when unset the
//                                  email is skipped — never fatal)
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

// ============================================================
// Purchase confirmation email — sent via Resend when a checkout completes.
// Same pattern as trial-reminders.js: plain fetch to Resend, inline-styled
// HTML + text versions, and a ledger table for idempotency.
// ============================================================

// Friendly product names + login paths for the email CTA (the PRODUCT_META
// shape from trial-reminders.js).
const PRODUCT_META = {
  tyreops:     { name: 'TyreOps',     path: '/tyreops' },
  garageops:   { name: 'GarageOps',   path: '/garageops' },
  serviceops:  { name: 'ServiceOps',  path: '/serviceops' },
  propertyops: { name: 'PropertyOps', path: '/propertyops' },
  soloops:     { name: 'SoloOps',     path: '/soloops' },
}

const SITE_ORIGIN = 'https://www.alzaro.co.uk'
const PURCHASE_EMAIL_FROM = 'Alzaro <registrations@alzaro.co.uk>'

// Supabase REST helper (service role) for the purchase_emails_sent ledger.
// patchMember above keeps its own fetch on purpose: its throw-on-failure
// drives Stripe's retry and must not change.
function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// "£12.99" from Stripe's pence amount — amount_total reflects the REAL charge,
// including any promotion-code discount. Null when Stripe gave no amount;
// non-GBP (shouldn't happen today) falls back to "12.99 EUR" style.
function formatAmount(amountTotal, currency) {
  if (typeof amountTotal !== 'number') return null
  const value = (amountTotal / 100).toFixed(2)
  const cur = String(currency || 'gbp').toLowerCase()
  return cur === 'gbp' ? `£${value}` : `${value} ${cur.toUpperCase()}`
}

function buildPurchaseEmail({ productName, tierName, amountLabel, loginUrl }) {
  const subject = `Your Alzaro ${productName} subscription is confirmed`

  const text = `Hi,

Thanks for subscribing to ${productName} ${tierName}.
${amountLabel ? `\nAmount charged: ${amountLabel}` : ''}
Plan: ${tierName} (billed monthly)

Your account is now active and all ${tierName} features are unlocked. You can manage or cancel your subscription any time from Settings → Subscription in your account.

Open ${productName}: ${loginUrl}

---
This inbox isn't monitored. For any queries, please email support@alzaro.co.uk
Alzaro · alzaro.co.uk`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <div style="font-size:22px;font-weight:800;margin-bottom:8px;">Alzaro<span style="color:#5b8cff;">${productName}</span></div>
  <p style="font-size:15px;">Hi,</p>
  <p style="font-size:15px;">Thanks for subscribing to <strong>${productName} ${tierName}</strong>.</p>
  ${amountLabel ? `<p style="font-size:15px;margin:4px 0;">Amount charged: <strong>${amountLabel}</strong></p>` : ''}
  <p style="font-size:15px;margin:4px 0;">Plan: <strong>${tierName}</strong> (billed monthly)</p>
  <p style="font-size:15px;">Your account is now active and all ${tierName} features are unlocked. You can manage or cancel your subscription any time from Settings → Subscription in your account.</p>
  <p style="margin:28px 0;">
    <a href="${loginUrl}" style="background:#5b8cff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Open ${productName} →</a>
  </p>
  <p style="font-size:14px;color:#666;">This inbox isn't monitored. For any queries, please email <a href="mailto:support@alzaro.co.uk" style="color:#5b8cff;">support@alzaro.co.uk</a>.</p>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">Alzaro · alzaro.co.uk</div>
</body></html>`

  return { subject, text, html }
}

// Send the confirmation for a completed Checkout Session. NEVER throws — the
// tier update is already persisted and matters more than the email; a throw
// here would 500 the webhook and make Stripe re-run the whole event.
// Idempotent via the purchase_emails_sent ledger (one row per session id):
// checked before sending, written only after a successful send, with a unique
// constraint + ignore-duplicates so overlapping retries can't double-send.
async function sendPurchaseConfirmation(session, { product, tier }) {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      console.error('purchase email: RESEND_API_KEY not set; skipping')
      return
    }
    const to = session.customer_details?.email || session.metadata?.email || null
    if (!to) {
      console.error('purchase email: no customer email on session; skipping')
      return
    }

    // Already sent for this checkout session? A failed ledger read counts as
    // "not sent" (same call as trial-reminders.js) — for a purchase receipt a
    // rare duplicate beats silently never sending.
    const dup = await sb(
      `purchase_emails_sent?select=id&stripe_session_id=eq.${encodeURIComponent(session.id)}&limit=1`
    )
    const existing = dup.ok ? await dup.json().catch(() => []) : []
    if (Array.isArray(existing) && existing.length) return

    const meta = PRODUCT_META[product] || { name: product || 'Alzaro', path: '' }
    const tierName = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'your plan'
    const { subject, text, html } = buildPurchaseEmail({
      productName: meta.name,
      tierName,
      amountLabel: formatAmount(session.amount_total, session.currency),
      loginUrl: `${SITE_ORIGIN}${meta.path}/login`,
    })

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: PURCHASE_EMAIL_FROM, to: [to], subject, html, text }),
    })
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}))
      console.error('purchase email: Resend error:', resp.status, data.message || data.error || '')
      return
    }

    // Log ONLY after a successful send (trial-reminders pattern); the unique
    // constraint makes this idempotent even if the webhook overlaps itself.
    const ins = await sb('purchase_emails_sent', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: {
        stripe_session_id: session.id,
        product: product || null,
        tier: tier || null,
        email: to,
        amount_total: typeof session.amount_total === 'number' ? session.amount_total : null,
        currency: session.currency || null,
      },
    })
    if (!ins.ok) {
      console.error('purchase email: ledger insert failed:', ins.status, await ins.text().catch(() => ''))
    }
  } catch (err) {
    // Swallow everything: email failure must never fail the webhook.
    console.error('purchase email failed (webhook unaffected):', err)
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

        // Purchase confirmation email — ONLY on a completed checkout, never on
        // customer.subscription.updated (that fires on every routine change).
        // sendPurchaseConfirmation never throws, so a failed email can't 500
        // this webhook and re-trigger the member update.
        if (event.type === 'checkout.session.completed') {
          await sendPurchaseConfirmation(obj, { product, tier })
        }
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
