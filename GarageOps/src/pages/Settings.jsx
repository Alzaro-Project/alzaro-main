import { useState, useEffect } from 'react'
import { useStore, TIER_ORDER } from '../store/useStore'
import { SMTP_PRESETS } from '../lib/email'
import { supabase } from '../lib/supabase'

// ============================================================
// Settings — GarageOps
// ------------------------------------------------------------
// Tabs: Garage · Bookings · Email · VAT · Subscription
// Draft pattern: edits stay local until Save Changes is clicked.
// Persisted via useStore.updateSettings -> garages table.
// ============================================================

const T = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surface2: 'var(--surface2)',
  surface3: 'var(--surface3)',
  border: 'var(--border)',
  border2: 'var(--border2)',
  red: 'var(--red)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  blue: 'var(--blue)',
  teal: 'var(--teal)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
}

const TABS = [
  { key: 'garage',       label: 'Garage',       icon: 'ti-building-warehouse' },
  { key: 'bookings',     label: 'Bookings',     icon: 'ti-calendar-cog' },
  { key: 'email',        label: 'Email',        icon: 'ti-mail' },
  { key: 'vat',          label: 'VAT',          icon: 'ti-receipt-tax' },
  { key: 'subscription', label: 'Subscription', icon: 'ti-credit-card' },
]

const TIERS = [
  { key: 'basic', label: 'Basic', icon: '⚪', price: '£12.99/mo', color: '#6b7280',
    features: ['Invoicing', 'Bookings calendar', 'Customers & vehicles', 'Items & purchases', '1 user'] },
  { key: 'bronze', label: 'Bronze', icon: '🥉', price: '£18.99/mo', color: '#cd7f32',
    features: ['50 invoices/month', 'Bookings calendar', 'Customers & vehicles', 'Purchases tracking', '1 user'] },
  { key: 'silver', label: 'Silver', icon: '🥈', price: '£28.99/mo', color: '#c0c0c0',
    features: ['Unlimited invoices', 'VAT & reports', 'MOT reminders', 'Invoice emails from your domain', '2 users'] },
  { key: 'gold', label: 'Gold', icon: '🥇', price: '£39.99/mo', color: '#f5c842',
    features: ['Everything in Silver', 'Full P&L dashboard', 'Advanced reports & export', 'Priority support', 'Unlimited users'] },
]

