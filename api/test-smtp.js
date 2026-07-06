// /api/test-smtp.js
// Tests a user's SMTP details for real:
//   1. Connects + authenticates to their SMTP server (transporter.verify)
//   2. Sends a test email FROM their address TO their address
//
// NOTE: this endpoint DOES accept SMTP credentials in the body ON PURPOSE — its
// whole job is to validate the details the user just typed BEFORE they save
// them, so there is nothing yet in the database to resolve server-side. The
// credentials are used for this one connection and never stored here.
//
// SECURITY (see api/_netguard.js):
//   • Requires a valid Supabase session token AND an active product_members row.
//   • SSRF-guarded: refuses private/loopback/link-local hosts; connects by a
//     validated public IP with TLS servername pinned to the hostname.
//   • Per-user rate limiting (best-effort — see _netguard.js note).
//   • Failures return ONE generic reason (no host-reachability oracle).
import nodemailer from 'nodemailer'
import { resolveSafeAddress, rateLimit } from './_netguard.js'

const GENERIC_FAIL =
  'Could not connect and sign in to that mail server. Check the host, port, security setting, username and password.'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Auth + authorization ---
  let userId = null
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      'https://cxsaeftacozyphuejuxo.supabase.co'
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseAnonKey) {
      return res.status(500).json({ error: 'SUPABASE_ANON_KEY not set on server' })
    }

    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!authCheck.ok) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    try { userId = (await authCheck.json())?.id || null } catch (e) {}
    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }

    // Must hold an active product_members row (read with the caller's own token;
    // RLS returns only their rows). Stops a valid-token-but-not-a-customer
    // account from using this connector as an internal port-scanner.
    let isMember = false
    const mUrl =
      `${supabaseUrl}/rest/v1/product_members` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&status=in.(active,trial,trialing)&select=id&limit=1`
    const mRes = await fetch(mUrl, { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` } })
    if (mRes.ok) {
      const rows = await mRes.json().catch(() => [])
      isMember = Array.isArray(rows) && rows.length > 0
    }
    if (!isMember) {
      return res.status(403).json({ error: 'Your account is not active.' })
    }
  } catch (err) {
    console.error('test-smtp auth check failed:', err)
    return res.status(500).json({ error: 'Auth check failed' })
  }
  // --- End auth ---

  // --- Per-user rate limit ---
  const rl = rateLimit(`test:${userId}`, { max: 15, windowMs: 10 * 60 * 1000 })
  if (!rl.ok) {
    res.setHeader('Retry-After', String(rl.retryAfter))
    return res.status(429).json({ error: 'Too many test attempts — please wait a little and try again.' })
  }
  // --- End rate limit ---

  const { host, port, secure, user, pass, fromName } = req.body || {}
  if (!host || !user || !pass) {
    return res.status(400).json({
      error: 'Missing SMTP details — host, username and password are all required.',
    })
  }

  // SSRF guard: refuse private/loopback/link-local targets; connect by a
  // validated public IP with TLS pinned to the hostname. A single generic error
  // for any blocked/unresolvable host so it can't reveal internal reachability.
  let addr
  try {
    addr = await resolveSafeAddress(host)
  } catch {
    return res.status(422).json({ error: GENERIC_FAIL })
  }

  const transporter = nodemailer.createTransport({
    host: addr.ip,
    port: Number(port) || 587,
    secure: secure === true || secure === 'true', // true = SSL (465), false = STARTTLS (587)
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    tls: addr.servername ? { servername: addr.servername } : undefined,
  })
  try {
    // Step 1: connect + authenticate
    await transporter.verify()
    // Step 2: send a real test email from their address to their address
    const safeName = String(fromName || user).replace(/[\r\n"<>]/g, ' ').trim().slice(0, 120)
    const info = await transporter.sendMail({
      from: `"${safeName || user}" <${user}>`,
      to: user,
      subject: 'Test email — your email is connected ✓',
      text: `This test email was sent from ${user}. Your email service is connected and invoices will be sent from this address.`,
    })
    return res.status(200).json({ success: true, messageId: info.messageId })
  } catch (err) {
    // GENERIC only — no differentiation between auth vs DNS vs timeout, which
    // would otherwise leak whether an arbitrary host:port is reachable.
    console.error('SMTP test failed:', err.code, err.responseCode, err.message)
    return res.status(422).json({ error: GENERIC_FAIL })
  }
}
