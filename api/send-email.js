// /api/send-email.js
// Vercel serverless function — sends invoice/notification email.
//
// TWO SEND PATHS:
//   1. User SMTP  — if the caller passes valid smtp{host,user,pass}, send via
//      their own mail server (nodemailer) so the email genuinely comes FROM
//      their address. This is what the Settings → Email tab configures.
//   2. Resend     — otherwise fall back to Alzaro's Resend domain
//      (invoices@alzaro.co.uk). Reliable default for users who haven't set up
//      their own email. Existing callers (TyreOps/GarageOps) pass no smtp and
//      are completely unaffected.
//
// Requires RESEND_API_KEY for path 2. SECURITY: requires a valid Supabase
// session token in the Authorization header.
import nodemailer from 'nodemailer'

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
    // --- End auth check ---

    const { to, subject, html, text, fromName, replyTo, attachments, smtp, requireSmtp } = req.body || {}
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' })
    }

    // Multi-company guard: when the caller requires SMTP (e.g. PropertyOps
    // invoices, where each company must send from its OWN address), refuse to
    // fall back to Alzaro's shared Resend address. A company's invoice must
    // never go out branded as invoices@alzaro.co.uk.
    if (requireSmtp && !(smtp && smtp.host && smtp.user && smtp.pass)) {
      return res.status(400).json({ error: 'Email not configured. Set up your business email in Settings → Email before sending.' })
    }

    // --- Path 1: user's own SMTP (send FROM their address) ---
    // Only taken when host, user and pass are all present. Anything missing or
    // a connection failure falls through to Resend below, so a send never
    // silently fails just because SMTP was misconfigured.
    if (smtp && smtp.host && smtp.user && smtp.pass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtp.host,
          port: Number(smtp.port) || 587,
          secure: smtp.secure === true || smtp.secure === 'true', // 465 = SSL, 587 = STARTTLS
          auth: { user: smtp.user, pass: smtp.pass },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
        })
        const fromEmail = smtp.fromEmail || smtp.user
        const info = await transporter.sendMail({
          from: `"${fromName || smtp.fromName || fromEmail}" <${fromEmail}>`,
          to,
          subject,
          html: html || undefined,
          text: text || undefined,
          replyTo: replyTo || smtp.replyTo || undefined,
          attachments: (Array.isArray(attachments) && attachments.length)
            ? attachments.map((a) => ({ filename: a.filename, content: a.content, encoding: 'base64' }))
            : undefined,
        })
        return res.status(200).json({ success: true, id: info.messageId, via: 'smtp' })
      } catch (err) {
        // Translate common SMTP failures; do NOT fall back to Resend here —
        // the user explicitly configured their own email, so a silent switch to
        // Alzaro's address would be misleading. Return a clear reason instead.
        let reason = err.message || 'SMTP send failed'
        const code = err.code || ''
        const responseCode = err.responseCode
        if (code === 'EAUTH' || responseCode === 535) {
          reason = 'Your email login was rejected. Gmail and Outlook require an "app password" here, not your normal password. Check Settings → Email.'
        } else if (code === 'EDNS' || code === 'ENOTFOUND') {
          reason = `Could not find your mail server "${smtp.host}" — check the SMTP host in Settings → Email.`
        } else if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
          reason = `Could not connect to ${smtp.host}:${smtp.port || 587} — check the port and security setting in Settings → Email.`
        } else if (responseCode === 550 || responseCode === 553) {
          reason = 'Your mail server refused the sender address — the "from" email must match the account you logged in with.'
        }
        console.error('send-email SMTP path failed:', code, responseCode, err.message)
        return res.status(422).json({ error: reason, detail: err.message, via: 'smtp' })
      }
    }
    // --- End Path 1 ---

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
        from: `${fromName || 'Alzaro TyreOps'} <invoices@alzaro.co.uk>`,
        to: [to],
        subject,
        html: html || undefined,
        text: text || undefined,
        reply_to: replyTo || undefined,
        // Optional attachments: [{ filename, content }] where content is base64.
        // Absent for all existing callers (TyreOps/GarageOps) — behaviour unchanged.
        attachments: (Array.isArray(attachments) && attachments.length) ? attachments : undefined,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error('Resend error:', data)
      // Translate common Resend failures into plain English so users see a real reason.
      const raw = data.message || data.error || 'Resend API error'
      const name = data.name || ''
      const lower = String(raw).toLowerCase()
      let reason = raw
      if (name === 'validation_error' && lower.includes('domain')) {
        reason = 'Your sending domain (alzaro.co.uk) is not verified in Resend, or this address is not allowed yet. Check the domain is verified in the Resend dashboard.'
      } else if (name === 'validation_error' && (lower.includes('to') || lower.includes('recipient') || lower.includes('email'))) {
        reason = `The recipient address looks invalid — check "${to}" for typos.`
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
