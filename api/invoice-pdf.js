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

    const { invoice_id } = req.body || {}
    if (!invoice_id) return res.status(400).json({ error: 'Missing invoice_id' })

    // fetch invoice (RLS ensures it's the caller's)
    const invoices = await sbSelect(token, anonKey, `soloops_invoices?id=eq.${invoice_id}&select=*`)
    const invoice = invoices[0]
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    // line items, settings, and matching client (by name)
    const [lines, settingsRows] = await Promise.all([
      sbSelect(token, anonKey, `soloops_invoice_lines?invoice_id=eq.${invoice_id}&select=*&order=position.asc`),
      sbSelect(token, anonKey, `soloops_settings?select=*&limit=1`),
    ])
    const biz = settingsRows[0] || {}

    let client = { name: invoice.client_name || '' }
    if (invoice.client_name) {
      const enc = encodeURIComponent(invoice.client_name)
      const clientRows = await sbSelect(token, anonKey, `soloops_clients?name=ilike.${enc}&select=*&limit=1`)
      if (clientRows[0]) client = clientRows[0]
    }

    // logo (optional) — fetch bytes server-side if a URL is set
    let logoBytes = null
    if (biz.logo_url) {
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
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return res.status(200).send(Buffer.from(pdfBytes))
  } catch (err) {
    console.error('invoice-pdf failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
