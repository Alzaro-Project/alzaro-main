// ============================================================
// EMAIL SERVICE — sends from THE GARAGE'S OWN EMAIL ACCOUNT
// ============================================================
//
// White-label rule: TyreOps NEVER sends customer email from an Alzaro
// address. Every invoice and follow-up leaves from the garage's own mail
// server, using the SMTP details they enter in Settings -> Email.
//
// How it works:
//   • The garage saves their SMTP details (host / port / user / password /
//     from address) in Settings. They are stored per-garage in Supabase.
//   • This file posts to /api/send-email with `requireSmtp: true` and
//     `product: 'tyreops'`. The server looks the credentials up ITSELF from
//     that garage's row — they are never sent from the browser, and there is
//     no fallback to a shared Alzaro address.
//   • If the garage has NOT set their email up yet, we do not send at all.
//     The UI falls back to opening their own Gmail / mail client with the
//     invoice pre-filled, so it still goes out from their real address.
// ============================================================

import { supabase } from './supabase'

// ============================================================
// AUTH HELPER
// ============================================================

/**
 * Get the current user's access token for authenticated API calls.
 * /api/send-email rejects requests that don't come from a logged-in user.
 */
async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

// ============================================================
// SMTP PROVIDER PRESETS
// ============================================================
// Shown in Settings -> Email so a garage can pick their provider instead of
// typing host/port by hand.

export const SMTP_PRESETS = {
  gmail: {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    notes: 'Requires App Password (not regular password). Enable 2FA first, then generate App Password at https://myaccount.google.com/apppasswords',
  },
  gmail_ssl: {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    notes: 'SSL connection. Requires App Password.',
  },
  outlook: {
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    notes: 'Use your Microsoft 365 email. May require App Password if 2FA enabled.',
  },
  yahoo: {
    host: 'smtp.mail.yahoo.com',
    port: 587,
    secure: false,
    notes: 'Requires App Password. Generate at https://login.yahoo.com/account/security',
  },
  zoho: {
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    notes: 'Use Zoho Mail credentials. Enable SMTP access in Zoho settings.',
  },
  sendgrid: {
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    notes: 'Username is "apikey" (literal). Password is your SendGrid API key.',
  },
  mailgun: {
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    notes: 'Find SMTP credentials in Mailgun dashboard under Domain Settings.',
  },
  aws_ses: {
    host: 'email-smtp.eu-west-1.amazonaws.com', // Change region as needed
    port: 587,
    secure: false,
    notes: 'Use SMTP credentials from AWS SES console (not IAM keys). Verify sender email/domain first.',
  },
  postmark: {
    host: 'smtp.postmarkapp.com',
    port: 587,
    secure: false,
    notes: 'Username and password are both your Server API Token.',
  },
  mailjet: {
    host: 'in-v3.mailjet.com',
    port: 587,
    secure: false,
    notes: 'Username is API Key, password is Secret Key.',
  },
  custom: {
    host: '',
    port: 587,
    secure: false,
    notes: 'Enter your mail server details manually.',
  },
}

// ============================================================
// SMTP VALIDATION HELPERS
// ============================================================

/**
 * Has this garage set up their own sending email?
 *
 * Deliberately checks host + username only, NOT the password: once the
 * at-rest encryption migration is applied the password is no longer readable
 * by the browser, and the server does the real validation anyway.
 *
 * @param {object} settings - the garage settings object from the store
 */
export function isSmtpConfigured(settings) {
  return !!(settings && settings.smtpHost && settings.smtpUser)
}

/**
 * Get SMTP preset by provider name
 */
export function getSmtpPreset(provider) {
  return SMTP_PRESETS[provider] || SMTP_PRESETS.custom
}

