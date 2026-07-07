// api/_invoicePdf.js
// Shared invoice PDF builder (pdf-lib, serverless-safe — no font files needed).
// Used by /api/invoice-pdf (download) and /api/send-invoice (email attachment).
// Underscore prefix => Vercel does NOT treat this as its own serverless route.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const money = (n) =>
  '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// pdf-lib's standard Helvetica can only encode WinAnsi (≈ Latin-1). Any
// character outside it — emoji, ₹, Cyrillic/Greek/CJK, smart quotes — makes
// drawText throw and aborts the ENTIRE PDF. Map the common smart punctuation to
// ASCII and replace anything else unencodable with '?', so one stray character
// in a client name or note can never kill the invoice.
const winAnsi = (s) =>
  String(s ?? '')
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/€/g, 'EUR')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?')

// data: {
//   invoice: { number, issue_date, due_date, vat_rate, notes, status },
//   lines:   [{ description, qty, unit_price }],
//   client:  { name, email, address },
//   biz:     { business_name, address, phone, email, logo_url(optional),
//              vat_registered, vat_number, vat_scheme, flat_rate,
//              bank_name, bank_account_name, bank_sort_code, bank_account_number, payment_terms },
//   logoBytes: Uint8Array | null   (fetched server-side from logo_url)
// }
export async function buildInvoicePdf(data) {
  const { invoice = {}, lines = [], client = {}, biz = {}, logoBytes = null } = data

  const doc = await PDFDocument.create()
  const A4 = [595.28, 841.89]
  let page = doc.addPage(A4) // A4 (reassigned when we spill onto a new page)
  const { width, height } = page.getSize()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const M = 48
  const ORANGE = rgb(0.976, 0.451, 0.086)
  const DARK = rgb(0.11, 0.11, 0.11)
  const GREY = rgb(0.42, 0.42, 0.42)
  const LINE = rgb(0.85, 0.85, 0.85)

  const text = (s, x, y, { size = 10, f = font, color = DARK } = {}) =>
    page.drawText(winAnsi(s), { x, y, size, font: f, color })
  const right = (s, xRight, y, { size = 10, f = font, color = DARK } = {}) => {
    const str = winAnsi(s)
    const w = f.widthOfTextAtSize(str, size)
    page.drawText(str, { x: xRight - w, y, size, font: f, color })
  }

  let y = height - M
  // Start a fresh page and reset the cursor when content would spill below the
  // bottom margin. Returns true if a page break happened.
  const newPageIfNeeded = (needed) => {
    if (y - needed >= M) return false
    page = doc.addPage(A4)
    y = height - M
    return true
  }

  // ---- Header: logo / business name (left), INVOICE (right) ----
  let headerLeftY = y
  if (logoBytes) {
    try {
      let img
      try { img = await doc.embedPng(logoBytes) } catch { img = await doc.embedJpg(logoBytes) }
      const maxH = 46
      const scale = maxH / img.height
      const w = img.width * scale
      page.drawImage(img, { x: M, y: y - maxH + 4, width: w, height: maxH })
      headerLeftY = y - maxH - 6
      text(biz.business_name || '', M, headerLeftY, { size: 13, f: bold })
      headerLeftY -= 14
    } catch {
      text(biz.business_name || '', M, y, { size: 20, f: bold }); headerLeftY = y - 16
    }
  } else {
    text(biz.business_name || '', M, y, { size: 20, f: bold }); headerLeftY = y - 16
  }

  let ly = headerLeftY
  ;(biz.address || '').split('\n').filter(Boolean).forEach((l) => { text(l, M, ly, { size: 9, color: GREY }); ly -= 12 })
  if (biz.phone) { text(biz.phone, M, ly, { size: 9, color: GREY }); ly -= 12 }
  if (biz.email) { text(biz.email, M, ly, { size: 9, color: GREY }); ly -= 12 }
  if (biz.vat_registered && biz.vat_number) { text('VAT: ' + biz.vat_number, M, ly, { size: 9, color: GREY }); ly -= 12 }

  // invoice meta (right)
  let my = height - M
  right('INVOICE', width - M, my, { size: 20, f: bold, color: ORANGE }); my -= 22
  right(invoice.number || '', width - M, my, { size: 11, f: bold }); my -= 16
  if (invoice.issue_date) { right('Issued: ' + invoice.issue_date, width - M, my, { size: 9, color: GREY }); my -= 12 }
  if (invoice.due_date) { right('Due: ' + invoice.due_date, width - M, my, { size: 9, color: GREY }); my -= 12 }

  y = Math.min(ly, my) - 16
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: LINE })
  y -= 24

  // ---- Bill to ----
  text('BILL TO', M, y, { size: 8, f: bold, color: GREY }); y -= 14
  text(client.name || '—', M, y, { size: 11, f: bold }); y -= 14
  ;(client.address || '').split('\n').filter(Boolean).forEach((l) => { text(l, M, y, { size: 9, color: GREY }); y -= 12 })
  if (client.email) { text(client.email, M, y, { size: 9, color: GREY }); y -= 12 }
  y -= 14

  // ---- Line item table ----
  const colDesc = M
  const colQty = width - M - 200
  const colPrice = width - M - 110
  const colAmt = width - M

  const drawTableHeader = () => {
    page.drawRectangle({ x: M, y: y - 6, width: width - 2 * M, height: 22, color: rgb(0.96, 0.96, 0.96) })
    text('DESCRIPTION', colDesc + 6, y, { size: 8, f: bold, color: GREY })
    right('QTY', colQty + 30, y, { size: 8, f: bold, color: GREY })
    right('UNIT', colPrice + 30, y, { size: 8, f: bold, color: GREY })
    right('AMOUNT', colAmt, y, { size: 8, f: bold, color: GREY })
    y -= 24
  }
  drawTableHeader()

  let subtotal = 0
  for (const l of lines) {
    // Spill onto a new page (re-drawing the column header) before a row would
    // fall below the bottom margin — otherwise long invoices silently draw off
    // the page.
    if (newPageIfNeeded(26)) drawTableHeader()
    const amt = Number(l.qty || 0) * Number(l.unit_price || 0)
    subtotal += amt
    text(l.description || '', colDesc + 6, y, { size: 10 })
    right(String(l.qty ?? ''), colQty + 30, y, { size: 10 })
    right(money(l.unit_price), colPrice + 30, y, { size: 10 })
    right(money(amt), colAmt, y, { size: 10 })
    y -= 10
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: LINE })
    y -= 16
  }

  // ---- Totals (VAT only when registered) ----
  const vatRegistered = !!biz.vat_registered
  let vat = 0
  if (vatRegistered) {
    if (biz.vat_scheme === 'flat_rate') {
      vat = subtotal * (Number(biz.flat_rate) || 0) / 100
    } else {
      vat = subtotal * (Number(invoice.vat_rate) || 0) / 100
    }
  }
  const total = subtotal + vat

  // Keep the totals block together on one page.
  newPageIfNeeded(70)
  y -= 6
  right('Subtotal', colPrice + 30, y, { size: 10, color: GREY }); right(money(subtotal), colAmt, y, { size: 10 }); y -= 18
  if (vatRegistered) {
    const label = biz.vat_scheme === 'flat_rate'
      ? `VAT (Flat Rate ${Number(biz.flat_rate) || 0}%)`
      : `VAT (${Number(invoice.vat_rate) || 0}%)`
    right(label, colPrice + 30, y, { size: 10, color: GREY }); right(money(vat), colAmt, y, { size: 10 }); y -= 8
  } else {
    y += 10
  }
  page.drawLine({ start: { x: colPrice - 40, y }, end: { x: width - M, y }, thickness: 1, color: LINE }); y -= 18
  right('TOTAL', colPrice + 30, y, { size: 12, f: bold }); right(money(total), colAmt, y, { size: 12, f: bold, color: ORANGE })
  y -= 36

  // ---- How to pay (only if bank details exist) ----
  const hasBank = biz.bank_account_number || biz.bank_sort_code || biz.bank_name
  if (hasBank) {
    const boxH = 92
    newPageIfNeeded(boxH + 18)
    page.drawRectangle({ x: M, y: y - boxH + 6, width: width - 2 * M, height: boxH, color: rgb(0.98, 0.98, 0.98), borderColor: LINE, borderWidth: 1 })
    let py = y - 6
    text('HOW TO PAY', M + 14, py, { size: 8, f: bold, color: GREY }); py -= 16
    if (biz.bank_name) { text('Bank transfer — ' + biz.bank_name, M + 14, py, { size: 10 }); py -= 14 }
    const detailBits = []
    if (biz.bank_account_name) detailBits.push(biz.bank_account_name)
    if (biz.bank_sort_code) detailBits.push('Sort ' + biz.bank_sort_code)
    if (biz.bank_account_number) detailBits.push('Acc ' + biz.bank_account_number)
    if (detailBits.length) { text(detailBits.join('  ·  '), M + 14, py, { size: 10 }); py -= 14 }
    text('Reference: ' + (invoice.number || ''), M + 14, py, { size: 9, color: GREY }); py -= 14
    if (biz.payment_terms) text(biz.payment_terms, M + 14, py, { size: 9, color: GREY })
    y -= boxH + 18
  }

  // ---- Notes ----
  if (invoice.notes) {
    newPageIfNeeded(20)
    text('Notes: ' + invoice.notes, M, y, { size: 9, color: GREY })
  }

  return await doc.save() // Uint8Array
}
