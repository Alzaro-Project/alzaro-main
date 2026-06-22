import { useState, useEffect, useMemo, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader, Card, Btn, Badge } from '../components/UI'
import {
  computeDueFollowups,
  renderFollowupMessages,
  buildWhatsAppLink,
  buildSmsLink,
  formatDate,
  DEFAULT_TEMPLATES,
  DEFAULT_FOLLOWUP_MONTHS,
  TEMPLATE_TOKENS,
} from '../lib/followups'
import { getSentLog, recordSend, clearSend } from '../lib/followupSends'
import { sendCustomEmail, plainToHtml } from '../lib/email'

// Follow-up templates live in localStorage for Stage 1 (no schema change
// needed). STAGE 2: move these into product_settings via updateSettings so
// they sync across devices and the automated sender uses the same wording.
const TEMPLATE_STORAGE_PREFIX = 'tyreops-followup-templates'

function loadTemplates(garageId) {
  try {
    const raw = localStorage.getItem(`${TEMPLATE_STORAGE_PREFIX}:${garageId || 'local'}`)
    return raw ? { ...DEFAULT_TEMPLATES, ...JSON.parse(raw) } : { ...DEFAULT_TEMPLATES }
  } catch {
    return { ...DEFAULT_TEMPLATES }
  }
}
function saveTemplates(garageId, templates) {
  try {
    localStorage.setItem(`${TEMPLATE_STORAGE_PREFIX}:${garageId || 'local'}`, JSON.stringify(templates))
  } catch (err) {
    console.error('Failed to save follow-up templates:', err)
  }
}

const inputStyle = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px',
  padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%',
  fontFamily: 'inherit',
}

