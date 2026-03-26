// ============================================================
// EMAIL SERVICE - SMTP Configuration
// ============================================================
// 
// For SMTP to work, you need to set up a Vercel Edge Function or 
// Supabase Edge Function. Browser JavaScript cannot send SMTP directly.
//
// OPTION 1: Use EmailJS (easiest - no backend needed)
// OPTION 2: Use Resend API (better deliverability)
// OPTION 3: Set up Vercel Edge Function with Nodemailer
// OPTION 4: Direct SMTP via Edge Function (Gmail, Outlook, custom)
//
// This file provides the client-side interface for all options.
// ============================================================

// Email configuration - set these in your environment or Settings
const EMAIL_CONFIG = {
  // For EmailJS (free tier: 200 emails/month)
  EMAILJS_SERVICE_ID: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
  EMAILJS_TEMPLATE_ID: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
  EMAILJS_PUBLIC_KEY: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '',
  
  // For Resend API (if using Edge Function)
  RESEND_API_KEY: import.meta.env.VITE_RESEND_API_KEY || '',
  
  // Your garage's sending email (configured in SMTP)
  FROM_EMAIL: import.meta.env.VITE_FROM_EMAIL || 'invoices@alzaro.co.uk',
  FROM_NAME: import.meta.env.VITE_FROM_NAME || 'Alzaro TyreOps',
}

// ============================================================
// SMTP CONFIGURATION
// ============================================================
// 
// These settings are passed to your backend/Edge Function.
// NEVER expose credentials in frontend code - store in environment variables.
//
// Common SMTP hosts:
// - Gmail:        smtp.gmail.com (port 587, TLS) or (port 465, SSL)
// - Outlook/365:  smtp.office365.com (port 587, TLS)
// - Yahoo:        smtp.mail.yahoo.com (port 587, TLS)
// - SendGrid:     smtp.sendgrid.net (port 587, TLS)
// - Mailgun:      smtp.mailgun.org (port 587, TLS)
// - AWS SES:      email-smtp.{region}.amazonaws.com (port 587, TLS)
// - Zoho:         smtp.zoho.com (port 587, TLS)
// ============================================================

export const SMTP_CONFIG = {
  // SMTP Server Settings
  host: import.meta.env.VITE_SMTP_HOST || '',
  port: parseInt(import.meta.env.VITE_SMTP_PORT) || 587,
  secure: import.meta.env.VITE_SMTP_SECURE === 'true', // true for 465 (SSL), false for 587 (TLS/STARTTLS)
  
  // Authentication
  auth: {
    user: import.meta.env.VITE_SMTP_USER || '',
    pass: import.meta.env.VITE_SMTP_PASS || '',
  },
  
  // Sender Details
  from: {
    name: import.meta.env.VITE_SMTP_FROM_NAME || 'Alzaro TyreOps',
    email: import.meta.env.VITE_SMTP_FROM_EMAIL || '',
  },
  
  // Optional: Reply-to address (if different from sender)
  replyTo: import.meta.env.VITE_SMTP_REPLY_TO || '',
  
  // TLS Options (for self-signed certs or specific requirements)
  tls: {
    rejectUnauthorized: import.meta.env.VITE_SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
  },
}

// ============================================================
// SMTP PROVIDER PRESETS
// ============================================================
// Use these to quickly configure common providers

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
 * Check if SMTP is configured
 */
export function isSmtpConfigured() {
  return !!(SMTP_CONFIG.host && SMTP_CONFIG.auth.user && SMTP_CONFIG.auth.pass)
}

/**
 * Validate SMTP configuration
 * Returns { valid: boolean, errors: string[] }
 */
