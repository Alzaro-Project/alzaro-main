// /api/send-email.js
// Vercel serverless function — sends invoice/notification email.
//
// TWO SEND PATHS:
//   1. Own-domain SMTP — taken when the caller passes `requireSmtp: true` with a
//      `product` that has server-side SMTP wired up (currently PropertyOps). The
//      SMTP credentials are resolved SERVER-SIDE from that product's settings
//      table, keyed by the validated caller's user_id — they are NO LONGER
//      accepted from the request body. This is how PropertyOps invoices go out
//      FROM the company's own address.
//   2. Resend — the shared fallback (invoices@alzaro.co.uk) used by TyreOps and
//      ServiceOps. Guarded: the caller must be authenticated AND hold an active
//      product_members row before we will send from the shared Alzaro domain.
//
// SECURITY (see also api/_netguard.js):
//   • Requires a valid Supabase session token.
//   • Requires an active product_members row (no open relay from alzaro.co.uk).
//   • `to` is validated; `fromName` is sanitised (no header injection).
//   • SMTP host is SSRF-checked (no private/loopback/link-local targets) and we
//     connect by validated IP with TLS servername pinned to the hostname.
//   • Per-user rate limiting (best-effort, see _netguard.js note).
//   • SMTP failures return ONE generic reason (no host-reachability oracle).
//
// Requires RESEND_API_KEY for path 2.
import nodemailer from 'nodemailer'
import { resolveSafeAddress, rateLimit, isValidEmail, sanitizeHeader } from './_netguard.js'

// Products with server-side SMTP wired up: product -> { table, columns }.
// PropertyOps and SoloOps send their own-domain SMTP. To add another vertical,
// map it to its settings table here (its SMTP columns must match this shape,
// i.e. it must expose every column in SMTP_COLS below).
//
// SoloOps note: sole traders invoice their own clients, so they send FROM their
// own address — SoloOps callers pass requireSmtp:true and never fall back to
// the shared invoices@alzaro.co.uk Resend path.
const SMTP_PRODUCTS = {
  propertyops: { table: 'prop_settings', secretRpc: 'prop_smtp_secret' },
  soloops: { table: 'soloops_settings', secretRpc: 'soloops_smtp_secret' },
}

// Default Resend "From" display name per product, used only when the caller
// doesn't pass its own fromName. Neutral "Alzaro" for everyone except TyreOps,
// which historically sent as "Alzaro TyreOps" (special-cased to preserve it).
const PRODUCT_SENDER = {
  tyreops: 'Alzaro TyreOps',
}
function defaultSender(product) {
  return PRODUCT_SENDER[String(product || '')] || 'Alzaro'
}

const SMTP_COLS = 'smtp_host,smtp_port,smtp_secure,smtp_user,smtp_pass,smtp_from_name,smtp_from_email,smtp_reply_to'

function resolveSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://cxsaeftacozyphuejuxo.supabase.co'
  )
}

// Read one row from a settings table scoped to the caller (their own token, so
// RLS returns only their row — no service-role needed, ownership is inherent).
async function readOwnSettings({ supabaseUrl, anonKey, token, table, userId, cols }) {
  const url =
    `${supabaseUrl}/rest/v1/${table}` +
    `?user_id=eq.${encodeURIComponent(userId)}&select=${cols}&limit=1`
  const r = await fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const rows = await r.json().catch(() => [])
  return rows?.[0] || null
}

