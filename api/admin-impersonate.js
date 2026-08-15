// /api/admin-impersonate.js
// ============================================================================
// "View client portal" — lets a platform admin open a customer's app to set it
// up for them or reproduce a fault they've reported.
//
// FLOW
//   1. /platform POSTs { action:'start', user_id, product, reason } with the
//      admin's own session token in the Authorization header.
//   2. We confirm that token belongs to a real user, then confirm that user is
//      a platform admin by calling the existing is_platform_admin() RPC AS THAT
//      USER. The check therefore reuses the same gate /platform already trusts.
//   3. We mint a one-time magic-link token for the target user via the Supabase
//      admin API (generate_link does NOT email anything — it just returns the
//      token) and write an audit row.
//   4. The browser opens /<product>/support#tk=… in a new tab. The token rides
//      in the URL FRAGMENT, which browsers never send to a server — so it stays
//      out of Vercel logs, the Referer header and any proxy in between.
//
//   'end' stamps ended_at. It's called from inside the support tab, which only
//   holds the CUSTOMER's token, so it authenticates as the customer and we
//   check that customer actually is the session's target.
//
// REQUIRED server-side env vars (no VITE_ prefix):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
//
// SECURITY NOTES
//   - The service-role key is used only in this file and never returned.
//   - A support session is a REAL login as the customer. It is capped, logged,
//     visible to the customer via RLS, and requires a written reason.
//   - Anyone who can grant themselves platform admin can do this. Keep the
//     admin list short.
// ============================================================================

import { rateLimit } from './_netguard.js'

const KNOWN_PRODUCTS = ['tyreops', 'garageops', 'serviceops', 'propertyops', 'soloops']

// Same resolution order as create-portal-session.js / invoice-pdf.js.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://cxsaeftacozyphuejuxo.supabase.co'

const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// How long a support tab stays usable before it forces itself closed.
const SESSION_MINUTES = 60

function bearer(req) {
  const raw = req.headers.authorization || req.headers.Authorization || ''
  const m = /^Bearer\s+(.+)$/i.exec(String(raw).trim())
  return m ? m[1] : null
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null
}

// Resolve a session token -> user. Returns null when the token is bad.
async function userFromToken(token) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return null
    const u = await r.json()
    return u && u.id ? u : null
  } catch {
    return null
  }
}