export default function Settings() {
  const { settings, tier, setTier, updateSettings, garageId } = useStore()
  const [activeTab, setActiveTab] = useState('garage')
  const [smtpTestStatus, setSmtpTestStatus] = useState(null)
  const [smtpTestError, setSmtpTestError] = useState('')
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')

  // Local draft — edits stay here until Save is clicked
  const [draft, setDraft] = useState(settings)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved'

  useEffect(() => {
    if (!dirty) setDraft(settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const setField = (patch) => {
    setDraft(d => ({ ...d, ...patch }))
    setDirty(true)
  }

  const saveSettings = async () => {
    setSaveStatus('saving')
    await updateSettings(draft)
    setDirty(false)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(null), 2500)
  }

  // ---------- Logo upload (Supabase Storage 'logos' bucket) ----------
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError('')
    if (!file.type.startsWith('image/')) { setLogoError('Please choose an image file (PNG or JPG).'); return }
    if (file.size > 2 * 1024 * 1024) { setLogoError('Logo must be under 2MB.'); return }
    setLogoUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${garageId}.${ext}`
      const { error } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setField({ logoUrl: `${data.publicUrl}?v=${Date.now()}` })
    } catch (err) {
      setLogoError('Upload failed: ' + (err.message || 'unknown error'))
    }
    setLogoUploading(false)
    e.target.value = ''
  }

  // ---------- SMTP ----------
  const handleSmtpProviderChange = (provider) => {
    const preset = SMTP_PRESETS[provider]
    if (preset) {
      setField({ smtpProvider: provider, smtpHost: preset.host, smtpPort: preset.port, smtpSecure: preset.secure })
    } else {
      setField({ smtpProvider: provider })
    }
  }

  const testSmtpConnection = async () => {
    if (!draft.smtpHost || !draft.smtpUser || !draft.smtpPass) {
      setSmtpTestStatus('error')
      setSmtpTestError('Fill in the SMTP host, username and password first.')
      return
    }
    setSmtpTestStatus('testing')
    setSmtpTestError('')
    try {
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: draft.smtpHost,
          port: draft.smtpPort || 587,
          secure: !!draft.smtpSecure,
          user: draft.smtpUser,
          pass: draft.smtpPass,
          fromName: draft.smtpFromName || draft.name || '',
        }),
      })
      if (res.status === 404) {
        setSmtpTestStatus('error')
        setSmtpTestError('Test endpoint not found (404) — /api/test-smtp is missing from the deployment.')
        return
      }
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.ok !== false) {
        setSmtpTestStatus('success')
      } else {
        setSmtpTestStatus('error')
        setSmtpTestError(json.error || `Server responded with status ${res.status}`)
      }
    } catch {
      setSmtpTestStatus('error')
      setSmtpTestError('Could not reach /api/test-smtp — the function may not be deployed yet.')
    }
  }

  const hasSmtp = draft.smtpHost && draft.smtpUser && draft.smtpPass
  const emailStatus = hasSmtp
    ? { configured: true, method: 'SMTP', color: T.green, bg: 'rgba(76,175,80,0.12)' }
    : { configured: false, method: 'Gmail fallback', color: T.amber, bg: 'rgba(255,179,0,0.12)' }

  // ---------- Save button (shared) ----------
  const SaveRow = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
      {dirty && saveStatus !== 'saving' && (
        <span style={{ fontSize: '12px', color: T.text3 }}>Unsaved changes</span>
      )}
      {saveStatus === 'saved' && (
        <span style={{ fontSize: '12px', color: T.green, fontWeight: 600 }}>✓ Saved</span>
      )}
      <button
        onClick={saveSettings}
        disabled={!dirty || saveStatus === 'saving'}
        style={{ ...primaryBtn, opacity: !dirty || saveStatus === 'saving' ? 0.5 : 1, cursor: dirty ? 'pointer' : 'default' }}
      >
        {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Settings</div>
          <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
            Your garage profile, bookings, email, VAT and plan
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {dirty && saveStatus !== 'saving' && (
            <span style={{ fontSize: '12px', color: T.text3 }}>Unsaved changes</span>
          )}
          {saveStatus === 'saved' && (
            <span style={{ fontSize: '12px', color: T.green, fontWeight: 600 }}>✓ Saved</span>
          )}
          <button
            onClick={saveSettings}
            disabled={!dirty || saveStatus === 'saving'}
            style={{ ...primaryBtn, opacity: !dirty || saveStatus === 'saving' ? 0.5 : 1, cursor: dirty ? 'pointer' : 'default' }}
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-nav" style={{
        display: 'flex', gap: '4px',
        background: T.surface, border: `0.5px solid ${T.border}`,
        padding: '4px', borderRadius: '10px',
        marginBottom: '16px', overflowX: 'auto', width: 'fit-content', maxWidth: '100%',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '9px 14px', borderRadius: '7px',
            fontSize: '12px', fontWeight: activeTab === t.key ? 500 : 400,
            color: activeTab === t.key ? T.text : T.text2,
            background: activeTab === t.key ? T.surface2 : 'transparent',
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            <i className={`ti ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '900px' }}>

        {/* ==================== GARAGE TAB ==================== */}
        {activeTab === 'garage' && (
          <Panel>
            <SectionTitle>Garage details</SectionTitle>
            <Hint>This information appears on your invoices and customer emails.</Hint>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <Lbl>Garage name</Lbl>
                <input style={inputStyle} value={draft.name || ''} onChange={e => setField({ name: e.target.value })} placeholder="e.g. Bletchley Motors" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <Lbl>Address</Lbl>
                <input style={inputStyle} value={draft.addr || ''} onChange={e => setField({ addr: e.target.value })} placeholder="123 High Street" />
              </div>
              <div>
                <Lbl>City</Lbl>
                <input style={inputStyle} value={draft.city || ''} onChange={e => setField({ city: e.target.value })} placeholder="Milton Keynes" />
              </div>
              <div>
                <Lbl>Postcode</Lbl>
                <input style={inputStyle} value={draft.post || ''} onChange={e => setField({ post: e.target.value })} placeholder="MK1 1AA" />
              </div>
              <div>
                <Lbl>Phone</Lbl>
                <input style={inputStyle} value={draft.phone || ''} onChange={e => setField({ phone: e.target.value })} placeholder="01908 123456" />
              </div>
              <div>
                <Lbl>Email</Lbl>
                <input style={inputStyle} type="email" value={draft.email || ''} onChange={e => setField({ email: e.target.value })} placeholder="info@yourgarage.co.uk" />
              </div>
            </div>

            {/* Logo */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${T.border}` }}>
              <Lbl>Company logo</Lbl>
              <div style={{ fontSize: '11px', color: T.text3, marginBottom: '10px' }}>
                Shown at the top of your invoices and invoice emails. PNG or JPG, max 2MB.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt="Company logo"
                    style={{ maxHeight: '64px', maxWidth: '200px', objectFit: 'contain', background: '#fff', border: `1px solid ${T.border}`, borderRadius: '8px', padding: '8px' }} />
                ) : (
                  <div style={{ width: '120px', height: '64px', border: `1px dashed ${T.border2}`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: T.text3 }}>
                    No logo yet
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ ...ghostBtn, cursor: 'pointer' }}>
                    {logoUploading ? 'Uploading...' : draft.logoUrl ? 'Replace logo' : 'Upload logo'}
                    <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} disabled={logoUploading} style={{ display: 'none' }} />
                  </label>
                  {draft.logoUrl && (
                    <button onClick={() => setField({ logoUrl: '' })}
                      style={{ background: 'none', border: 'none', color: T.red, fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              {logoError && <div style={{ marginTop: '8px', fontSize: '12px', color: T.red }}>{logoError}</div>}
              {draft.logoUrl && dirty && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: T.text3 }}>Remember to click Save Changes to keep your logo.</div>
              )}
            </div>

            {/* Pricing defaults */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${T.border}` }}>
              <SectionTitle>Pricing defaults</SectionTitle>
              <div style={{ maxWidth: '280px' }}>
                <Lbl>Default markup on purchases (%)</Lbl>
                <input
                  style={inputStyle} type="number" min="0" step="1"
                  value={draft.defaultMarkupPct ?? 40}
                  onChange={e => setField({ defaultMarkupPct: parseFloat(e.target.value) || 0 })}
                />
                <div style={{ fontSize: '10px', color: T.text3, marginTop: '4px' }}>
                  When you add an unbilled purchase to an invoice, the sale price is suggested at cost + this percentage. You can still change it per line.
                </div>
              </div>
            </div>

            <SaveRow />
          </Panel>
        )}

        {/* ==================== BOOKINGS TAB ==================== */}
        {activeTab === 'bookings' && (
          <Panel>
            <SectionTitle>Booking calendar</SectionTitle>
            <Hint>Controls how your Calendar page lays out the working day.</Hint>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', maxWidth: '560px' }}>
              <div>
                <Lbl>Slot length</Lbl>
                <select style={inputStyle} value={draft.bookingSlotMinutes ?? 30}
                  onChange={e => setField({ bookingSlotMinutes: parseInt(e.target.value, 10) })}>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>
              <div>
                <Lbl>Day starts</Lbl>
                <input style={inputStyle} type="time" value={draft.bookingDayStart || '08:00'}
                  onChange={e => setField({ bookingDayStart: e.target.value })} />
              </div>
              <div>
                <Lbl>Day ends</Lbl>
                <input style={inputStyle} type="time" value={draft.bookingDayEnd || '18:00'}
                  onChange={e => setField({ bookingDayEnd: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: `1px solid ${T.border}` }}>
              <SectionTitle>MOT reminders</SectionTitle>
              <div style={{ maxWidth: '280px' }}>
                <Lbl>Remind how many days before MOT due</Lbl>
                <input style={inputStyle} type="number" min="1" max="90"
                  value={draft.motReminderDays ?? 30}
                  onChange={e => setField({ motReminderDays: parseInt(e.target.value, 10) || 30 })} />
                <div style={{ fontSize: '10px', color: T.text3, marginTop: '4px' }}>
                  Vehicles appear in the dashboard's "MOTs due soon" list this many days ahead.
                </div>
              </div>
            </div>

            <SaveRow />
          </Panel>
        )}

        {/* ==================== EMAIL TAB ==================== */}
        {activeTab === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Status */}
            <Panel>
              <SectionTitle>Email service status</SectionTitle>
              <div style={{ background: T.surface2, borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace', background: emailStatus.bg, color: emailStatus.color }}>
                    {emailStatus.configured ? 'CONFIGURED' : 'NOT CONFIGURED'}
                  </span>
                  <span style={{ fontSize: '12px', color: T.text2 }}>Using {emailStatus.method}</span>
                </div>
                <div style={{ fontSize: '11px', color: T.text3 }}>Falls back to Gmail compose if not configured</div>
              </div>
            </Panel>

            {/* SMTP */}
            <Panel>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <SectionTitle style={{ marginBottom: 0 }}>SMTP configuration</SectionTitle>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace', background: 'rgba(45,212,191,0.12)', color: T.teal }}>RECOMMENDED</span>
              </div>
              <Hint>Send invoice emails directly from your own address instead of via Gmail.</Hint>

              <div style={{ marginBottom: '16px' }}>
                <Lbl>Email provider</Lbl>
                <select style={inputStyle} value={draft.smtpProvider || 'custom'} onChange={e => handleSmtpProviderChange(e.target.value)}>
                  <option value="custom">Custom SMTP server</option>
                  <optgroup label="Consumer email">
                    <option value="gmail">Gmail / Google Workspace</option>
                    <option value="outlook">Outlook / Microsoft 365</option>
                    <option value="yahoo">Yahoo Mail</option>
                    <option value="zoho">Zoho Mail</option>
                  </optgroup>
                  <optgroup label="Transactional email services">
                    <option value="sendgrid">SendGrid</option>
                    <option value="mailgun">Mailgun</option>
                    <option value="aws_ses">AWS SES</option>
                    <option value="postmark">Postmark</option>
                    <option value="mailjet">Mailjet</option>
                  </optgroup>
                </select>
                {draft.smtpProvider && SMTP_PRESETS[draft.smtpProvider]?.notes && (
                  <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)', borderRadius: '6px', fontSize: '11px', color: T.amber }}>
                    💡 {SMTP_PRESETS[draft.smtpProvider].notes}
                  </div>
                )}
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <Lbl>SMTP host</Lbl>
                  <input style={inputStyle} value={draft.smtpHost || ''} onChange={e => setField({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <Lbl>Port</Lbl>
                  <input style={inputStyle} type="number" value={draft.smtpPort || 587} onChange={e => setField({ smtpPort: parseInt(e.target.value) || 587 })} placeholder="587" />
                </div>
                <div>
                  <Lbl>Security</Lbl>
                  <select style={inputStyle} value={draft.smtpSecure ? 'ssl' : 'tls'} onChange={e => setField({ smtpSecure: e.target.value === 'ssl' })}>
                    <option value="tls">TLS (Port 587)</option>
                    <option value="ssl">SSL (Port 465)</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <Lbl>Username / email</Lbl>
                  <input style={inputStyle} value={draft.smtpUser || ''} onChange={e => setField({ smtpUser: e.target.value })} placeholder="your-email@gmail.com" />
                </div>
                <div>
                  <Lbl>Password / app password</Lbl>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inputStyle, paddingRight: '40px' }} type={showSmtpPassword ? 'text' : 'password'}
                      value={draft.smtpPass || ''} onChange={e => setField({ smtpPass: e.target.value })} placeholder="••••••••••••" />
                    <button type="button" onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: T.text3 }}>
                      <i className={`ti ${showSmtpPassword ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <Lbl>From name</Lbl>
                  <input style={inputStyle} value={draft.smtpFromName || ''} onChange={e => setField({ smtpFromName: e.target.value })} placeholder={draft.name || 'Your Garage'} />
                </div>
                <div>
                  <Lbl>From email</Lbl>
                  <input style={inputStyle} type="email" value={draft.smtpFromEmail || ''} onChange={e => setField({ smtpFromEmail: e.target.value })} placeholder="invoices@yourdomain.com" />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <Lbl>Reply-to email (optional)</Lbl>
                <input style={inputStyle} type="email" value={draft.smtpReplyTo || ''} onChange={e => setField({ smtpReplyTo: e.target.value })} placeholder="support@yourdomain.com" />
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button onClick={testSmtpConnection} disabled={smtpTestStatus === 'testing'} style={{ ...ghostBtn, color: T.teal, borderColor: 'rgba(45,212,191,0.4)' }}>
                  {smtpTestStatus === 'testing' ? 'Connecting...' :
                   smtpTestStatus === 'success' ? '✓ Connected!' :
                   smtpTestStatus === 'error' ? '✗ Failed — try again' : 'Test connection'}
                </button>
                <span style={{ fontSize: '11px', color: T.text3 }}>
                  Connects to your email server and sends a test email from {draft.smtpUser || 'your address'}
                </span>
              </div>

              {smtpTestStatus === 'success' && (
                <div style={{ marginTop: '12px', background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: T.green }}>
                  ✓ Connected and authenticated. A test email was sent from <strong>{draft.smtpUser}</strong> to itself — check that inbox to confirm. Don't forget to <strong>Save Changes</strong> so these details are kept.
                </div>
              )}
              {smtpTestStatus === 'error' && smtpTestError && (
                <div style={{ marginTop: '12px', background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: T.red }}>
                  ✗ Not connected: {smtpTestError}
                </div>
              )}
            </Panel>

            {/* Email defaults */}
            <Panel>
              <SectionTitle>Email defaults</SectionTitle>
              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <Lbl>Default from name</Lbl>
                  <input style={inputStyle} value={draft.emailFromName || draft.name || ''} onChange={e => setField({ emailFromName: e.target.value })} placeholder="Your Garage" />
                </div>
                <div>
                  <Lbl>Default reply-to email</Lbl>
                  <input style={inputStyle} type="email" value={draft.emailReplyTo || draft.email || ''} onChange={e => setField({ emailReplyTo: e.target.value })} placeholder="invoices@yourgarage.co.uk" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <Lbl>Payment information text (shown in the highlighted box on invoices)</Lbl>
                  <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} value={draft.emailFooter || ''} onChange={e => setField({ emailFooter: e.target.value })}
                    placeholder="e.g. Bank transfer: Sort 12-34-56 · Account 12345678. Payment due within 14 days." />
                </div>
              </div>
            </Panel>

            <SaveRow />
          </div>
        )}

        {/* ==================== VAT TAB ==================== */}
        {activeTab === 'vat' && (
          <Panel>
            <SectionTitle>VAT configuration</SectionTitle>
            <Hint>Your VAT scheme and registration details for HMRC compliance.</Hint>

            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <Lbl>VAT scheme</Lbl>
                <select style={inputStyle} value={draft.vatScheme || 'standard'} onChange={e => setField({ vatScheme: e.target.value })}>
                  <option value="standard">Standard Rate (20%)</option>
                  <option value="flatrate">Flat Rate Scheme</option>
                  <option value="exempt">VAT Exempt</option>
                </select>
              </div>
              <div>
                <Lbl>VAT number</Lbl>
                <input style={inputStyle} value={draft.vatNumber || ''} onChange={e => setField({ vatNumber: e.target.value })} placeholder="GB123456789" />
              </div>
              {draft.vatScheme === 'flatrate' && (
                <div>
                  <Lbl>Flat rate percentage</Lbl>
                  <input style={inputStyle} type="number" step="0.1" value={draft.flatRate || 8.5} onChange={e => setField({ flatRate: parseFloat(e.target.value) })} placeholder="8.5" />
                  <div style={{ fontSize: '10px', color: T.text3, marginTop: '4px' }}>Check HMRC for your trade's flat rate percentage</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '20px' }}>
              {draft.vatScheme === 'standard' && (
                <InfoBox color={T.blue} bg="rgba(96,165,250,0.08)" border="rgba(96,165,250,0.2)" title="Standard Rate (20%)">
                  Charge 20% VAT on sales and reclaim VAT on purchases. Most businesses use this scheme — it's also why logging the VAT on every purchase matters.
                </InfoBox>
              )}
              {draft.vatScheme === 'flatrate' && (
                <InfoBox color={T.amber} bg="rgba(255,179,0,0.08)" border="rgba(255,179,0,0.2)" title="Flat Rate Scheme">
                  Pay a fixed percentage of gross sales to HMRC. Simpler bookkeeping but you cannot reclaim VAT on purchases (except capital assets over £2,000).
                </InfoBox>
              )}
              {draft.vatScheme === 'exempt' && (
                <InfoBox color={T.text} bg={T.surface2} border={T.border} title="VAT Exempt">
                  Not registered for VAT. Invoices will not include VAT charges.
                </InfoBox>
              )}
            </div>

            <SaveRow />
          </Panel>
        )}

        {/* ==================== SUBSCRIPTION TAB ==================== */}
        {activeTab === 'subscription' && (
          <SubscriptionTab tier={tier} setTier={setTier} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// SUBSCRIPTION TAB
// ============================================================
function SubscriptionTab({ tier }) {
  const user = useStore(s => s.user)
  const garageId = useStore(s => s.garageId)
  const reloadData = useStore(s => s.reloadData)
  const [showInvoicesModal, setShowInvoicesModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [changingTier, setChangingTier] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Returning from Stripe Checkout? The webhook updates the product_members row
  // server-side; refresh local state so the new tier/status shows, then tidy URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('billing') === 'success') reloadData()
    if (params.get('billing')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [reloadData])

  // Current Supabase access token for authenticating API calls.
  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    }
  }

  // Start a real Stripe Checkout for the chosen tier, then redirect to it.
  // garageId is the product_members row id — the webhook's PATCH key.
  const handleTierChange = async (newTier) => {
    if (!garageId || !user?.email) {
      alert('Your account is still loading — please try again in a moment.')
      return
    }
    setChangingTier(newTier)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          email: user.email,
          garageId,
          product: 'garageops',
          tier: newTier,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (err) {
      alert(err.message || 'Could not start checkout')
      setChangingTier(null)
    }
  }

  // Open the Stripe Billing Portal to update payment details or cancel.
  const openPortal = async () => {
    if (!garageId) {
      alert('Your account is still loading — please try again in a moment.')
      return
    }
    setPortalLoading(true)
    try {
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ garageId, product: 'garageops' }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open billing portal')
      window.location.href = data.url
    } catch (err) {
      alert(err.message || 'Could not open billing portal')
      setPortalLoading(false)
    }
  }

  // Placeholder billing history until Stripe is wired up
  const billingInvoices = [
    { id: 'SUB-2026-06', date: '2026-06-01', amount: 90, status: 'paid' },
    { id: 'SUB-2026-05', date: '2026-05-01', amount: 90, status: 'paid' },
    { id: 'SUB-2026-04', date: '2026-04-01', amount: 75, status: 'paid' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Panel>
        <SectionTitle>Current plan</SectionTitle>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
          {TIERS.map(t => (
            <div key={t.key} style={{
              background: tier === t.key ? T.surface2 : T.surface,
              border: `2px solid ${tier === t.key ? t.color : T.border}`,
              borderRadius: '12px', padding: '20px', position: 'relative',
              minWidth: '220px', flex: '1 0 220px', scrollSnapAlign: 'start',
            }}>
              {tier === t.key && (
                <div style={{ position: 'absolute', top: '-10px', right: '12px', background: t.color, color: '#000', fontSize: '10px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px' }}>
                  CURRENT
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: '18px', color: t.color, marginBottom: '4px' }}>
                {t.icon} {t.label}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>
                {t.price}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {t.features.map(feat => (
                  <div key={feat} style={{ fontSize: '12px', color: T.text2, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: t.color }}>✓</span> {feat}
                  </div>
                ))}
              </div>
              {tier !== t.key && (
                <button
                  onClick={() => handleTierChange(t.key)}
                  disabled={changingTier !== null}
                  style={{
                    ...(TIER_ORDER.indexOf(t.key) > TIER_ORDER.indexOf(tier) ? primaryBtn : ghostBtn),
                    width: '100%', justifyContent: 'center',
                    opacity: changingTier !== null ? 0.6 : 1,
                  }}>
                  {changingTier === t.key ? 'Changing...' :
                   TIER_ORDER.indexOf(t.key) > TIER_ORDER.indexOf(tier) ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '11px', color: T.text3, marginTop: '12px', textAlign: 'center' }}>
          ← Swipe to see all plans →
        </div>
      </Panel>

      {/* Billing */}
      <Panel>
        <SectionTitle>Billing information</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: T.surface2, borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: T.text3, marginBottom: '4px' }}>Next invoice</div>
            <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 600 }}>1st of next month</div>
          </div>
          <div style={{ background: T.surface2, borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: T.text3, marginBottom: '4px' }}>Payment method</div>
            <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 600 }}>Invoice / bank transfer</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={{ ...ghostBtn, opacity: portalLoading ? 0.6 : 1 }} onClick={openPortal} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : 'Manage subscription'}
          </button>
          <button style={{ ...ghostBtn, background: 'transparent', border: 'none', color: T.text2 }} onClick={() => setShowInvoicesModal(true)}>View invoices</button>
        </div>
      </Panel>

      {/* Danger zone */}
      <Panel style={{ border: '1px solid rgba(229,57,53,0.3)' }}>
        <SectionTitle style={{ color: T.red }}>Danger zone</SectionTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Cancel subscription</div>
            <div style={{ fontSize: '12px', color: T.text2 }}>Your data will be retained for 30 days after cancellation.</div>
          </div>
          <button style={{ ...ghostBtn, color: T.red, borderColor: 'rgba(229,57,53,0.4)' }} onClick={() => setShowCancelModal(true)}>Cancel plan</button>
        </div>
      </Panel>

      {/* Modals */}
      {showInvoicesModal && (
        <Modal title="Billing invoices" onClose={() => setShowInvoicesModal(false)}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '16px' }}>
            <thead>
              <tr>
                {['Invoice', 'Date', 'Amount', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: T.text3, padding: '8px', borderBottom: `1px solid ${T.border}`, fontFamily: 'monospace' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billingInvoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{inv.id}</td>
                  <td style={{ padding: '10px 8px', color: T.text2 }}>{inv.date}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>£{inv.amount}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: 'rgba(76,175,80,0.12)', color: T.green }}>PAID</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: '11px', color: T.text3, marginBottom: '12px' }}>
            Need a copy for your records? Email support@alzaro.co.uk and we'll send PDFs.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={ghostBtn} onClick={() => setShowInvoicesModal(false)}>Close</button>
          </div>
        </Modal>
      )}

      {showCancelModal && (
        <Modal title="Cancel subscription" onClose={() => setShowCancelModal(false)}>
          <div style={{ background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.2)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: T.red, marginBottom: '8px' }}>⚠ Are you sure?</div>
            <div style={{ fontSize: '13px', color: T.text2, lineHeight: 1.5 }}>If you cancel your subscription:</div>
            <ul style={{ fontSize: '12px', color: T.text2, marginTop: '8px', paddingLeft: '20px' }}>
              <li>Your account stays active until the end of the billing period</li>
              <li>Your data is retained for 30 days</li>
              <li>You can resubscribe at any time</li>
            </ul>
          </div>
          <p style={{ fontSize: '13px', color: T.text2, marginBottom: '16px' }}>
            To cancel, email <a href="mailto:support@alzaro.co.uk?subject=Cancel GarageOps subscription" style={{ color: T.red }}>support@alzaro.co.uk</a> from your registered address.
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button style={primaryBtn} onClick={() => setShowCancelModal(false)}>Keep subscription</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ============================================================
// SMALL SHARED PIECES
// ============================================================
function Panel({ children, style = {} }) {
  return (
    <div className="card" style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '20px', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ children, style = {} }) {
  return (
    <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: T.text2, fontFamily: 'monospace', marginBottom: '12px', ...style }}>
      {children}
    </div>
  )
}

function Hint({ children }) {
  return <p style={{ fontSize: '12px', color: T.text2, marginTop: '-6px', marginBottom: '16px' }}>{children}</p>
}

function Lbl({ children }) {
  return (
    <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 500 }}>
      {children}
    </div>
  )
}

function InfoBox({ color, bg, border, title, children }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '14px' }}>
      <div style={{ fontWeight: 600, fontSize: '13px', color, marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '12px', color: T.text2 }}>{children}</div>
    </div>
  )
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: '16px', width: '500px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {title}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, fontSize: '20px', cursor: 'pointer' }}>
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ============================================================
// STYLES (match Items/Purchases)
// ============================================================
const primaryBtn = {
  background: T.red, color: '#fff', border: 'none',
  padding: '10px 16px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const ghostBtn = {
  background: T.surface3, color: T.text, border: `1px solid ${T.border2}`,
  padding: '10px 14px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const inputStyle = {
  width: '100%',
  background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px',
  padding: '9px 12px', color: T.text, fontSize: '13px',
  fontFamily: 'inherit', outline: 'none',
}
