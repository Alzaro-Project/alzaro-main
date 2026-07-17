// ============================================================================
// SoloOps email — invoice sending
// ============================================================================
// SoloOps sends ONLY from the trader's own address over their own SMTP. Every
// call passes requireSmtp:true, so /api/send-email resolves their credentials
// server-side from soloops_settings (via the soloops_smtp_secret() RPC) and
// will NOT silently fall back to the shared invoices@alzaro.co.uk Resend sender.
//
// Sole traders invoice their own clients: replies must land in their inbox, and
// the client must see their name — not ours. If they haven't configured email,
// sending fails closed with a setup prompt rather than sending as Alzaro.
//
// The SMTP password never passes through this file. The browser doesn't have it.
// ============================================================================

import { getSession } from './db.js'

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const gbp = (n) => '£' + (Number(n) || 0).toLocaleString('en-GB', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})

const ukDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Default body text for an invoice email. Plain, human, and editable by the
 * user before sending — this is a starting point, not a locked template.
 */
export function defaultInvoiceBody(invoice, settings) {
  const biz = settings?.business_name || 'us'
  const ref = invoice?.number ? `invoice ${invoice.number}` : 'your invoice'
  const due = invoice?.due_date ? ` by ${ukDate(invoice.due_date)}` : ''
  const terms = settings?.payment_terms ? `\n\n${settings.payment_terms}` : ''
  return `Hi ${invoice?.client_name || 'there'},

Please find ${ref} attached, for ${gbp(invoice?.total)}.

Payment is due${due}. If you have any questions, just reply to this email.${terms}

Many thanks,
${biz}`
}

export function defaultInvoiceSubject(invoice, settings) {
  const biz = settings?.business_name ? ` from ${settings.business_name}` : ''
  return `Invoice ${invoice?.number || ''}${biz}`.replace(/\s+/g, ' ').trim()
}

/**
 * Wrap the user's plain-text message in a light branded HTML shell. Bank details
 * and totals already live in the attached PDF, so this stays deliberately simple
 * — an HTML wall that contradicts the PDF is worse than no HTML at all.
 */
export function invoiceEmailHtml({ body, invoice, settings }) {
  const bizName = esc(settings?.business_name || '')
  const foot = [
    bizName,
    esc(settings?.phone || ''),
    esc(settings?.email || ''),
    settings?.vat_number ? `VAT: ${esc(settings.vat_number)}` : '',
  ].filter(Boolean).join(' · ')

  const logo = settings?.logo_url
    ? `<img src="${esc(settings.logo_url)}" alt="${bizName}" style="max-height:52px;max-width:200px;object-fit:contain;display:block;margin-bottom:14px;" />`
    : (bizName ? `<div style="font-size:19px;font-weight:800;color:#111;margin-bottom:14px;">${bizName}</div>` : '')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f6f6f4;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:28px 22px;">
    ${logo}
    <div style="background:#fff;border:1px solid #ececec;border-radius:12px;padding:22px;">
      <div style="font-size:14.5px;white-space:pre-wrap;">${esc(body).replace(/\n/g, '<br>')}</div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0;font-size:13px;color:#777;">
        📎 ${esc(invoice?.number ? `Invoice ${invoice.number}` : 'Your invoice')} is attached as a PDF${invoice?.total != null ? ` — ${gbp(invoice.total)}` : ''}.
      </div>
    </div>
    ${foot ? `<div style="margin-top:18px;font-size:11.5px;color:#999;text-align:center;">${foot}</div>` : ''}
  </div>
</body></html>`
}

/**
 * Fetch the invoice PDF as base64 so it can ride along as an attachment.
 * Reuses /api/invoice-pdf (format:'base64') — one generator, two response
 * shapes — so an emailed PDF is byte-identical to a downloaded one.
 */
export async function fetchInvoicePdfBase64(invoiceId) {
  const sess = await getSession()
  const res = await fetch('/api/invoice-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sess?.access_token || ''}`,
    },
    body: JSON.stringify({ invoice_id: invoiceId, format: 'base64' }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || 'Could not attach the invoice PDF')
  }
  return res.json()   // { filename, content }
}

/**
 * Send an invoice email from the trader's own SMTP, with the PDF attached.
 * @returns {Promise<{success:boolean, error?:string, needsSetup?:boolean}>}
 *   needsSetup:true means "no mail configured yet" — the caller should point
 *   them at Settings → Email rather than showing a raw error.
 */
export async function sendInvoiceEmail({ to, subject, body, invoice, settings, attachPdf = true }) {
  if (!to) return { success: false, error: 'No client email address' }
  if (!subject?.trim()) return { success: false, error: 'Add a subject' }
  if (!body?.trim()) return { success: false, error: 'Add a message' }

  const sess = await getSession()
  if (!sess?.access_token) return { success: false, error: 'You must be logged in to send email' }

  let attachments
  if (attachPdf && invoice?.id) {
    try {
      const pdf = await fetchInvoicePdfBase64(invoice.id)
      attachments = [{ filename: pdf.filename, content: pdf.content }]
    } catch (e) {
      return { success: false, error: e.message || 'Could not attach the invoice PDF' }
    }
  }

  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sess.access_token}`,
      },
      body: JSON.stringify({
        to: to.trim(),
        subject: subject.trim(),
        html: invoiceEmailHtml({ body, invoice, settings }),
        text: body,
        fromName: settings?.smtp_from_name || settings?.business_name || undefined,
        replyTo: settings?.smtp_reply_to || settings?.email || undefined,
        attachments,
        product: 'soloops',
        requireSmtp: true,   // never fall back to the shared Alzaro sender
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg = err.error || 'Could not send the email'
      // The server returns this exact 400 when smtp_host/smtp_user/password are
      // missing — surface it as a setup prompt, not a failure.
      const needsSetup = res.status === 400 && /not configured/i.test(msg)
      return { success: false, error: msg, needsSetup }
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message || 'Could not send the email' }
  }
}
