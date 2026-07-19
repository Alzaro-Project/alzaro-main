// /api/invoice-pdf.js
// Generates an invoice PDF for download.
// SECURITY: requires a valid Supabase session token. All data is fetched
// from Supabase using that user's token, so RLS limits it to their own rows.
//
// POST body: { invoice_id }
// Returns: application/pdf (binary)

import { buildInvoicePdf } from './_invoicePdf.js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://cxsaeftacozyphuejuxo.supabase.co'

async function sbSelect(token, anonKey, path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  return await res.json()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return res.status(401).json({ error: 'Not authenticated' })

    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    if (!anonKey) return res.status(500).json({ error: 'SUPABASE_ANON_KEY not set on server' })

    // verify token belongs to a real user
    const authCheck = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    })
    if (!authCheck.ok) return res.status(401).json({ error: 'Invalid or expired session' })
    let userId = null
    try { userId = (await authCheck.json())?.id || null } catch (e) {}
    if (!userId) return res.status(401).json({ error: 'Invalid or expired session' })

    // Authorization: an active product_members row, same gate as send-email /
    // test-smtp — a suspended or cancelled account must not keep using the PDF
    // generator. Read with the caller's own token; RLS returns only their rows.
    let isMember = false
    try {
      const mUrl =
        `${SUPABASE_URL}/rest/v1/product_members` +
        `?user_id=eq.${encodeURIComponent(userId)}` +
        `&status=in.(active,trial,trialing)&select=id&limit=1`
      const mRes = await fetch(mUrl, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } })
      if (mRes.ok) {
        const rows = await mRes.json().catch(() => [])
        isMember = Array.isArray(rows) && rows.length > 0
      }
    } catch (e) { /* fail closed below */ }
    if (!isMember) {
      return res.status(403).json({ error: 'Your account is not active.' })
    }

    const { invoice_id, format } = req.body || {}
    if (!invoice_id) return res.status(400).json({ error: 'Missing invoice_id' })

    // fetch invoice (RLS ensures it's the caller's). Encode the id into the
    // PostgREST filter (same as client_name below) so it can't alter the query.
    const encInvoiceId = encodeURIComponent(invoice_id)
    const invoices = await sbSelect(token, anonKey, `soloops_invoices?id=eq.${encInvoiceId}&select=*`)
    const invoice = invoices[0]
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    // line items, settings, and matching client (by name). Settings columns are
    // listed explicitly — the PDF only needs business/bank fields, and select=*
    // would drag smtp_pass / smtp_pass_enc into this handler for no reason.
    const BIZ_COLS = [
      'business_name', 'address', 'phone', 'email', 'logo_url',
      'vat_registered', 'vat_number', 'vat_scheme', 'flat_rate',
      'bank_name', 'bank_account_name', 'bank_sort_code', 'bank_account_number',
      'payment_terms',
    ].join(',')
    const [lines, settingsRows] = await Promise.all([
      sbSelect(token, anonKey, `soloops_invoice_lines?invoice_id=eq.${encInvoiceId}&select=*&order=position.asc`),
      sbSelect(token, anonKey, `soloops_settings?select=${BIZ_COLS}&limit=1`),
    ])
    const biz = settingsRows[0] || {}

    let client = { name: invoice.client_name || '' }
    if (invoice.client_name) {
      // ilike is used for case-insensitive EXACT match, so escape LIKE
      // wildcards — a client name containing % or _ must not pattern-match a
      // different client's details onto the invoice.
      const enc = encodeURIComponent(invoice.client_name.replace(/([\\%_])/g, '\\$1'))
      const clientRows = await sbSelect(token, anonKey, `soloops_clients?name=ilike.${enc}&select=name,email,address&limit=1`)
      if (clientRows[0]) client = clientRows[0]
    }

    // logo (optional) — fetch bytes server-side, but ONLY from this project's
    // own Supabase storage (the only place the Settings logo upload ever
    // writes). logo_url is a user-writable settings column, so fetching an
    // arbitrary value would let a caller aim this server at internal or
    // metadata endpoints (SSRF).
    let logoBytes = null
    if (typeof biz.logo_url === 'string' && biz.logo_url.startsWith(`${SUPABASE_URL}/storage/`)) {
      try {
        const r = await fetch(biz.logo_url)
        if (r.ok) logoBytes = new Uint8Array(await r.arrayBuffer())
      } catch { /* ignore logo failures */ }
    }

    // When an invoice has no stored line items, synthesise a single line from
    // the stored total. invoice.total is VAT-INCLUSIVE, and the PDF builder
    // re-applies VAT to the line subtotal — so feed it the NET (ex-VAT) amount,
    // otherwise the fallback total is inflated by the VAT rate twice.
    let fallbackLines = lines
    if (!lines.length) {
      const rate = biz.vat_registered
        ? (biz.vat_scheme === 'flat_rate' ? Number(biz.flat_rate) || 0 : Number(invoice.vat_rate) || 0)
        : 0
      const gross = Number(invoice.total) || 0
      const net = rate > 0 ? gross / (1 + rate / 100) : gross
      fallbackLines = [{ description: invoice.client_name ? 'Services' : '', qty: 1, unit_price: net }]
    }

    const pdfBytes = await buildInvoicePdf({
      invoice,
      lines: fallbackLines,
      client,
      biz,
      logoBytes,
    })

    const filename = `${invoice.number || 'invoice'}.pdf`.replace(/[^a-zA-Z0-9._-]/g, '_')

    // format:'base64' — same bytes, JSON-wrapped, so the browser can hand the
    // PDF straight to /api/send-email as an attachment without a second
    // generator or a round-trip through a Blob. Default stays binary download.
    if (format === 'base64') {
      return res.status(200).json({
        filename,
        content: Buffer.from(pdfBytes).toString('base64'),
      })
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(Buffer.from(pdfBytes))
  } catch (err) {
    // Detail stays in the server log — err.message can carry internal URLs /
    // library internals that don't belong in a client response.
    console.error('invoice-pdf failed:', err)
    return res.status(500).json({ error: 'Could not generate the PDF. Please try again.' })
  }
}