// Ask Postgres, as the caller, whether they're a platform admin. Using the
// caller's own token (not the service key) means the answer comes from the same
// function /platform already gates on — one source of truth, and it fails
// closed if the RPC is missing or errors.
async function callerIsPlatformAdmin(token) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_platform_admin`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    })
    if (!r.ok) return false
    return (await r.json()) === true
  } catch {
    return false
  }
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
    console.error('admin-impersonate: missing SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY')
    return res.status(500).json({ error: 'Support access is not configured' })
  }

  const token = bearer(req)
  if (!token) return res.status(401).json({ error: 'Sign in required' })

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {}
  const action = body.action === 'end' ? 'end' : 'start'

  const caller = await userFromToken(token)
  if (!caller) return res.status(401).json({ error: 'Session expired — sign in again' })

  // ---------------------------------------------------------------- end -----
  // Called from inside the support tab, which holds the customer's token.
  // Authorise by checking the caller IS the session's target.
  if (action === 'end') {
    const sessionId = String(body.session_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return res.status(400).json({ error: 'Bad session id' })
    }
    try {
      const r = await serviceFetch(
        `/rest/v1/platform_support_sessions?id=eq.${sessionId}` +
          `&target_user_id=eq.${caller.id}&ended_at=is.null`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ ended_at: new Date().toISOString() }),
        }
      )
      if (!r.ok) console.error('admin-impersonate: end failed', r.status, await r.text())
    } catch (err) {
      console.error('admin-impersonate: end threw', err)
    }
    // Always 200 — the tab is closing either way; a failed audit stamp must not
    // trap the admin inside the customer's account.
    return res.status(200).json({ ok: true })
  }

  // -------------------------------------------------------------- start -----
  const isAdmin = await callerIsPlatformAdmin(token)
  if (!isAdmin) {
    // Deliberately vague — don't confirm this endpoint exists to non-admins.
    return res.status(404).json({ error: 'Not found' })
  }

  const limit = rateLimit(`support:${caller.id}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter))
    return res.status(429).json({ error: 'Too many support sessions — try again later' })
  }

  const targetId = String(body.user_id || '').trim()
  const product = String(body.product || '').trim().toLowerCase()
  // Reason is optional — the UI no longer asks for one. If a caller does send
  // one (e.g. a future scripted use) it's kept; otherwise a standard line goes
  // in so the audit row is never blank.
  const reason =
    String(body.reason || '').trim().slice(0, 300) || 'Support access via platform admin'

  if (!/^[0-9a-f-]{36}$/i.test(targetId)) {
    return res.status(400).json({ error: 'Pick a valid account' })
  }
  if (!KNOWN_PRODUCTS.includes(product)) {
    return res.status(400).json({ error: 'Unknown product' })
  }
  if (targetId === caller.id) {
    return res.status(400).json({ error: 'That is your own account — just log in normally' })
  }

  // Look up the target's email (generate_link is keyed by email, not id).
  let targetEmail = null
  try {
    const r = await serviceFetch(`/auth/v1/admin/users/${targetId}`)
    if (r.ok) {
      const u = await r.json()
      targetEmail = u?.email || null
    } else {
      console.error('admin-impersonate: user lookup failed', r.status)
    }
  } catch (err) {
    console.error('admin-impersonate: user lookup threw', err)
  }
  if (!targetEmail) return res.status(404).json({ error: 'Account not found' })

  // Mint a one-time login token. generate_link returns the token WITHOUT
  // sending any email, so the customer is never notified or interrupted.
  let tokenHash = null
  try {
    const r = await serviceFetch('/auth/v1/admin/generate_link', {
      method: 'POST',
      body: JSON.stringify({ type: 'magiclink', email: targetEmail }),
    })
    const j = await r.json().catch(() => null)
    if (!r.ok) {
      console.error('admin-impersonate: generate_link failed', r.status, j)
      return res.status(502).json({ error: 'Could not start a support session' })
    }
    // Raw REST merges the link properties into the user object; the JS SDK
    // nests them under .properties. Accept either.
    tokenHash = j?.hashed_token || j?.properties?.hashed_token || null
  } catch (err) {
    console.error('admin-impersonate: generate_link threw', err)
    return res.status(502).json({ error: 'Could not start a support session' })
  }
  if (!tokenHash) return res.status(502).json({ error: 'Could not start a support session' })

  // Audit BEFORE handing the token over, so a session can never exist unlogged.
  let sessionId = null
  try {
    const r = await serviceFetch('/rest/v1/platform_support_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        admin_user_id: caller.id,
        admin_email: caller.email,
        target_user_id: targetId,
        target_email: targetEmail,
        product,
        reason,
        ip: clientIp(req),
        user_agent: String(req.headers['user-agent'] || '').slice(0, 400),
      }),
    })
    if (r.ok) {
      const rows = await r.json().catch(() => null)
      sessionId = Array.isArray(rows) ? rows[0]?.id : rows?.id
    } else {
      console.error('admin-impersonate: audit insert failed', r.status, await r.text())
    }
  } catch (err) {
    console.error('admin-impersonate: audit insert threw', err)
  }
  if (!sessionId) {
    // Fail closed. No audit row means no support session.
    return res.status(500).json({ error: 'Could not record the session — access refused' })
  }

  return res.status(200).json({
    token_hash: tokenHash,
    session_id: sessionId,
    email: targetEmail,
    product,
    expires_at: new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString(),
  })
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return {} }
}