// Fetch the decrypted SMTP password via a SECURITY DEFINER RPC that returns only
// the caller's own row (see PropertyOps/sql/03_encrypt_smtp_pass_at_rest.sql).
// Returns null if the RPC isn't deployed yet — the caller then falls back to the
// plaintext column, so this rollout has no downtime window.
async function callSecretRpc({ supabaseUrl, anonKey, token, fn }) {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!r.ok) return null
    const v = await r.json().catch(() => null)
    return (typeof v === 'string' && v) ? v : null // RPC returns a scalar text
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // --- Auth check: only logged-in users may send email ---
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const supabaseUrl = resolveSupabaseUrl()
    const supabaseAnonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY
    if (!supabaseAnonKey) {
      return res.status(500).json({ error: 'SUPABASE_ANON_KEY not set on server' })
    }

    // Ask Supabase directly whether this token belongs to a real, logged-in user
    const authCheck = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
    })
    if (!authCheck.ok) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    let userId = null
    try { userId = (await authCheck.json())?.id || null } catch (e) {}
    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired session' })
    }
    // --- End auth check ---

    // --- Authorization: caller must hold an active product_members row ---
    // Closes the open-relay: a valid-token-but-not-a-customer account (or a
    // suspended one) can NOT send — least of all from the shared Alzaro domain.
    // Read with the caller's own token; RLS returns only their membership rows.
    let isMember = false
    try {
      const mUrl =
        `${supabaseUrl}/rest/v1/product_members` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&status=in.(active,trial,trialing)&select=id&limit=1`
      const mRes = await fetch(mUrl, { headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` } })
      if (mRes.ok) {
        const rows = await mRes.json().catch(() => [])
        isMember = Array.isArray(rows) && rows.length > 0
      }
    } catch (e) { /* fail closed below */ }
    if (!isMember) {
      return res.status(403).json({ error: 'Your account is not active. Email sending is disabled.' })
    }
    // --- End authorization ---

    // --- Per-user rate limit ---
    const rl = rateLimit(`send:${userId}`, { max: 30, windowMs: 10 * 60 * 1000 })
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retryAfter))
      return res.status(429).json({ error: 'Too many emails sent recently — please wait a little and try again.' })
    }
    // --- End rate limit ---

    const { to, subject, html, text, fromName, replyTo, attachments, product, requireSmtp } = req.body || {}
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' })
    }
    // Never trust `to`/`fromName` blindly: validate the recipient and strip any
    // header-injection characters from the display name.
    if (!isValidEmail(to)) {
      return res.status(400).json({ error: 'Recipient email address looks invalid.' })
    }
    const recipient = String(to).trim()
    const safeFromName = sanitizeHeader(fromName)

    // ========================================================================
    // Path 1: own-domain SMTP (credentials resolved SERVER-SIDE, never trusted
    // from the body). Taken when the caller asks for it via requireSmtp + a
    // product that has server-side SMTP wired up.
    // ========================================================================
    if (requireSmtp) {
      const map = product && SMTP_PRODUCTS[String(product)]
      if (!map) {
        // Fail closed: we will NOT fall back to the shared Alzaro address for a
        // requireSmtp request — that's the whole point of requireSmtp.
        return res.status(400).json({ error: 'Email sending is not configured for this product.' })
      }
      const cfg = await readOwnSettings({
        supabaseUrl, anonKey: supabaseAnonKey, token,
        table: map.table, userId, cols: SMTP_COLS,
      })
      if (!cfg || !cfg.smtp_host || !cfg.smtp_user) {
        return res.status(400).json({ error: 'Email not configured. Set up your business email in Settings → Email before sending.' })
      }
      // Password: prefer the encrypted-at-rest value via the decrypt RPC; fall
      // back to the plaintext column when the encryption migration isn't in place
      // yet (keeps the rollout seamless). Never accepted from the request body.
      let smtpPass = null
      if (map.secretRpc) {
        smtpPass = await callSecretRpc({ supabaseUrl, anonKey: supabaseAnonKey, token, fn: map.secretRpc })
      }
      if (!smtpPass) smtpPass = cfg.smtp_pass || null
      if (!smtpPass) {
        return res.status(400).json({ error: 'Email not configured. Set up your business email in Settings → Email before sending.' })
      }
      // Gmail-only normalisation: Google displays App Passwords as
      // "xxxx xxxx xxxx xxxx" and users paste them that way. Newer app builds
      // strip the spaces on save, but rows saved by older builds may still hold
      // them — Gmail then rejects the login (EAUTH 535). Stripping here makes
      // those rows work without a re-save. Scoped to Google hosts only so a
      // legitimately space-containing password on another provider is untouched.
      {
        const hostLc = String(cfg.smtp_host || '').trim().toLowerCase()
        if (hostLc.endsWith('gmail.com') || hostLc.endsWith('googlemail.com')) {
          smtpPass = String(smtpPass).replace(/\s+/g, '')
        }
      }

      // SSRF guard: refuse private/loopback/link-local targets; connect by a
      // validated public IP with TLS pinned to the real hostname.
      let addr
      try {
        addr = await resolveSafeAddress(cfg.smtp_host)
      } catch {
        return res.status(422).json({ error: 'Could not send — check your email server settings in Settings → Email.' })
      }

      try {
        const transporter = nodemailer.createTransport({
          host: addr.ip,
          port: Number(cfg.smtp_port) || 587,
          secure: cfg.smtp_secure === true || cfg.smtp_secure === 'true',
          auth: { user: cfg.smtp_user, pass: smtpPass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          tls: addr.servername ? { servername: addr.servername } : undefined,
        })
        const fromEmail = cfg.smtp_from_email || cfg.smtp_user
        const fromDisplay = safeFromName || sanitizeHeader(cfg.smtp_from_name) || fromEmail
        const info = await transporter.sendMail({
          from: `"${fromDisplay}" <${fromEmail}>`,
          to: recipient,
          subject,
          html: html || undefined,
          text: text || undefined,
          replyTo: (typeof replyTo === 'string' && isValidEmail(replyTo)) ? replyTo
            : (cfg.smtp_reply_to && isValidEmail(cfg.smtp_reply_to)) ? cfg.smtp_reply_to
            : undefined,
          attachments: (Array.isArray(attachments) && attachments.length)
            ? attachments.map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64' }))
            : undefined,
        })
        return res.status(200).json({ success: true, id: info.messageId, via: 'smtp' })
      } catch (err) {
        // GENERIC reason only — do not differentiate EAUTH / ENOTFOUND /
        // ETIMEDOUT etc., so this can't be used as a host-reachability oracle.
        console.error('send-email SMTP path failed:', err.code, err.responseCode, err.message)
        return res.status(422).json({
          error: 'Could not send the email. Check your email server host, port, security setting, username and password in Settings → Email.',
          via: 'smtp',
        })
      }
    }
    // --- End Path 1 ---

    // ========================================================================
    // Path 2: Resend fallback (shared invoices@alzaro.co.uk). Reached only after
    // the membership check above, so it is no longer an open relay.
    // ========================================================================
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY not set on server' })
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${safeFromName || defaultSender(product)} <invoices@alzaro.co.uk>`,
        to: [recipient],
        subject,
        html: html || undefined,
        text: text || undefined,
        reply_to: (typeof replyTo === 'string' && isValidEmail(replyTo)) ? replyTo : undefined,
        attachments: (Array.isArray(attachments) && attachments.length) ? attachments : undefined,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error('Resend error:', data)
      // Translate common Resend failures into plain English. (These concern
      // Alzaro's own fixed Resend service, not an arbitrary user-supplied host,
      // so they are not a reachability oracle.)
      const raw = data.message || data.error || 'Resend API error'
      const name = data.name || ''
      const lower = String(raw).toLowerCase()
      let reason = raw
      if (name === 'validation_error' && lower.includes('domain')) {
        reason = 'Your sending domain (alzaro.co.uk) is not verified in Resend, or this address is not allowed yet. Check the domain is verified in the Resend dashboard.'
      } else if (name === 'validation_error' && (lower.includes('to') || lower.includes('recipient') || lower.includes('email'))) {
        reason = `The recipient address looks invalid — check "${recipient}" for typos.`
      } else if (response.status === 401 || name === 'unauthorized' || lower.includes('api key')) {
        reason = 'Email service rejected the API key. RESEND_API_KEY may be missing or wrong in the server settings.'
      } else if (response.status === 429 || name === 'rate_limit_exceeded' || lower.includes('rate limit')) {
        reason = 'Too many emails sent in a short time — wait a moment and try again.'
      } else if (lower.includes('attachment')) {
        reason = 'The attachment was rejected — it may be too large or an unsupported file type.'
      }
      return res.status(response.status).json({ error: reason, detail: raw })
    }
    return res.status(200).json({ success: true, id: data.id })
  } catch (err) {
    console.error('send-email failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