export function validateSmtpConfig(config = SMTP_CONFIG) {
  const errors = []
  
  if (!config.host) {
    errors.push('SMTP host is required')
  }
  
  if (!config.port || config.port < 1 || config.port > 65535) {
    errors.push('Valid SMTP port is required (typically 587 or 465)')
  }
  
  if (!config.auth?.user) {
    errors.push('SMTP username/email is required')
  }
  
  if (!config.auth?.pass) {
    errors.push('SMTP password/app password is required')
  }
  
  if (!config.from?.email) {
    errors.push('Sender email address is required')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.from.email)) {
    errors.push('Sender email address is invalid')
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get SMTP preset by provider name
 */
export function getSmtpPreset(provider) {
  return SMTP_PRESETS[provider] || SMTP_PRESETS.custom
}

/**
 * Build SMTP config from preset + credentials
 */
export function buildSmtpConfig(provider, credentials) {
  const preset = getSmtpPreset(provider)
  
  return {
    host: preset.host || credentials.host,
    port: preset.port || credentials.port || 587,
    secure: preset.secure ?? credentials.secure ?? false,
    auth: {
      user: credentials.user || credentials.email,
      pass: credentials.pass || credentials.password,
    },
    from: {
      name: credentials.fromName || 'Alzaro TyreOps',
      email: credentials.fromEmail || credentials.user || credentials.email,
    },
    replyTo: credentials.replyTo || '',
    tls: {
      rejectUnauthorized: credentials.tlsRejectUnauthorized !== false,
    },
  }
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
      <div class="logo">Alzaro<span>TyreOps</span></div>
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
      Please make payment within the due date. For any queries, contact us at ${garageEmail || phone || 'the garage'}.
    </div>
  </div>

  <div class="footer">
    Invoice generated by Alzaro TyreOps<br>
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

Thank you for your business!
`
  return text.trim()
}

// ============================================================
// EMAIL SENDING METHODS
// ============================================================

/**
 * Send invoice via EmailJS (recommended for simplicity)
 * Set up at https://www.emailjs.com/
 */
export async function sendViaEmailJS(toEmail, toName, subject, htmlContent, textContent) {
  if (!EMAIL_CONFIG.EMAILJS_SERVICE_ID || !EMAIL_CONFIG.EMAILJS_PUBLIC_KEY) {
    throw new Error('EmailJS not configured. Set VITE_EMAILJS_SERVICE_ID and VITE_EMAILJS_PUBLIC_KEY in your environment.')
  }

  // Load EmailJS dynamically
  if (!window.emailjs) {
    await loadScript('https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js')
    window.emailjs.init(EMAIL_CONFIG.EMAILJS_PUBLIC_KEY)
  }

  const templateParams = {
    to_email: toEmail,
    to_name: toName,
    subject: subject,
    message_html: htmlContent,
    message_text: textContent,
    from_name: EMAIL_CONFIG.FROM_NAME,
  }

  const response = await window.emailjs.send(
    EMAIL_CONFIG.EMAILJS_SERVICE_ID,
    EMAIL_CONFIG.EMAILJS_TEMPLATE_ID,
    templateParams
  )

  return response
}

/**
 * Send via Resend API (requires Edge Function)
 * You'll need to create an API route to handle this
 */
export async function sendViaResend(toEmail, toName, subject, htmlContent) {
  const response = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: toEmail,
      toName,
      subject,
      html: htmlContent,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to send email')
  }

  return response.json()
}

/**
 * Send via SMTP (requires Edge Function with Nodemailer)
 * Pass SMTP config to your backend endpoint
 */
export async function sendViaSmtp(toEmail, toName, subject, htmlContent, textContent, smtpConfig = SMTP_CONFIG) {
  // Validate config before sending
  const validation = validateSmtpConfig(smtpConfig)
  if (!validation.valid) {
    throw new Error(`SMTP configuration invalid: ${validation.errors.join(', ')}`)
  }

  const response = await fetch('/api/send-smtp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      smtp: {
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        // Note: In production, don't send credentials from frontend!
        // Store them server-side and reference by key/ID
      },
      email: {
        from: `"${smtpConfig.from.name}" <${smtpConfig.from.email}>`,
        to: toEmail,
        toName,
        subject,
        html: htmlContent,
        text: textContent,
        replyTo: smtpConfig.replyTo || undefined,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to send email via SMTP')
  }

  return response.json()
}

/**
 * Test SMTP connection
 * Returns { success: boolean, error?: string }
 */
export async function testSmtpConnection(smtpConfig = SMTP_CONFIG) {
  const validation = validateSmtpConfig(smtpConfig)
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') }
  }

  try {
    const response = await fetch('/api/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        // Credentials should be stored server-side
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || 'Connection test failed' }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
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
 * Send an invoice email using the best available method
 * Priority: SMTP > EmailJS > Resend > Gmail fallback
 * Returns { success: boolean, method: string, error?: string }
 */
export async function sendInvoiceEmail(invoice, settings, lines, totals, preferredMethod = null) {
  const { custEmail, custName, id } = invoice
  
  if (!custEmail) {
    return { success: false, error: 'No customer email address' }
  }

  const subject = `Invoice ${id} from ${settings.name || 'Alzaro TyreOps'}`
  const htmlContent = generateInvoiceEmailHTML(invoice, settings, lines, totals)
  const textContent = generateInvoiceEmailText(invoice, settings, lines, totals)

  // If a preferred method is specified, try only that
  if (preferredMethod) {
    try {
      switch (preferredMethod) {
        case 'smtp':
          await sendViaSmtp(custEmail, custName, subject, htmlContent, textContent)
          return { success: true, method: 'smtp' }
        case 'emailjs':
          await sendViaEmailJS(custEmail, custName, subject, htmlContent, textContent)
          return { success: true, method: 'emailjs' }
        case 'resend':
          await sendViaResend(custEmail, custName, subject, htmlContent)
          return { success: true, method: 'resend' }
        case 'gmail':
          openGmailCompose(custEmail, subject, textContent)
          return { success: true, method: 'gmail_compose', note: 'Opened Gmail compose window' }
        case 'mailto':
          openMailto(custEmail, subject, textContent)
          return { success: true, method: 'mailto', note: 'Opened default mail client' }
      }
    } catch (err) {
      return { success: false, method: preferredMethod, error: err.message }
    }
  }

  // Try SMTP first (if configured)
  if (isSmtpConfigured()) {
    try {
      await sendViaSmtp(custEmail, custName, subject, htmlContent, textContent)
      return { success: true, method: 'smtp' }
    } catch (err) {
      console.error('SMTP failed:', err)
      // Fall through to next method
    }
  }

  // Try EmailJS (if configured)
  if (EMAIL_CONFIG.EMAILJS_SERVICE_ID && EMAIL_CONFIG.EMAILJS_PUBLIC_KEY) {
    try {
      await sendViaEmailJS(custEmail, custName, subject, htmlContent, textContent)
      return { success: true, method: 'emailjs' }
    } catch (err) {
      console.error('EmailJS failed:', err)
      // Fall through to next method
    }
  }

  // Try Resend API (if configured)
  if (EMAIL_CONFIG.RESEND_API_KEY) {
    try {
      await sendViaResend(custEmail, custName, subject, htmlContent)
      return { success: true, method: 'resend' }
    } catch (err) {
      console.error('Resend API failed:', err)
      // Fall through to fallback
    }
  }

  // Fallback: Return preview mode (don't auto-open new tab)
  // The UI will show an email preview modal with options
  return { success: true, method: 'gmail_compose', note: 'No email service configured - showing preview', needsManualSend: true }
}

// Helper to load external script
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
}

// ============================================================
// SMTP SETUP INSTRUCTIONS
// ============================================================
/*
To enable direct SMTP email sending:

OPTION 1: EmailJS (Easiest - No Backend Required)
-------------------------------------------------
1. Go to https://www.emailjs.com/ and create account
2. Add your email service (Gmail, Outlook, etc)
3. Create an email template with variables: {{to_email}}, {{to_name}}, {{subject}}, {{message_html}}
4. Get your Service ID, Template ID, and Public Key
5. Add to your .env.local:
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key

OPTION 2: Resend API (Better Deliverability)
--------------------------------------------
1. Go to https://resend.com/ and create account
2. Verify your domain
3. Get your API key
4. Create a Vercel Edge Function at api/send-email.js:

   import { Resend } from 'resend';
   const resend = new Resend(process.env.RESEND_API_KEY);
   
   export default async function handler(req, res) {
     const { to, toName, subject, html } = req.body;
     await resend.emails.send({
       from: 'invoices@yourdomain.com',
       to,
       subject,
       html,
     });
     res.json({ success: true });
   }

5. Add RESEND_API_KEY to Vercel environment variables

OPTION 3: Gmail SMTP via Edge Function
--------------------------------------
Use Nodemailer in a Vercel Edge Function with Gmail App Password.
See: https://nodemailer.com/usage/using-gmail/

OPTION 4: Direct SMTP Configuration
------------------------------------
Add these environment variables to your .env.local:

# SMTP Server Settings
VITE_SMTP_HOST=smtp.gmail.com          # or smtp.office365.com, etc.
VITE_SMTP_PORT=587                      # 587 for TLS, 465 for SSL
VITE_SMTP_SECURE=false                  # true for port 465, false for 587

# Authentication  
VITE_SMTP_USER=your-email@gmail.com
VITE_SMTP_PASS=your-app-password        # Use App Password, not regular password!

# Sender Details
VITE_SMTP_FROM_NAME=Alzaro TyreOps
VITE_SMTP_FROM_EMAIL=invoices@yourdomain.com
VITE_SMTP_REPLY_TO=support@yourdomain.com  # Optional

Provider-Specific Notes:
------------------------
Gmail:
  - Enable 2FA at https://myaccount.google.com/security
  - Generate App Password at https://myaccount.google.com/apppasswords
  - Use App Password as VITE_SMTP_PASS

Outlook/Microsoft 365:
  - May need to enable SMTP AUTH in admin center
  - Use App Password if 2FA enabled

SendGrid:
  - Username is literally "apikey"
  - Password is your SendGrid API key

AWS SES:
  - Create SMTP credentials in SES console (not IAM credentials)
  - Verify sender email/domain before sending
  - Use regional endpoint: email-smtp.{region}.amazonaws.com
*/