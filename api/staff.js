// /api/staff.js
// ============================================================================
// Multi-user staff for every vertical: adds a staff member to an owner's workspace.
//
// Only ADD lives here — it needs the service role (email → auth user lookup,
// invite email for brand-new people) plus the two rules the client must not
// be trusted with: the owner must be Gold, and Gold gets exactly one staff
// seat. Everything else (edit permissions, remove) happens client-side under
// the RLS policies in migrations/008_soloops_staff.sql.
//
// Flow for a brand-new email: the Supabase admin invite creates the auth user
// and emails them a link. That link lands on /soloops/reset-password where
// they set their own password, then they sign in normally and the app spots
// the staff mapping at boot.
//
// NOTE: /soloops/reset-password must be in Supabase Auth → URL Configuration →
// Redirect URLs, or invite links will bounce to the site root.
// ============================================================================

import { rateLimit } from './_netguard.js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://cxsaeftacozyphuejuxo.supabase.co'
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Staff seats per tier. Owner is not counted — this is EXTRA users.
// One endpoint, every vertical. Per-product wiring lives here; the tier list
// must match each product's RLS staff functions (011 for soloops, 012 for
// propertyops) and the seat counts must match that product's Users tab copy.
// Callers send { product } in the body; missing/unknown falls back to soloops
// so the already-shipped SoloOps UI keeps working unchanged.
const PRODUCTS = {
  soloops: {
    label: 'Alzaro SoloOps',
    staffTable: 'soloops_staff',
    permKeys: ['dashboard', 'income', 'items', 'expenses', 'receipts', 'reports'],
    seats: { basic: 0, bronze: 0, silver: 2, gold: 4 },
    redirectPath: '/soloops/reset-password',
    // where to look for the workspace name for the invite email, in order
    nameSources: [
      { table: 'soloops_settings', column: 'business_name' },
      { table: 'soloops_access', column: 'business_name' },
    ],
  },
  tyreops: {
    label: 'Alzaro TyreOps',
    staffTable: 'garage_staff',
    // garage_staff is shared with garageops — every query/insert is product-scoped
    staffFilter: '&product=eq.tyreops',
    staffInsertExtra: { product: 'tyreops' },
    permKeys: ['dashboard', 'invoices', 'inventory', 'purchases', 'customers', 'followups', 'vat'],
    seats: { basic: 0, bronze: 0, silver: 2, gold: 4 },
    redirectPath: '/tyreops/reset-password',
    nameSources: [
      { table: 'product_members', column: 'company_name', extra: '&product=eq.tyreops' },
    ],
  },
  garageops: {
    label: 'Alzaro GarageOps',
    staffTable: 'garage_staff',
    staffFilter: '&product=eq.garageops',
    staffInsertExtra: { product: 'garageops' },
    permKeys: ['dashboard', 'invoices', 'customers', 'items', 'database', 'purchases', 'calendar', 'reports'],
    seats: { basic: 0, bronze: 0, silver: 2, gold: 4 },
    redirectPath: '/garageops/reset-password',
    nameSources: [
      { table: 'product_members', column: 'company_name', extra: '&product=eq.garageops' },
    ],
  },
  propertyops: {
    label: 'Alzaro PropertyOps',
    staffTable: 'prop_staff',
    permKeys: ['dashboard', 'properties', 'tenants', 'finance', 'maintenance', 'compliance', 'documents', 'reports'],
    seats: { basic: 0, bronze: 0, silver: 2, gold: 4 },
    redirectPath: '/propertyops/reset-password',
    nameSources: [
      { table: 'prop_settings', column: 'company_name' },
    ],
  },
}

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
    console.error('staff: missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Not configured' })
  }

  const token = bearer(req)
  if (!token) return res.status(401).json({ error: 'Sign in required' })

  // Resolve the caller (the owner).
  let owner = null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (r.ok) owner = await r.json()
  } catch (err) {
    console.error('staff: auth lookup threw', err)
  }
  if (!owner?.id) return res.status(401).json({ error: 'Session expired — sign in again' })

  const limit = rateLimit(`staff:${owner.id}`, { max: 10, windowMs: 60 * 60 * 1000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: 'Too many attempts — try again later' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {}
  const productKey = PRODUCTS[String(body.product || '').toLowerCase()] ? String(body.product).toLowerCase() : 'soloops'
  const P = PRODUCTS[productKey]

  // ---- action: set_password -------------------------------------------------
  // Owner sets a new password for a staff account THEY created via invite.
  // Accounts the person owned before joining are off-limits (created_via_invite
  // = false) — resetting those would hijack their whole Alzaro identity; the
  // UI offers a reset *email* for that case instead.
  if (body.action === 'set_password') {
    const staffId = String(body.staff_id || '')
    const password = String(body.password || '')
    if (!/^[0-9a-f-]{36}$/i.test(staffId)) return res.status(400).json({ error: 'Bad request' })
    if (password.length < 8) return res.status(400).json({ error: 'Password needs at least 8 characters' })
    try {
      // The mapping row is the authority: owner must match the caller, and the
      // target auth id comes from the row — never from the client.
      const r = await serviceFetch(
        `/rest/v1/${P.staffTable}?id=eq.${staffId}${P.staffFilter || ''}` +
          `&select=owner_id,staff_user_id,created_via_invite&limit=1`
      )
      const row = (r.ok ? await r.json() : [])[0]
      if (!row || row.owner_id !== owner.id) return res.status(404).json({ error: 'User not found' })
      if (!row.staff_user_id) return res.status(409).json({ error: 'No login exists for this user yet' })
      if (row.created_via_invite !== true) {
        return res.status(403).json({
          error: 'They joined with their own existing Alzaro login — use "Send password reset email" instead',
        })
      }
      const u = await serviceFetch(`/auth/v1/admin/users/${row.staff_user_id}`, {
        method: 'PUT',
        body: JSON.stringify({ password }),
      })
      if (!u.ok) {
        console.error('staff: password set failed', u.status, await u.text())
        return res.status(502).json({ error: 'Could not set the password' })
      }
      // A set password means they can log in — mark active.
      await serviceFetch(`/rest/v1/${P.staffTable}?id=eq.${staffId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'active' }),
      }).catch(() => {})
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error('staff: set_password threw', err)
      return res.status(500).json({ error: 'Could not set the password' })
    }
  }

  // ---- action: add (default) ------------------------------------------------
  const email = String(body.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (email === String(owner.email || '').toLowerCase()) {
    return res.status(400).json({ error: "That's your own email — you're already the admin" })
  }

  // Whitelist the permission keys; everything arrives as strict booleans.
  const permissions = {}
  for (const k of P.permKeys) permissions[k] = body.permissions?.[k] === true
  if (!Object.values(permissions).some(Boolean)) {
    return res.status(400).json({ error: 'Tick at least one section for them to use' })
  }

  // Owner must be a Gold member in good standing. Server-side check — the
  // client-side lock on the Users tab is cosmetic.
  try {
    const r = await serviceFetch(
      `/rest/v1/product_members?user_id=eq.${owner.id}&product=eq.${productKey}` +
        `&select=tier,status&limit=1`
    )
    const rows = r.ok ? await r.json() : []
    const m = rows[0]
    const seats = m && ['trial', 'active'].includes(m.status) ? (P.seats[m.tier] || 0) : 0
    if (seats < 1) {
      return res.status(403).json({ error: 'Adding users needs an active Silver or Gold plan' })
    }

    // Seat limit: count existing staff rows.
    const c = await serviceFetch(
      `/rest/v1/${P.staffTable}?owner_id=eq.${owner.id}${P.staffFilter || ''}&select=id`,
      { headers: { Prefer: 'count=exact', Range: '0-0' } }
    )
    const total = Number((c.headers.get('content-range') || '/0').split('/')[1] || 0)
    if (total >= seats) {
      return res.status(409).json({
        error: `Your plan includes ${seats} staff ${seats === 1 ? 'seat' : 'seats'} — remove the current user first`,
      })
    }
  } catch (err) {
    console.error('staff: gold/seat check threw', err)
    return res.status(500).json({ error: 'Could not verify your plan — try again' })
  }

  // Does this email already have an Alzaro login?
  let staffUser = null
  try {
    const r = await serviceFetch(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`)
    if (r.ok) {
      const j = await r.json()
      const list = Array.isArray(j) ? j : j?.users || []
      staffUser = list.find((u) => String(u.email || '').toLowerCase() === email) || null
    }
  } catch (err) {
    console.error('staff: user lookup threw', err)
  }

  // Business name for the invite email ("<name> has added you…"). Settings is
  // the source of truth; soloops_access covers owners who never saved settings.
  let bizName = ''
  try {
    for (const src of P.nameSources) {
      const r = await serviceFetch(
        `/rest/v1/${src.table}?user_id=eq.${owner.id}${src.extra || ''}&select=${src.column}&limit=1`
      )
      bizName = ((r.ok ? await r.json() : [])[0]?.[src.column] || '').trim()
      if (bizName) break
    }
  } catch (e) { /* name is a nicety — never block the invite on it */ }

  let status = 'active'
  if (!staffUser) {
    // Brand-new person: create + email them an invite that lands on the
    // set-a-password page.
    // Pinned, not derived from the request host: on www.alzaro.co.uk or a
    // Vercel preview the derived URL wouldn't match the Supabase redirect
    // allow-list, and Supabase would quietly fall back to the Site URL.
    const redirectTo = 'https://alzaro.co.uk' + P.redirectPath
    try {
      // redirect_to MUST be a query parameter — GoTrue ignores it in the body
      // and silently falls back to the project's Site URL, which dumps the
      // invitee on the marketing homepage with no way to set a password.
      const r = await serviceFetch(
        `/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
        {
          method: 'POST',
          // `data` lands in user_metadata and is readable by the email template
          // as {{ .Data.* }} — that's how the invite says WHICH product and
          // WHOSE workspace, since templates are otherwise project-wide.
          body: JSON.stringify({
            email,
            redirect_to: redirectTo,
            data: { invited_to: P.label, workspace_name: bizName },
          }),
        }
      )
      const j = await r.json().catch(() => null)
      if (!r.ok || !j?.id) {
        console.error('staff: invite failed', r.status, j)
        return res.status(502).json({ error: 'Could not send the invite email' })
      }
      staffUser = j
      status = 'invited'
    } catch (err) {
      console.error('staff: invite threw', err)
      return res.status(502).json({ error: 'Could not send the invite email' })
    }
  }

  if (staffUser.id === owner.id) {
    return res.status(400).json({ error: "That's your own account" })
  }

  // Create the mapping. The unique (owner_id, staff_email) constraint turns a
  // double-add into a clean 409.
  try {
    const r = await serviceFetch(`/rest/v1/${P.staffTable}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        ...(P.staffInsertExtra || {}),
        owner_id: owner.id,
        staff_user_id: staffUser.id,
        staff_email: email,
        permissions,
        status,
        created_via_invite: status === 'invited',
      }),
    })
    const rows = await r.json().catch(() => null)
    if (!r.ok) {
      const dup = JSON.stringify(rows || '').includes('_owner_email_uniq')
      console.error('staff: mapping insert failed', r.status, rows)
      return res.status(dup ? 409 : 500).json({
        error: dup ? 'That person is already on your account' : 'Could not add the user',
      })
    }
    const row = Array.isArray(rows) ? rows[0] : rows
    return res.status(200).json({ staff: row, invited: status === 'invited' })
  } catch (err) {
    console.error('staff: mapping insert threw', err)
    return res.status(500).json({ error: 'Could not add the user' })
  }
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return {} }
}
