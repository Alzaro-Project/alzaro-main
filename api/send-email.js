// /api/send-email.js
// Vercel serverless function — sends email via Resend API.
// Requires RESEND_API_KEY set in Vercel environment variables (server-side, no VITE_ prefix).
// SECURITY: requires a valid Supabase session token in the Authorization header.

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

    const { to, subject, html, text, fromName, replyTo, attachments } = req.body || {}
    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' })
    }
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