export default function FollowUps() {
  const { invoices, customers, settings, garageId } = useStore()

  const [sentLog, setSentLog] = useState({})
  const [templates, setTemplates] = useState(() => loadTemplates(garageId))
  const [showTemplates, setShowTemplates] = useState(false)
  const [showSent, setShowSent] = useState(false)
  const [preview, setPreview] = useState(null) // entry being previewed/sent
  const [sendingEmail, setSendingEmail] = useState(false)

  // Load the send log (localStorage now; Supabase in Stage 2 — same call).
  useEffect(() => {
    let active = true
    getSentLog(garageId).then(log => { if (active) setSentLog(log) })
    return () => { active = false }
  }, [garageId])

  // Reload templates if the garage changes (e.g. account switch).
  useEffect(() => { setTemplates(loadTemplates(garageId)) }, [garageId])

  // The heart of it: who is due? Recomputed when data or the log changes.
  const due = useMemo(() => computeDueFollowups({
    invoices, customers, sentLog, months: DEFAULT_FOLLOWUP_MONTHS,
  }), [invoices, customers, sentLog])

  const pending = due.filter(e => !e.alreadySent)
  const handled = due.filter(e => e.alreadySent)

  const overdueCount = pending.filter(e => e.overdue).length
  const dueSoonCount = pending.length - overdueCount

  const refreshLog = useCallback(async () => {
    setSentLog(await getSentLog(garageId))
  }, [garageId])

  const markSent = useCallback(async (entry, channel) => {
    await recordSend(garageId, entry, channel)
    await refreshLog()
  }, [garageId, refreshLog])

  const unmark = useCallback(async (entry) => {
    await clearSend(garageId, entry.key)
    await refreshLog()
  }, [garageId, refreshLog])

  // --- Channel actions (Stage 1: manual) ---

  const handleWhatsApp = (entry) => {
    const { smsBody } = renderFollowupMessages(entry, settings, templates)
    window.open(buildWhatsAppLink(entry.phone, smsBody), '_blank')
    markSent(entry, 'whatsapp')
  }

  const handleSms = (entry) => {
    const { smsBody } = renderFollowupMessages(entry, settings, templates)
    // sms: links must navigate the top window to open the Messages app.
    window.location.assign(buildSmsLink(entry.phone, smsBody))
    markSent(entry, 'sms')
  }

  const handleSendEmail = async (entry) => {
    const { emailSubject, emailBody } = renderFollowupMessages(entry, settings, templates)
    setSendingEmail(true)
    const result = await sendCustomEmail({
      to: entry.email,
      subject: emailSubject,
      html: plainToHtml(emailBody, settings),
      text: emailBody,
      fromName: settings.emailFromName || settings.name || 'Alzaro TyreOps',
      replyTo: settings.emailReplyTo || settings.email || undefined,
    })
    setSendingEmail(false)
    if (result.success) {
      await markSent(entry, 'email')
      setPreview(null)
      toast('Follow-up email sent', 'success')
    } else {
      toast(result.error || 'Failed to send email', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Customer Follow-Ups"
        subtitle={`Customers due a check-in ${DEFAULT_FOLLOWUP_MONTHS} months after a tyre fitting`}
      >
        <Btn variant="secondary" onClick={() => setShowTemplates(true)}>✏️ Templates</Btn>
      </PageHeader>

      {/* Stat row */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <MiniStat label="Due now" value={pending.length} color="var(--accent)" />
        <MiniStat label="Overdue" value={overdueCount} color="var(--red)" />
        <MiniStat label="Upcoming" value={dueSoonCount} color="var(--text)" />
      </div>

      {/* Stage banner */}
      <Card style={{ marginBottom: '16px', background: 'var(--surface2)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '16px' }}>💡</span>
        <div style={{ fontSize: '12px', color: 'var(--text2)', lineHeight: 1.5 }}>
          Manual send mode. Email goes out through your account's email service.
          WhatsApp and SMS open on your own phone so you send the text yourself — no per-message cost.
          Sent reminders move to <strong>Already contacted</strong> so customers don't reappear.
        </div>
      </Card>

      {/* Pending list */}
      {pending.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text2)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>No follow-ups due</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Customers will appear here {DEFAULT_FOLLOWUP_MONTHS} months after their tyre fitting.
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {pending.map(entry => (
            <FollowupRow
              key={entry.key}
              entry={entry}
              onEmail={() => setPreview(entry)}
              onWhatsApp={() => handleWhatsApp(entry)}
              onSms={() => handleSms(entry)}
              onSkip={() => markSent(entry, 'skip')}
            />
          ))}
        </div>
      )}

      {/* Already-contacted (collapsible) */}
      {handled.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div
            onClick={() => setShowSent(s => !s)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '10px', userSelect: 'none' }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{showSent ? '▾' : '▸'}</span>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Already contacted ({handled.length})</span>
          </div>
          {showSent && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {handled.map(entry => (
                <FollowupRow key={entry.key} entry={entry} sent onUndo={() => unmark(entry)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Email preview / confirm modal */}
      {preview && (
        <EmailPreviewModal
          entry={preview}
          settings={settings}
          templates={templates}
          sending={sendingEmail}
          onClose={() => setPreview(null)}
          onSend={() => handleSendEmail(preview)}
        />
      )}

      {/* Templates editor modal */}
      {showTemplates && (
        <TemplateEditorModal
          templates={templates}
          onClose={() => setShowTemplates(false)}
          onSave={(t) => { setTemplates(t); saveTemplates(garageId, t); setShowTemplates(false); toast('Templates saved', 'success') }}
        />
      )}
    </div>
  )
}

// --------------------------------------------------------
// ROW
// --------------------------------------------------------
function FollowupRow({ entry, onEmail, onWhatsApp, onSms, onSkip, sent, onUndo }) {
  const hasEmail = !!entry.email
  const hasPhone = !!entry.phone

  return (
    <Card style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '180px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{entry.name}</span>
          {entry.reg && <Badge variant="gray">{entry.reg}</Badge>}
          {!sent && entry.overdue && <Badge variant="red">Overdue</Badge>}
          {!sent && !entry.overdue && <Badge variant="yellow">Due soon</Badge>}
          {sent && <Badge variant="green">Contacted{entry.sentRecord?.channel ? ` · ${entry.sentRecord.channel}` : ''}</Badge>}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>
          Fitted {formatDate(new Date(entry.fittingDate))} · due {formatDate(entry.dueDate)}
          {!sent && (entry.overdue
            ? ` · ${Math.abs(entry.daysUntilDue)} days overdue`
            : entry.daysUntilDue === 0 ? ' · due today' : ` · in ${entry.daysUntilDue} days`)}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
          {entry.email || 'no email'} · {entry.phone || 'no phone'}
        </div>
      </div>

      {sent ? (
        <Btn variant="ghost" sm onClick={onUndo}>↺ Undo</Btn>
      ) : (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Btn variant="primary" sm onClick={onEmail} disabled={!hasEmail}>
            ✉️ Email
          </Btn>
          <Btn variant="success" sm onClick={onWhatsApp} disabled={!hasPhone}>
            💬 WhatsApp
          </Btn>
          <Btn variant="secondary" sm onClick={onSms} disabled={!hasPhone}>
            📱 SMS
          </Btn>
          <Btn variant="ghost" sm onClick={onSkip}>Skip</Btn>
        </div>
      )}
    </Card>
  )
}

// --------------------------------------------------------
// EMAIL PREVIEW MODAL
// --------------------------------------------------------
function EmailPreviewModal({ entry, settings, templates, sending, onClose, onSend }) {
  const { emailSubject, emailBody } = renderFollowupMessages(entry, settings, templates)
  return (
    <ModalShell onClose={onClose} title={`Email to ${entry.name}`}>
      <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>To</div>
      <div style={{ ...inputStyle, marginBottom: '12px', opacity: 0.85 }}>{entry.email}</div>

      <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>Subject</div>
      <div style={{ ...inputStyle, marginBottom: '12px', fontWeight: 600 }}>{emailSubject}</div>

      <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>Message</div>
      <div style={{
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px',
        padding: '12px', fontSize: '12px', color: 'var(--text)', whiteSpace: 'pre-wrap',
        lineHeight: 1.55, maxHeight: '300px', overflowY: 'auto',
      }}>{emailBody}</div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={onSend}>{sending ? 'Sending…' : 'Send email'}</Btn>
      </div>
    </ModalShell>
  )
}

// --------------------------------------------------------
// TEMPLATE EDITOR MODAL
// --------------------------------------------------------
function TemplateEditorModal({ templates, onClose, onSave }) {
  const [draft, setDraft] = useState(templates)
  const d = (k, v) => setDraft(p => ({ ...p, [k]: v }))

  const taStyle = { ...inputStyle, minHeight: '120px', resize: 'vertical', lineHeight: 1.5 }

  return (
    <ModalShell onClose={onClose} title="Follow-up templates" wide>
      <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '14px', lineHeight: 1.5 }}>
        Available tokens: {TEMPLATE_TOKENS.map(t => (
          <code key={t} style={{ background: 'var(--surface3)', padding: '1px 5px', borderRadius: '4px', margin: '0 3px', fontSize: '11px' }}>{`{{${t}}}`}</code>
        ))}
      </div>

      <Field label="Email subject">
        <input style={inputStyle} value={draft.emailSubject} onChange={e => d('emailSubject', e.target.value)} />
      </Field>
      <Field label="Email body">
        <textarea style={taStyle} value={draft.emailBody} onChange={e => d('emailBody', e.target.value)} />
      </Field>
      <Field label="WhatsApp / SMS message">
        <textarea style={{ ...taStyle, minHeight: '90px' }} value={draft.smsBody} onChange={e => d('smsBody', e.target.value)} />
      </Field>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <Btn variant="ghost" sm onClick={() => setDraft({ ...DEFAULT_TEMPLATES })}>Reset to defaults</Btn>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onSave(draft)}>Save templates</Btn>
        </div>
      </div>
    </ModalShell>
  )
}

// --------------------------------------------------------
// SHARED BITS
// --------------------------------------------------------
function MiniStat({ label, value, color }) {
  return (
    <Card>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>{label}</div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '24px', fontWeight: 500, marginTop: '5px', color }}>{value}</div>
    </Card>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '4px' }}>{label}</div>
      {children}
    </div>
  )
}

function ModalShell({ title, children, onClose, wide }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-content" style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px',
        padding: '20px', width: wide ? '560px' : '460px', maxWidth: '95vw', maxHeight: '88vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--text2)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Lightweight toast (mirrors the store's toast styling without importing it).
function toast(message, type = 'success') {
  let c = document.getElementById('garageiq-toast-container')
  if (!c) {
    c = document.createElement('div')
    c.id = 'garageiq-toast-container'
    c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;'
    document.body.appendChild(c)
  }
  const t = document.createElement('div')
  t.style.cssText = `padding:14px 20px;border-radius:8px;color:#fff;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:360px;background:${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};`
  t.textContent = message
  c.appendChild(t)
  setTimeout(() => t.remove(), 4000)
}
