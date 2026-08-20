// /api/accountant.js
// ============================================================================
// Accountant portal: a client links their accountant to their books.
//
// Only ADD lives here — it needs the service role (email → auth user lookup,
// invite email for brand-new accountants) plus the one rule the client must
// not be trusted with: the caller must be a paying/trial member of the
// product. Everything else (edit visibility, revoke) happens client-side
// under the RLS policies in migrations/015_accountant_links.sql.
//
// Differences from /api/staff.js, on purpose:
//   * ANY paid/trial tier qualifies (no Gold gate, no seat count) — accountant
//     access is a stay-subscribed feature, not a plan perk.
//   * The permissions govern VISIBILITY only. There are no write policies for
//     accountants anywhere in the database, so nothing here needs to reason
//     about write access.
//   * A brand-new accountant's invite lands on /accountant/reset-password
//     (the portal's set-a-password page), not a vertical's.
//
// NOTE: /accountant/reset-password must be in Supabase Auth → URL
// Configuration → Redirect URLs, or invite links bounce to the site root.
// ============================================================================

import { rateLimit } from './_netguard.js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://cxsaeftacozyphuejuxo.supabase.co'
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Per-product wiring. permKeys must match the keys the vertical's Settings
// panel offers AND the arrays used in that vertical's accountant RLS policies
// (015 for soloops; later migrations for the rest).
// Stage 1 ships SoloOps; the others activate as their RLS stages land — an
// entry here without its migration would create links that grant nothing,
// so keep this list in lockstep with the migrations.
const PRODUCTS = {
  soloops: {
    label: 'Alzaro SoloOps',
    permKeys: ['dashboard', 'income', 'items', 'expenses', 'reports'],
    nameSources: [
      { table: 'soloops_settings', column: 'business_name' },
      { table: 'soloops_access', column: 'business_name' },
    ],
  },
}

function safeJson(s) { try { return JSON.parse(s) } catch { return {} } }

function bearer(req) {
  const raw = req.headers.authorization || req.headers.Authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(String(raw).trim())
  return m ? m[1] : null
}

