// /api/test-smtp.js
// Tests a garage's SMTP details for real:
//   1. Connects + authenticates to their SMTP server (transporter.verify)
//   2. Sends a test email FROM their address TO their address
// Returns specific, human-readable reasons when it fails.
// SECURITY: requires a valid Supabase session token in the Authorization header.
import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // --- Auth check: only logged-in users may test SMTP ---
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
  } catch (err) {
    console.error('test-smtp auth check failed:', err)
    return res.status(500).json({ error: 'Auth check failed: ' + err.message })
  }
  // --- End auth check ---

  const { host, port, secure, user, pass, fromName } = req.body || {}
  if (!host || !user || !pass) {
    return res.status(400).json({
      error: 'Missing SMTP details — host, username and password are all required.',
    })
  }
  if (/^imap\./i.test(host)) {
    return res.status(400).json({
      error: `"${host}" is an IMAP server (for receiving mail). Sending needs an SMTP server — it usually starts with "smtp." (e.g. smtp-mail.outlook.com, smtp.gmail.com).`,
    })
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port) || 587,
    secure: secure === true || secure === 'true', // true = SSL (465), false = STARTTLS (587)
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  })
  try {
    // Step 1: connect + authenticate
    await transporter.verify()
    // Step 2: send a real test email from their address to their address
    const info = await transporter.sendMail({
      from: `"${fromName || user}" <${user}>`,
      to: user,
      subject: 'Test email — your email is connected ✓',
      text: `This test email was sent from ${user} via ${host}. Your email service is connected and invoices will be sent from this address.`,
    })
    return res.status(200).json({ success: true, messageId: info.messageId })
  } catch (err) {
    // Translate common SMTP failures into plain English
    let reason = err.message || 'Unknown error'
    const code = err.code || ''
    const responseCode = err.responseCode
    if (code === 'EAUTH' || responseCode === 535) {
      reason = 'Authentication failed — username or password rejected. Gmail and Outlook/Hotmail require an "app password" here, not your normal login password.'
    } else if (code === 'EDNS' || code === 'ENOTFOUND') {
      reason = `Could not find the server "${host}" — check the SMTP host for typos.`
    } else if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
      reason = `Could not connect to ${host}:${port || 587} — check the port (587 for TLS, 465 for SSL) and security setting.`
    } else if (responseCode === 550 || responseCode === 553) {
      reason = 'The server refused the sender address — the "from" email may not match the account you logged in with.'
    }
    console.error('SMTP test failed:', code, responseCode, err.message)
    return res.status(422).json({ error: reason, detail: err.message })
  }
}
