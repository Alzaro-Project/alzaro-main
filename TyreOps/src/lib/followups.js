// ============================================================
// CUSTOMER FOLLOW-UP LOGIC (TyreOps)
// ============================================================
//
// Pure, side-effect-free helpers that decide WHICH customers are due a
// follow-up and HOW the message reads. Deliberately framework-free so the
// exact same logic can run in three places:
//
//   Stage 1 (now):  imported by src/pages/FollowUps.jsx — manual send.
//   Stage 2 (later): imported by a Vercel cron function / Edge Function
//                    that loads invoices+customers server-side and sends
//                    automatically. Nothing here touches the DOM, the
//                    store, the network, or `window`, so it ports as-is.
//
// The single source of truth for "is this customer due?" lives in
// computeDueFollowups(). Stage 2 must call the SAME function so manual and
// automated sends never disagree about who is due.
// ============================================================

// Default cadence: 6 months after a tyre fitting.
export const DEFAULT_FOLLOWUP_MONTHS = 6

// A follow-up only makes sense off the back of an actual tyre fitting, not a
// pure service/labour invoice. Tyre lines are tagged 'new' or 'used' in the
// invoice line model (service/labour lines are 'service').
const TYRE_LINE_TYPES = new Set(['new', 'used'])

// --------------------------------------------------------
// DATE HELPERS (UTC-safe, no external deps)
// --------------------------------------------------------

/** Parse a stored invoice date ('YYYY-MM-DD' or ISO) into a Date, or null. */
export function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

/** Add N calendar months to a date, clamping end-of-month overflow. */
export function addMonths(date, months) {
  const d = new Date(date.getTime())
  const targetMonth = d.getMonth() + months
  d.setMonth(targetMonth)
  // If the day rolled over (e.g. Aug 31 + 6mo -> Mar 3), clamp back to the
  // last day of the intended month.
  if (d.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    d.setDate(0)
  }
  return d
}

/** Whole days between two dates (b - a). Positive => b is later. */
export function daysBetween(a, b) {
  const MS = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / MS)
}

/** Format a Date as a UK-style 'D MMM YYYY' string. */
export function formatDate(date) {
  if (!date) return ''
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// --------------------------------------------------------
// CORE: who is due?
// --------------------------------------------------------

/**
 * Does this invoice represent a tyre fitting (has at least one tyre line)?
 * Falls back to treating the invoice as a fitting if it carries no line data
 * at all but has a vehicle reg — older/imported invoices may lack lines.
 */
export function isTyreFitting(invoice) {
  const lines = invoice?.lines || []
  if (lines.length) {
    return lines.some(l => TYRE_LINE_TYPES.has(l.lineType))
  }
  // No line detail available — assume a reg-bearing invoice was a fitting.
  return !!invoice?.reg
}

/**
 * Resolve a contact (email/phone/name) for an invoice, preferring the linked
 * customer record (more likely to be current) and falling back to the
 * snapshot stored on the invoice itself.
 */
function resolveContact(invoice, customersById) {
  const cust = invoice.custId ? customersById.get(invoice.custId) : null
  return {
    customerId: invoice.custId || null,
    name: (cust?.name || invoice.custName || '').trim(),
    email: (cust?.email || invoice.custEmail || '').trim(),
    phone: (cust?.phone || cust?.phoneNumber || '').trim(),
    reg: (invoice.reg || cust?.reg || '').trim(),
  }
}

/**
 * Compute the list of customers due a follow-up.
 *
 * @param {Object}   params
 * @param {Array}    params.invoices   - invoices in store shape
 * @param {Array}    params.customers  - customers in store shape
 * @param {Object}   [params.sentLog]  - map of key -> sent record (see followupSends.js)
 * @param {number}   [params.months]   - cadence in months (default 6)
 * @param {number}   [params.windowDays] - how many days early a fitting may
 *                     surface before its due date (default 14). Lets the user
 *                     get ahead of upcoming follow-ups.
 * @param {Date}     [params.now]      - injectable clock for testing/Stage 2
 *
 * @returns {Array} due entries, soonest-overdue first. Each entry:
 *   { key, customerId, name, email, phone, reg, fittingDate, dueDate,
 *     daysUntilDue, overdue, lastInvoiceId, alreadySent, sentRecord }
 */
export function computeDueFollowups({
  invoices = [],
  customers = [],
  sentLog = {},
  months = DEFAULT_FOLLOWUP_MONTHS,
  windowDays = 14,
  now = new Date(),
} = {}) {
  const customersById = new Map(customers.map(c => [c.id, c]))

  // 1. Keep only tyre-fitting invoices that have a usable date.
  const fittings = invoices
    .filter(isTyreFitting)
    .map(inv => ({ inv, date: parseDate(inv.date) }))
    .filter(x => x.date)

  // 2. Group by a stable contact key (customerId if present, else lowercased
  //    email, else lowercased name+reg) and keep the MOST RECENT fitting per
  //    contact — that's the one the next follow-up hangs off.
  const latestByContact = new Map()
  for (const { inv, date } of fittings) {
    const contact = resolveContact(inv, customersById)
    const key =
      contact.customerId
        ? `cust:${contact.customerId}`
        : contact.email
          ? `email:${contact.email.toLowerCase()}`
          : `name:${contact.name.toLowerCase()}|${contact.reg.toLowerCase()}`

    const existing = latestByContact.get(key)
    if (!existing || date > existing.date) {
      latestByContact.set(key, { inv, date, contact, key })
    }
  }

  // 3. Turn each contact's latest fitting into a due-entry, filtering to those
  //    inside the surfacing window (due now, overdue, or due within windowDays).
  const due = []
  for (const { inv, date, contact, key } of latestByContact.values()) {
    const dueDate = addMonths(date, months)
    const daysUntilDue = daysBetween(now, dueDate)

    // Not yet within the surfacing window -> skip for now.
    if (daysUntilDue > windowDays) continue

    const sentRecord = sentLog[key] || null
    // If we already logged a send for THIS fitting, treat it as handled.
    const alreadySent = !!sentRecord && sentRecord.fittingDate === inv.date

    due.push({
      key,
      customerId: contact.customerId,
      name: contact.name || 'Customer',
      email: contact.email,
      phone: contact.phone,
      reg: contact.reg,
      fittingDate: inv.date,
      dueDate,
      daysUntilDue,
      overdue: daysUntilDue < 0,
      lastInvoiceId: inv.id,
      alreadySent,
      sentRecord,
    })
  }

  // 4. Sort: most overdue first, then soonest due.
  due.sort((a, b) => a.daysUntilDue - b.daysUntilDue)
  return due
}

// --------------------------------------------------------
// TEMPLATES
// --------------------------------------------------------

// Tokens any template may reference. Kept small and obvious.
//   {{name}}    - customer name
//   {{reg}}     - vehicle registration (or 'your vehicle' if unknown)
//   {{garage}}  - garage/business name
//   {{phone}}   - garage phone
//   {{months}}  - cadence in months
export const TEMPLATE_TOKENS = ['name', 'reg', 'garage', 'phone', 'months']

export const DEFAULT_TEMPLATES = {
  emailSubject: 'Time for a tyre check, {{name}}?',
  emailBody:
`Hi {{name}},

It's been around {{months}} months since we last fitted tyres on {{reg}} at {{garage}}.

Tyres wear gradually, so now is a great time for a free check of tread depth, pressures and overall condition — and to sort any replacements before the colder months.

Reply to this email or call us on {{phone}} to book a slot.

Thanks,
{{garage}}`,
  // SMS / WhatsApp share one short template — most garages want the same wording.
  smsBody:
`Hi {{name}}, it's {{garage}}. It's been ~{{months}} months since your last tyre fitting on {{reg}}. Time for a free tyre check? Call {{phone}} to book. Thanks!`,
}

/**
 * Substitute {{tokens}} in a template string. Unknown tokens are left as-is so
 * a typo is visible rather than silently blanked.
 */
export function renderTemplate(template, vars) {
  if (!template) return ''
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => {
    return Object.prototype.hasOwnProperty.call(vars, token) ? String(vars[token] ?? '') : match
  })
}