async function serviceFetch(path, init = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!ANON_KEY || !SERVICE_KEY) {
    console.error('accountant: missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Not configured' })
  }

  const token = bearer(req)
  if (!token) return res.status(401).json({ error: 'Sign in required' })

  // Resolve the caller (the client / business owner).
  let client = null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (r.ok) client = await r.json()
  } catch (err) {
    console.error('accountant: auth lookup threw', err)
  }
  if (!client?.id) return res.status(401).json({ error: 'Session expired — sign in again' })

  const limit = rateLimit(`accountant:${client.id}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: 'Too many attempts — try again later' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {}
  const productKey = PRODUCTS[String(body.product || '').toLowerCase()]
    ? String(body.product).toLowerCase()
    : 'soloops'
  const P = PRODUCTS[productKey]

  // ---- action: add (the only action) ---------------------------------------
  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (email === String(client.email || '').toLowerCase()) {
    return res.status(400).json({ error: "That's your own email — invite your accountant's address" })
  }

  // Whitelist the permission keys; everything arrives as strict booleans.
  // These are VISIBILITY choices — what the accountant may SEE.
  const permissions = {}
  for (const k of P.permKeys) permissions[k] = body.permissions?.[k] === true
  if (!Object.values(permissions).some(Boolean)) {
    return res.status(400).json({ error: 'Tick at least one section for them to see' })
  }

  // The caller must be a paying/trial member of this product. ANY tier — the
  // client-side UI shows this to everyone, and this server check is only about
  // membership standing, not plan level.
  try {
    const r = await serviceFetch(
      `/rest/v1/product_members?user_id=eq.${client.id}&product=eq.${productKey}` +
        `&select=status&limit=1`
    )
    const rows = r.ok ? await r.json() : []
    const m = rows[0]
    if (!m || !['trial', 'active'].includes(m.status)) {
      return res.status(403).json({ error: 'Your subscription needs to be active to link an accountant' })
    }
  } catch (err) {
    console.error('accountant: membership check threw', err)
    return res.status(500).json({ error: 'Could not verify your plan — try again' })
  }

  // One accountant per product per client: keep it simple and unambiguous.
  // (Changing accountant = revoke the old link, invite the new one.)
  try {
    const c = await serviceFetch(
      `/rest/v1/accountant_links?client_id=eq.${client.id}&product=eq.${productKey}&select=id,accountant_email`,
      { headers: { Prefer: 'count=exact', Range: '0-0' } }
    )
    const total = Number((c.headers.get('content-range') || '/0').split('/')[1] || 0)
    if (total >= 1) {
      return res.status(409).json({
        error: 'You already have an accountant linked — remove them first to invite a different one',
      })
    }
  } catch (err) {
    console.error('accountant: existing-link check threw', err)
    return res.status(500).json({ error: 'Could not check existing links — try again' })
  }

  // Does this email already have an Alzaro login? (They might already be
  // another client's accountant — same auth user, new link row.)
  let acctUser = null
  try {
    const r = await serviceFetch(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`)
    if (r.ok) {
      const j = await r.json()
      const list = Array.isArray(j) ? j : j?.users || []
      acctUser = list.find((u) => String(u.email || '').toLowerCase() === email) || null
    }
  } catch (err) {
    console.error('accountant: user lookup threw', err)
  }

  // Business name for the invite email ("<name> has invited you…").
  let bizName = ''
  try {
    for (const src of P.nameSources) {
      const r = await serviceFetch(
        `/rest/v1/${src.table}?user_id=eq.${client.id}${src.extra || ''}&select=${src.column}&limit=1`
      )
      bizName = ((r.ok ? await r.json() : [])[0]?.[src.column] || '').trim()
      if (bizName) break
    }
  } catch (e) { /* name is a nicety — never block the invite on it */ }

  let status = 'active'
  let createdViaInvite = false
  let notifyExisting = false
  if (acctUser) {
    // Email already has an Alzaro login: no Supabase invite goes out, so
    // without this the accountant gets access silently and may never know.
    // Send a courtesy notification AFTER the link row commits (below).
    notifyExisting = true
  }
  if (!acctUser) {
    // Brand-new accountant: create + email an invite that lands on the
    // portal's set-a-password page. Pinned host, not derived from the request
    // (previews/www wouldn't match the Supabase redirect allow-list).
    const redirectTo = 'https://alzaro.co.uk/accountant/reset-password'
    try {
      // redirect_to MUST be a query parameter — GoTrue ignores it in the body.
      const r = await serviceFetch(
        `/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
        {
          method: 'POST',
          body: JSON.stringify({
            email,
            redirect_to: redirectTo,
            data: {
              invited_to: 'Alzaro Accountant Portal',
              workspace_name: bizName,
              is_accountant: true,
            },
          }),
        }
      )
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.id) {
        console.error('accountant: invite failed', r.status, j)
        return res.status(502).json({ error: 'Could not send the invite email' })
      }
      acctUser = j
      status = 'invited'
      createdViaInvite = true
    } catch (err) {
      console.error('accountant: invite threw', err)
      return res.status(502).json({ error: 'Could not send the invite email' })
    }
  }

  // Write the link row (service role: RLS has no client INSERT policy on
  // purpose — creation goes through this endpoint's checks or not at all).
  try {
    const ins = await serviceFetch(`/rest/v1/accountant_links`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        client_id: client.id,
        product: productKey,
        accountant_email: email,
        accountant_user_id: acctUser.id,
        permissions,
        status,
        created_via_invite: createdViaInvite,
        // Snapshot for the portal's client list (column added in 016; PostgREST
        // rejects unknown columns, so 016 must be run with 015 before invites).
        client_name: bizName || null,
      }),
    })
    const rows = ins.ok ? await ins.json() : null
    if (!rows?.[0]?.id) {
      const txt = await ins.text().catch(() => '')
      console.error('accountant: insert failed', ins.status, txt)
      // unique violation = raced a duplicate — surface the friendly message
      if (ins.status === 409) {
        return res.status(409).json({ error: 'You already have an accountant linked for this product' })
      }
      return res.status(502).json({ error: 'Could not save the link' })
    }
    // Courtesy notification for already-registered accountants (new ones get
    // the Supabase invite email instead). Fire-and-forget via Resend, same as
    // the platform's purchase/trial emails: a mail hiccup must never fail the
    // link that's already committed.
    if (notifyExisting) {
      try { await sendAccessNotification(email, bizName, P.label) }
      catch (e) { console.error('accountant: notify email failed (link still created)', e) }
    }
    return res.status(200).json({ ok: true, link: rows[0], existing_user: !createdViaInvite })
  } catch (err) {
    console.error('accountant: insert threw', err)
    return res.status(500).json({ error: 'Could not save the link' })
  }
}

// Tells an ALREADY-REGISTERED accountant they've been granted access (brand-new
// accountants get Supabase's invite email instead, so they're covered).
// Resend, from the platform address — same channel as purchase confirmations.
async function sendAccessNotification(to, bizName, productLabel) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) { console.error('accountant notify: RESEND_API_KEY not set; skipping'); return }
  const who = bizName || 'One of your clients'
  const subject = `${who} has given you access to their books on Alzaro`
  const url = 'https://alzaro.co.uk/accountant'
  const text =
    `${who} has given you view-only access to their ${productLabel} books.\n\n` +
    `Sign in with your existing Alzaro login at ${url}\n\n` +
    `You can look through their income, expenses and reports, but nothing can be changed from the accountant portal.\n\n` +
    `— Alzaro`
  const html =
    `<div style="font-family:sans-serif;max-width:520px">` +
    `<h2 style="margin:0 0 12px">${who} has shared their books with you</h2>` +
    `<p>You now have <b>view-only</b> access to their ${productLabel} records on Alzaro.</p>` +
    `<p><a href="${url}" style="display:inline-block;background:#f59e0b;color:#151515;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px">Open the accountant portal</a></p>` +
    `<p style="color:#666;font-size:13px">Sign in with your existing Alzaro login. You can view income, expenses and reports — nothing can be changed from the portal.</p>` +
    `</div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Alzaro <invoices@alzaro.co.uk>', to, subject, text, html }),
  })
  if (!r.ok) console.error('accountant notify: resend responded', r.status, await r.text().catch(() => ''))
}
