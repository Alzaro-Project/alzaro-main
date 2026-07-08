// /api/trial-reminders.js
// ============================================================
// TRIAL-ENDING EMAIL REMINDERS — daily Vercel Cron job
// ============================================================
// Runs once a day (see the "crons" block in vercel.json). For every trial
// across all verticals that ends in exactly 7 or 1 days, sends one reminder
// email and logs it to the trial_reminders ledger so it never double-sends.
//
// WHAT COUNTS AS A TRIAL: a row whose trial_ends matches the milestone date,
// has NO stripe_subscription_id (i.e. never subscribed), and is not
// suspended/disabled. We key off "no subscription" rather than the status
// word because products disagree on it — SoloOps/TyreOps/GarageOps call a live
// trial 'active', while ServiceOps/PropertyOps call it 'trial'. Filtering on
// stripe_subscription_id IS NULL is correct for all five and never emails a
// paying customer.
//
// REQUIRED Vercel environment variables (server-side, NO VITE_ prefix):
//   SUPABASE_URL                 - https://cxsaeftacozyphuejuxo.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    - service-role key (bypasses RLS; keep secret)
//   RESEND_API_KEY               - same key send-email.js already uses
//   CRON_SECRET                  - any long random string; also set on the cron
//
// Vercel Cron calls this with `Authorization: Bearer <CRON_SECRET>` so no
// public visitor can trigger blasts. Manual run for testing:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://alzaro.co.uk/api/trial-reminders
// ============================================================

// Which milestones to email at, in days-before-trial-end.
const MILESTONES = [7, 1]

// Friendly product names + their app login paths for the CTA link.
const PRODUCT_META = {
  tyreops:     { name: 'TyreOps',     path: '/tyreops' },
  garageops:   { name: 'GarageOps',   path: '/garageops' },
  serviceops:  { name: 'ServiceOps',  path: '/serviceops' },
  propertyops: { name: 'PropertyOps', path: '/propertyops' },
  soloops:     { name: 'SoloOps',     path: '/soloops' },
}

const SITE_ORIGIN = 'https://alzaro.co.uk'

// --------------------------------------------------------
// Small Supabase REST helpers (service role; no SDK needed).
// --------------------------------------------------------
function sb(path, { method = 'GET', body, headers = {} } = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1/${path}`
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/** YYYY-MM-DD for a Date in UTC. */
function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

// --------------------------------------------------------
// Email content
// --------------------------------------------------------
function buildEmail({ businessName, productName, productPath, daysLeft, trialEndsDate }) {
  const loginUrl = `${SITE_ORIGIN}${productPath}/login`
  const when = daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`
  const subject =
    daysLeft === 1
      ? `Your ${productName} trial ends tomorrow`
      : `Your ${productName} trial ends in ${daysLeft} days`

  const greeting = businessName ? `Hi ${businessName},` : 'Hi there,'

  const text = `${greeting}

Your free ${productName} trial ends ${when} (${trialEndsDate}).

To keep your account active and avoid any interruption, add a payment method and choose a plan from your account settings.

Pick up where you left off: ${loginUrl}

If you've any questions, just reply to this email.

Thanks,
The Alzaro team`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:24px;">
  <div style="font-size:22px;font-weight:800;margin-bottom:8px;">Alzaro<span style="color:#5b8cff;">${productName}</span></div>
  <p style="font-size:15px;">${greeting}</p>
  <p style="font-size:15px;">Your free <strong>${productName}</strong> trial ends <strong>${when}</strong> (${trialEndsDate}).</p>
  <p style="font-size:15px;">To keep your account active and avoid any interruption, add a payment method and choose a plan from your account settings.</p>
  <p style="margin:28px 0;">
    <a href="${loginUrl}" style="background:#5b8cff;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Go to ${productName}</a>
  </p>
  <p style="font-size:14px;color:#666;">If you've any questions, just reply to this email.</p>
  <p style="font-size:14px;color:#666;margin-top:24px;">Thanks,<br>The Alzaro team</p>
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;">Alzaro · alzaro.co.uk</div>
</body></html>`

  return { subject, text, html }
}

async function sendEmail({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Alzaro <invoices@alzaro.co.uk>',
      to: [to],
      subject,
      html,
      text,
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Resend API error')
  return data
}

// --------------------------------------------------------
// Handler
// --------------------------------------------------------
export default async function handler(req, res) {
  // --- Only Vercel Cron (or someone with the secret) may run this ---
  const auth = req.headers.authorization || ''
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase service env vars not set' })
  }
  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not set' })
  }

  const results = { checked: 0, sent: 0, skipped: 0, errors: [] }

  try {
    // Compute the exact target dates (UTC) for each milestone.
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    for (const daysLeft of MILESTONES) {
      const target = new Date(today)
      target.setUTCDate(target.getUTCDate() + daysLeft)
      const targetDate = isoDate(target)

      // Active trials ending on exactly this date, any product.
      // status = 'trial' (or 'trialing'); adjust if your status value differs.
      const membersRes = await sb(
        `product_members?select=id,email,product,company_name,status,trial_ends` +
        `&trial_ends=eq.${targetDate}` +
        `&stripe_subscription_id=is.null` +
        `&status=not.in.(suspended,disabled)`
      )
      if (!membersRes.ok) {
        const t = await membersRes.text()
        results.errors.push(`fetch members (${daysLeft}d): ${t}`)
        continue
      }
      const members = await membersRes.json()
      results.checked += members.length

      for (const m of members) {
        if (!m.email) { results.skipped++; continue }

        // Already sent this milestone for this trial window?
        const ledgerRes = await sb(
          `trial_reminders?select=id` +
          `&member_id=eq.${m.id}&milestone=eq.${daysLeft}&trial_ends=eq.${m.trial_ends}&limit=1`
        )
        const existing = ledgerRes.ok ? await ledgerRes.json() : []
        if (existing.length) { results.skipped++; continue }

        const meta = PRODUCT_META[m.product] || { name: m.product || 'Alzaro', path: '' }
        const email = buildEmail({
          businessName: m.company_name,
          productName: meta.name,
          productPath: meta.path,
          daysLeft,
          trialEndsDate: m.trial_ends,
        })

        try {
          await sendEmail({ to: m.email, ...email })
          // Log it ONLY after a successful send. The unique constraint makes
          // this idempotent even if the job overlaps with itself.
          await sb('trial_reminders', {
            method: 'POST',
            headers: { Prefer: 'resolution=ignore-duplicates' },
            body: {
              member_id: m.id,
              product: m.product,
              milestone: daysLeft,
              trial_ends: m.trial_ends,
              email: m.email,
            },
          })
          results.sent++
        } catch (err) {
          results.errors.push(`send ${m.email} (${daysLeft}d): ${err.message}`)
        }
      }
    }

    return res.status(200).json({ ok: true, ...results })
  } catch (err) {
    console.error('trial-reminders failed:', err)
    return res.status(500).json({ error: err.message, ...results })
  }
}
