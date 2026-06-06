// /api/send-email.js
// Vercel serverless function — sends email via Resend API.
// Requires RESEND_API_KEY set in Vercel environment variables (server-side, no VITE_ prefix).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { to, subject, html, text, fromName, replyTo } = req.body || {}

  if (!to || !subject || (!html && !text)) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html/text' })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY not set on server' })
  }

  try {
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
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend error:', data)
      return res.status(response.status).json({ error: data.message || 'Resend API error' })
    }

    return res.status(200).json({ success: true, id: data.id })
  } catch (err) {
    console.error('send-email failed:', err)
    return res.status(500).json({ error: err.message })
  }
}