/** The name a customer sees in the From field. Always the garage, never us. */
export function senderName(settings = {}) {
  return settings.smtpFromName || settings.emailFromName || settings.name || ''
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

export function generateInvoiceEmailHTML(invoice, settings, lines, totals) {
  const { custName, custEmail, id, date, due, reg, notes } = invoice
  const { name: garageName, addr, city, post, phone, email: garageEmail, vatNumber } = settings
  const { subtotal, vat, total } = totals

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: 800; }
    .logo span { color: #f5c842; }
    .invoice-details { text-align: right; }
    .invoice-number { font-size: 20px; color: #f5c842; font-family: monospace; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .customer-info { background: #f5f5f5; padding: 16px; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { text-align: left; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px; border-bottom: 2px solid #eee; }
    td { padding: 12px 10px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 200px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .totals-row.total { font-size: 16px; font-weight: 700; border-top: 2px solid #333; margin-top: 8px; padding-top: 12px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
    .payment-info { background: #fffbeb; border: 1px solid #f5c842; border-radius: 8px; padding: 16px; margin-top: 24px; }
    .payment-title { font-weight: 600; color: #92400e; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${settings.logoUrl
        ? `<img src="${settings.logoUrl}" alt="${garageName}" style="max-height: 64px; max-width: 220px; object-fit: contain; display: block; margin-bottom: 6px;" />`
        : `<div class="logo">${garageName || ''}</div>`}
      <div style="font-size: 13px; color: #666; margin-top: 4px;">
        ${garageName}<br>
        ${addr}${city ? ', ' + city : ''}${post ? ' ' + post : ''}<br>
        ${phone || ''}${garageEmail ? ' · ' + garageEmail : ''}
        ${vatNumber ? '<br>VAT: ' + vatNumber : ''}
      </div>
    </div>
    <div class="invoice-details">
      <div class="invoice-number">${id}</div>
      <div style="font-size: 12px; color: #666; margin-top: 8px;">
        Date: ${date}<br>
        Due: ${due}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bill To</div>
    <div class="customer-info">
      <strong>${custName}</strong><br>
      ${custEmail || ''}
      ${reg ? '<br>Vehicle Reg: ' + reg : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lines.map(l => `
        <tr>
          <td>${l.desc}</td>
          <td class="text-right">${l.qty}</td>
          <td class="text-right">£${l.unit.toFixed(2)}</td>
          <td class="text-right">£${(l.qty * l.unit).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>£${subtotal.toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>VAT</span>
      <span>£${vat.toFixed(2)}</span>
    </div>
    <div class="totals-row total">
      <span>Total</span>
      <span>£${total.toFixed(2)}</span>
    </div>
  </div>

  ${notes ? `
  <div class="section" style="margin-top: 24px;">
    <div class="section-title">Notes</div>
    <p style="color: #666;">${notes}</p>
  </div>
  ` : ''}

  <div class="payment-info">
    <div class="payment-title">Payment Information</div>
    <div style="font-size: 13px;">
      ${settings.emailFooter
        ? String(settings.emailFooter).replace(/\n/g, '<br>')
        : `Please make payment within the due date. For any queries, contact us at ${garageEmail || phone || 'the garage'}.`}
    </div>
  </div>

  <div class="footer">
    ${garageName}${vatNumber ? ' · VAT: ' + vatNumber : ''}
  </div>
</body>
</html>
`
}

export function generateInvoiceEmailText(invoice, settings, lines, totals) {
  const { custName, id, date, due, reg } = invoice
  const { name: garageName } = settings
  const { subtotal, vat, total } = totals

  let text = `
INVOICE ${id}
From: ${garageName}
Date: ${date}
Due: ${due}

Bill To: ${custName}
${reg ? 'Vehicle: ' + reg : ''}

ITEMS:
${lines.map(l => `- ${l.desc} (x${l.qty}) @ £${l.unit.toFixed(2)} = £${(l.qty * l.unit).toFixed(2)}`).join('\n')}

Subtotal: £${subtotal.toFixed(2)}
VAT: £${vat.toFixed(2)}
TOTAL: £${total.toFixed(2)}

${settings.emailFooter || 'Thank you for your business!'}
`
  return text.trim()
}

// ============================================================
// EMAIL SENDING
// ============================================================

/**
 * Send through the garage's OWN mail server.
 *
 * Credentials are never sent from the browser — the server resolves them
 * from this garage's saved settings using the caller's session token.
 * Fails closed: if the garage hasn't configured email, the server returns a
 * clear error rather than sending from a shared address.
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendViaOwnSmtp({ to, subject, html, text, fromName, replyTo, attachments }) {
  const token = await getAccessToken()
  if (!token) return { success: false, error: 'You must be logged in to send email' }

  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to,
        subject,
        html: html || undefined,
        text: text || undefined,
        fromName: fromName || undefined,
        replyTo: replyTo || undefined,
        attachments: attachments || undefined,
        product: 'tyreops',
        requireSmtp: true,   // never fall back to a shared Alzaro address
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return { success: false, error: err.error || err.message || 'Failed to send email' }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message || 'Failed to send email' }
  }
}

/**
 * Send an arbitrary email from the garage's own address.
 * Used by the customer follow-up feature.
 *
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function sendCustomEmail({ to, subject, html, text, fromName, replyTo }) {
  if (!to) return { success: false, error: 'No recipient email address' }
  if (!subject || (!html && !text)) {
    return { success: false, error: 'Email needs a subject and a body' }
  }
  return sendViaOwnSmtp({ to, subject, html, text, fromName, replyTo })
}

/** Wrap a plain-text body in a minimal branded HTML shell for deliverability. */
export function plainToHtml(text, settings = {}) {
  const safe = String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
<div style="font-size:14px;">${safe}</div>
<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">${settings.name || ''}${settings.phone ? ' &middot; ' + settings.phone : ''}</div>
</body></html>`
}

/**
 * Fallback: Open Gmail compose with pre-filled content
 */
export function openGmailCompose(toEmail, subject, body) {
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.open(gmailUrl, '_blank')
}

/**
 * Fallback: Open default mail client
 */
export function openMailto(toEmail, subject, body) {
  window.location.href = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// ============================================================
// MAIN SEND FUNCTION
// ============================================================

/**
 * Send an invoice email FROM THE GARAGE'S OWN ADDRESS.
 *
 * Two outcomes only — there is no shared-Alzaro path:
 *   1. Garage has email set up  -> send via their SMTP server.
 *   2. Garage has NOT set it up -> return needsManualSend, and the UI shows a
 *      preview they can push through their own Gmail / mail client.
 *
 * Returns { success, method, error?, needsManualSend? }
 */
export async function sendInvoiceEmail(invoice, settings, lines, totals, preferredMethod = null) {
  const { custEmail, custName, id } = invoice

  if (!custEmail) {
    return { success: false, error: 'No customer email address' }
  }

  const garageName = settings.name || 'your garage'
  const subject = `Invoice ${id} from ${garageName}`
  const htmlContent = generateInvoiceEmailHTML(invoice, settings, lines, totals)
  const textContent = generateInvoiceEmailText(invoice, settings, lines, totals)

  // Explicit manual-send choices from the preview screen
  if (preferredMethod === 'gmail') {
    openGmailCompose(custEmail, subject, textContent)
    return { success: true, method: 'gmail_compose', note: 'Opened Gmail compose window' }
  }
  if (preferredMethod === 'mailto') {
    openMailto(custEmail, subject, textContent)
    return { success: true, method: 'mailto', note: 'Opened default mail client' }
  }

  // Not set up yet — do NOT send from a shared address. Offer manual send.
  if (!isSmtpConfigured(settings)) {
    return {
      success: true,
      method: 'gmail_compose',
      needsManualSend: true,
      note: 'Set up your own email in Settings -> Email to send invoices automatically.',
    }
  }

  const result = await sendViaOwnSmtp({
    to: custEmail,
    subject,
    html: htmlContent,
    text: textContent,
    fromName: senderName(settings),
    replyTo: settings.smtpReplyTo || settings.emailReplyTo || settings.email || undefined,
  })

  if (result.success) return { success: true, method: 'smtp' }

  // Real failure (bad password, server down). Surface it — silently rerouting
  // through an Alzaro address is exactly what we are removing.
  return { success: false, method: 'smtp', error: result.error }
}