/**
 * Build the variable bag for a due-entry + garage settings. Centralised so
 * email and SMS render from identical data.
 */
export function buildTemplateVars(entry, settings = {}, months = DEFAULT_FOLLOWUP_MONTHS) {
  return {
    name: entry.name || 'there',
    reg: entry.reg || 'your vehicle',
    garage: settings.name || 'your garage',
    phone: settings.phone || '',
    months,
  }
}

/** Render all channels for an entry in one go. */
export function renderFollowupMessages(entry, settings, templates = DEFAULT_TEMPLATES, months = DEFAULT_FOLLOWUP_MONTHS) {
  const vars = buildTemplateVars(entry, settings, months)
  return {
    emailSubject: renderTemplate(templates.emailSubject, vars),
    emailBody: renderTemplate(templates.emailBody, vars),
    smsBody: renderTemplate(templates.smsBody, vars),
  }
}

// --------------------------------------------------------
// CHANNEL LINK BUILDERS (Stage 1 manual send)
// --------------------------------------------------------

/** Normalise a UK-ish phone number to bare international digits for wa.me. */
export function normalisePhoneForWhatsApp(phone, defaultCountry = '44') {
  if (!phone) return ''
  let p = String(phone).replace(/[^\d+]/g, '')
  if (p.startsWith('+')) return p.slice(1)
  if (p.startsWith('00')) return p.slice(2)
  if (p.startsWith('0')) return defaultCountry + p.slice(1)
  return p
}

/** WhatsApp click-to-chat URL that opens on the sender's own device. */
export function buildWhatsAppLink(phone, body) {
  const num = normalisePhoneForWhatsApp(phone)
  const text = encodeURIComponent(body || '')
  return num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`
}

/** sms: URI that opens the sender's own Messages app pre-filled. */
export function buildSmsLink(phone, body) {
  const num = (phone || '').replace(/\s+/g, '')
  // `?&body=` is the most broadly-compatible form across iOS/Android.
  return `sms:${num}${num ? '' : ''}?&body=${encodeURIComponent(body || '')}`
}
