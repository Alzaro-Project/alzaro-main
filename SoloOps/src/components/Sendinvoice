import React from 'react'
import { Modal, ErrBox, inp, btnPri, btnSec, isEmailish, gbp } from './UI.jsx'
import { sendInvoiceEmail, defaultInvoiceBody, defaultInvoiceSubject } from '../lib/email.js'

// Send an invoice to a client from the trader's own email address.
//
// Recipient is prefilled from the matching client record; if that client has no
// email on file the field starts blank and the user types one (we don't write it
// back to Clients from here — that's a separate decision they didn't ask for).
//
// On success the parent bumps draft -> sent (see onSent).
export default function SendInvoice({ invoice, client, settings, onClose, onSent, goToEmailSettings }) {
  const [to, setTo] = React.useState(client?.email || '')
  const [subject, setSubject] = React.useState(() => defaultInvoiceSubject(invoice, settings))
  const [body, setBody] = React.useState(() => defaultInvoiceBody(invoice, settings))
  const [attachPdf, setAttachPdf] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [needsSetup, setNeedsSetup] = React.useState(false)

  // Host + user are enough to know mail is configured — the password lives
  // server-side and is verified at send time.
  const configured = !!(settings?.smtp_host && settings?.smtp_user)
  const sender = settings?.smtp_from_email || settings?.smtp_user || ''

  const send = async () => {
    setErr(''); setNeedsSetup(false)
    if (!to.trim()) return setErr('Enter the client’s email address')
    if (!isEmailish(to)) return setErr('That email address looks invalid')

    setBusy(true)
    const r = await sendInvoiceEmail({ to, subject, body, invoice, settings, attachPdf })
    setBusy(false)

    if (!r.success) {
      setErr(r.error)
      setNeedsSetup(!!r.needsSetup)
      return
    }
    onSent?.()
  }

  // Not set up yet: don't show a form that can only fail — send them to Settings.
  if (!configured) {
    return (
      <Modal title="Send invoice" onClose={onClose} width="440px">
        <div style={{ fontSize:'14px', color:'var(--text2)', lineHeight:1.6, marginBottom:'18px' }}>
          Set up your business email first, and invoices will go out from your own address —
          so replies come back to you and your clients see your name, not ours.
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button style={btnPri} onClick={() => { onClose?.(); goToEmailSettings?.() }}>Set up email</button>
          <button style={btnSec} onClick={onClose}>Cancel</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Send invoice" onClose={onClose} width="520px">
      {err && <ErrBox m={err} />}
      {needsSetup && (
        <div style={{ marginTop:'-6px', marginBottom:'14px' }}>
          <button style={btnSec} onClick={() => { onClose?.(); goToEmailSettings?.() }}>Open email settings</button>
        </div>
      )}

      <div style={{ fontSize:'12.5px', color:'var(--text3)', marginBottom:'14px' }}>
        Sending as <strong style={{ color:'var(--text2)' }}>{sender}</strong>
        {invoice?.number ? <> · {invoice.number}</> : null}
        {invoice?.total != null ? <> · {gbp(invoice.total)}</> : null}
      </div>

      <div style={{ marginBottom:'12px' }}>
        <div style={lbl}>To</div>
        <input style={inp} value={to} onChange={e=>{setTo(e.target.value); setErr('')}} placeholder="client@example.com" />
        {!client?.email && (
          <div style={{ fontSize:'11.5px', color:'var(--text3)', marginTop:'5px' }}>
            No email saved for this client — add one in Clients to prefill it next time.
          </div>
        )}
      </div>

      <div style={{ marginBottom:'12px' }}>
        <div style={lbl}>Subject</div>
        <input style={inp} value={subject} onChange={e=>setSubject(e.target.value)} />
      </div>

      <div style={{ marginBottom:'12px' }}>
        <div style={lbl}>Message</div>
        <textarea
          style={{...inp, minHeight:'150px', resize:'vertical', fontFamily:'inherit', lineHeight:1.6}}
          value={body}
          onChange={e=>setBody(e.target.value)}
        />
      </div>

      <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'var(--text2)', cursor:'pointer', marginBottom:'18px' }}>
        <input type="checkbox" checked={attachPdf} onChange={e=>setAttachPdf(e.target.checked)} />
        Attach the invoice as a PDF
      </label>

      <div style={{ display:'flex', gap:'10px' }}>
        <button style={{...btnPri, opacity:busy?.7:1}} disabled={busy} onClick={send}>
          {busy ? 'Sending…' : 'Send invoice'}
        </button>
        <button style={btnSec} onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Modal>
  )
}

const lbl = { fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }
