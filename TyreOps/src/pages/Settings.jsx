import { useState, useEffect } from 'react'
import { useStore, TIER_ORDER, TIER_PRICE } from '../store/useStore'
import { PageHeader, Card, Btn, Badge } from '../components/UI'
import { SMTP_PRESETS } from '../lib/email'
import { supabase } from '../lib/supabase'

const TABS = [
  { key: 'garage', label: '🏢 Garage', icon: '🏢' },
  { key: 'email', label: '📧 Email', icon: '📧' },
  { key: 'vat', label: '📊 VAT', icon: '📊' },
  { key: 'subscription', label: '💳 Subscription', icon: '💳' },
  { key: 'users', label: '👥 Users', icon: '👥' },
  { key: 'accountant', label: '📗 Accountant', icon: '📗' },
]

export default function Settings() {
  const { settings, tier, setTier, updateSettings, garageId } = useStore()
  const [activeTab, setActiveTab] = useState('garage')
  const [smtpTestStatus, setSmtpTestStatus] = useState(null)
  const [smtpTestError, setSmtpTestError] = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')

  // Upload company logo to Supabase Storage, save its public URL to settings
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError('')

    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file (PNG or JPG).')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Logo must be under 2MB.')
      return
    }

    setLogoUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${garageId}.${ext}`
      const { error } = await supabase.storage
        .from('logos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error

      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      // Cache-bust so a replaced logo shows immediately
      setField({ logoUrl: `${data.publicUrl}?v=${Date.now()}` })
    } catch (err) {
      setLogoError('Upload failed: ' + (err.message || 'unknown error'))
    }
    setLogoUploading(false)
    e.target.value = '' // allow re-selecting the same file
  }
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)

  // Local draft of settings — edits stay here until Save is clicked
  const [draft, setDraft] = useState(settings)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved'

  // Re-sync draft when settings arrive from Supabase (only if nothing unsaved)
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

  // Save button row shown at the bottom of each tab
  const renderSaveRow = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
      {dirty && saveStatus !== 'saving' && (
        <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Unsaved changes</span>
      )}
      {saveStatus === 'saved' && (
        <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>✓ Saved</span>
      )}
      <button
        onClick={saveSettings}
        disabled={!dirty || saveStatus === 'saving'}
        style={{
          background: 'var(--accent)',
          color: 'var(--accent-text)',
          fontWeight: 700,
          fontSize: '13px',
          padding: '10px 20px',
          borderRadius: '8px',
          border: 'none',
          cursor: dirty ? 'pointer' : 'default',
          opacity: !dirty || saveStatus === 'saving' ? 0.5 : 1,
          transition: 'opacity .15s',
        }}
      >
        {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )

  const inputStyle = { 
    background: 'var(--surface2)', 
    border: '1px solid var(--border)', 
    borderRadius: '8px', 
    padding: '10px 12px', 
    color: 'var(--text)', 
    fontSize: '13px', 
    outline: 'none', 
    width: '100%',
    transition: 'border-color 0.15s',
  }

  const labelStyle = { 
    fontSize: '11px', 
    fontWeight: 600, 
    color: 'var(--text2)', 
    display: 'block', 
    marginBottom: '6px' 
  }

  const sectionTitle = { 
    fontSize: '11px', 
    fontWeight: 700, 
    letterSpacing: '.8px', 
    textTransform: 'uppercase', 
    color: 'var(--text2)', 
    fontFamily: 'DM Mono, monospace', 
    marginBottom: '16px' 
  }

  const TIERS = [
    { key: 'basic', label: '⚪ Basic', price: `£${TIER_PRICE.basic}/mo`, color: '#6b7280', features: ['Invoicing', 'Inventory & purchases', 'Customer database', 'FIFO automatic', '1 user'] },
    { key: 'bronze', label: '🥉 Bronze', price: `£${TIER_PRICE.bronze}/mo`, color: '#cd7f32', features: ['Everything in Basic', 'Customer follow-ups', 'Email & WhatsApp reminders', '1 user'] },
    { key: 'silver', label: '🥈 Silver', price: `£${TIER_PRICE.silver}/mo`, color: '#c0c0c0', features: ['Everything in Bronze', 'VAT reports', 'Used tyres', 'Supplier tracking', '2 users'] },
    { key: 'gold', label: '🥇 Gold', price: `£${TIER_PRICE.gold}/mo`, color: 'var(--accent)', features: ['Everything in Silver', 'Full P&L dashboard', 'VAT Margin Scheme', 'Reports & export', 'Unlimited users'] },
  ]

  // Test SMTP connection
  // Tests the garage's own SMTP details for real via /api/test-smtp:
  // connects + logs in to their server, then sends a test email FROM their
  // address TO their address. Failures come back with the actual reason.
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

      let data = {}
      try { data = await res.json() } catch { /* non-JSON response */ }

      if (!res.ok) {
        throw new Error(data.error || `Server responded with status ${res.status}`)
      }

      setSmtpTestStatus('success')
      setSmtpTestError('')
      setTimeout(() => setSmtpTestStatus(null), 8000)
    } catch (err) {
      setSmtpTestStatus('error')
      if (err.message === 'Failed to fetch') {
        setSmtpTestError('Could not reach /api/test-smtp — the function may not be deployed yet.')
      } else if (err.message.includes('status 404')) {
        setSmtpTestError('Test endpoint not found (404) — /api/test-smtp is missing from the deployment.')
      } else {
        setSmtpTestError(err.message)
      }
    }
  }

  // Handle SMTP provider preset selection
  const handleSmtpProviderChange = (provider) => {
    const preset = SMTP_PRESETS[provider]
    if (preset) {
      setField({
        smtpProvider: provider,
        smtpHost: preset.host,
        smtpPort: preset.port,
        smtpSecure: preset.secure,
      })
    }
  }

  // Check if SMTP is configured
  const getEmailStatus = () => {
    const hasSmtp = draft.smtpHost && draft.smtpUser && draft.smtpPass

    if (hasSmtp) return { configured: true, method: 'SMTP', variant: 'green' }
    return { configured: false, method: 'Gmail fallback', variant: 'yellow' }
  }

  const emailStatus = getEmailStatus()

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your garage profile and preferences">
        {dirty && saveStatus !== 'saving' && (
          <span style={{ alignSelf: 'center', fontSize: '12px', color: 'var(--text3)' }}>Unsaved changes</span>
        )}
        {saveStatus === 'saved' && (
          <span style={{ alignSelf: 'center', fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>✓ Saved</span>
        )}
        <button
          onClick={saveSettings}
          disabled={!dirty || saveStatus === 'saving'}
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            fontWeight: 700,
            fontSize: '13px',
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            cursor: dirty ? 'pointer' : 'default',
            opacity: !dirty || saveStatus === 'saving' ? 0.5 : 1,
            transition: 'opacity .15s',
          }}
        >
          {saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
        </button>
      </PageHeader>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '4px', 
        background: 'var(--surface)', 
        border: '1px solid var(--border)',
        borderRadius: '12px', 
        padding: '6px', 
        marginBottom: '20px',
        width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <div 
            key={tab.key} 
            onClick={() => setActiveTab(tab.key)} 
            style={{
              padding: '10px 20px', 
              borderRadius: '8px', 
              fontSize: '13px', 
              fontWeight: 600, 
              cursor: 'pointer',
              transition: 'all .15s',
              background: activeTab === tab.key ? 'var(--accent)' : 'transparent',
              color: activeTab === tab.key ? '#000' : 'var(--text2)',
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ maxWidth: '900px' }}>
        
        {/* GARAGE TAB */}
        {activeTab === 'garage' && (
          <Card>
            <div style={sectionTitle}>Garage Details</div>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '20px', marginTop: '-8px' }}>
              This information appears on your invoices and customer communications.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Garage Name</label>
                <input 
                  style={inputStyle} 
                  value={draft.name || ''} 
                  onChange={e => setField({ name: e.target.value })} 
                  placeholder="Smith Tyres MK"
                />
              </div>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Address</label>
                <input 
                  style={inputStyle} 
                  value={draft.addr || ''} 
                  onChange={e => setField({ addr: e.target.value })} 
                  placeholder="123 High Street"
                />
              </div>
              
              <div>
                <label style={labelStyle}>City</label>
                <input 
                  style={inputStyle} 
                  value={draft.city || ''} 
                  onChange={e => setField({ city: e.target.value })} 
                  placeholder="Milton Keynes"
                />
              </div>
              
              <div>
                <label style={labelStyle}>Postcode</label>
                <input 
                  style={inputStyle} 
                  value={draft.post || ''} 
                  onChange={e => setField({ post: e.target.value })} 
                  placeholder="MK1 1AA"
                />
              </div>
              
              <div>
                <label style={labelStyle}>Phone</label>
                <input 
                  style={inputStyle} 
                  value={draft.phone || ''} 
                  onChange={e => setField({ phone: e.target.value })} 
                  placeholder="01908 123456"
                />
              </div>
              
              <div>
                <label style={labelStyle}>Email</label>
                <input 
                  style={inputStyle} 
                  type="email"
                  value={draft.email || ''} 
                  onChange={e => setField({ email: e.target.value })} 
                  placeholder="info@smithtyres.co.uk"
                />
              </div>
            </div>

            {/* Company Logo */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <label style={labelStyle}>Company Logo</label>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '10px' }}>
                Shown at the top of your invoices and invoice emails. PNG or JPG, max 2MB.
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {draft.logoUrl ? (
                  <img
                    src={draft.logoUrl}
                    alt="Company logo"
                    style={{ maxHeight: '64px', maxWidth: '200px', objectFit: 'contain', background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' }}
                  />
                ) : (
                  <div style={{ width: '120px', height: '64px', border: '1px dashed var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--text3)' }}>
                    No logo yet
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <label style={{ background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>
                    {logoUploading ? '⏳ Uploading...' : draft.logoUrl ? 'Replace Logo' : 'Upload Logo'}
                    <input type="file" accept="image/png,image/jpeg,image/jpg" onChange={handleLogoUpload} disabled={logoUploading} style={{ display: 'none' }} />
                  </label>
                  {draft.logoUrl && (
                    <button
                      onClick={() => setField({ logoUrl: '' })}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {logoError && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--red)' }}>{logoError}</div>
              )}
              {draft.logoUrl && dirty && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text3)' }}>
                  Remember to click Save Changes to keep your logo.
                </div>
              )}
            </div>

            {renderSaveRow()}
          </Card>
        )}

        {/* EMAIL TAB */}
        {activeTab === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Current Status */}
            <Card>
              <div style={sectionTitle}>Email Service Status</div>
              <div style={{ 
                background: 'var(--surface2)', 
                borderRadius: '10px', 
                padding: '16px', 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '4px' }}>Active Method</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge variant={emailStatus.variant}>
                      {emailStatus.configured ? 'Configured' : 'Not Configured'}
                    </Badge>
                    <span style={{ fontSize: '12px', color: 'var(--text2)' }}>
                      Using {emailStatus.method}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                  Falls back to Gmail compose if not configured
                </div>
              </div>
            </Card>

            {/* SMTP Configuration */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={sectionTitle}>SMTP Configuration</div>
                <Badge variant="teal">Recommended</Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '20px', marginTop: '-8px' }}>
                Send emails directly from your domain. Requires an Edge Function backend (Vercel/Supabase).
              </p>

              {/* Provider Presets */}
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Email Provider</label>
                <select 
                  style={inputStyle}
                  value={draft.smtpProvider || 'custom'}
                  onChange={e => handleSmtpProviderChange(e.target.value)}
                >
                  <option value="custom">Custom SMTP Server</option>
                  <optgroup label="Consumer Email">
                    <option value="gmail">Gmail / Google Workspace</option>
                    <option value="outlook">Outlook / Microsoft 365</option>
                    <option value="yahoo">Yahoo Mail</option>
                    <option value="zoho">Zoho Mail</option>
                  </optgroup>
                  <optgroup label="Transactional Email Services">
                    <option value="sendgrid">SendGrid</option>
                    <option value="mailgun">Mailgun</option>
                    <option value="aws_ses">AWS SES</option>
                    <option value="postmark">Postmark</option>
                    <option value="mailjet">Mailjet</option>
                  </optgroup>
                </select>
                
                {/* Provider-specific notes */}
                {draft.smtpProvider && SMTP_PRESETS[draft.smtpProvider]?.notes && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '10px 12px', 
                    background: 'rgba(245,200,66,0.08)', 
                    border: '1px solid rgba(245,200,66,0.2)', 
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--accent)'
                  }}>
                    💡 {SMTP_PRESETS[draft.smtpProvider].notes}
                  </div>
                )}
              </div>

              {/* SMTP Server Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>SMTP Host</label>
                  <input 
                    style={inputStyle} 
                    value={draft.smtpHost || ''} 
                    onChange={e => setField({ smtpHost: e.target.value })} 
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input 
                    style={inputStyle} 
                    type="number"
                    value={draft.smtpPort || 587} 
                    onChange={e => setField({ smtpPort: parseInt(e.target.value) || 587 })} 
                    placeholder="587"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Security</label>
                  <select 
                    style={inputStyle}
                    value={draft.smtpSecure ? 'ssl' : 'tls'}
                    onChange={e => setField({ smtpSecure: e.target.value === 'ssl' })}
                  >
                    <option value="tls">TLS (Port 587)</option>
                    <option value="ssl">SSL (Port 465)</option>
                  </select>
                </div>
              </div>

              {/* Authentication */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>Username / Email</label>
                  <input 
                    style={inputStyle} 
                    value={draft.smtpUser || ''} 
                    onChange={e => setField({ smtpUser: e.target.value })} 
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password / App Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      style={{ ...inputStyle, paddingRight: '40px' }} 
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={draft.smtpPass || ''} 
                      onChange={e => setField({ smtpPass: e.target.value })} 
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: 'var(--text3)',
                      }}
                    >
                      {showSmtpPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sender Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>From Name</label>
                  <input 
                    style={inputStyle} 
                    value={draft.smtpFromName || ''} 
                    onChange={e => setField({ smtpFromName: e.target.value })} 
                    placeholder={draft.name || 'GarageIQ'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>From Email</label>
                  <input 
                    style={inputStyle} 
                    type="email"
                    value={draft.smtpFromEmail || ''} 
                    onChange={e => setField({ smtpFromEmail: e.target.value })} 
                    placeholder="invoices@yourdomain.com"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Reply-To Email (optional)</label>
                <input 
                  style={inputStyle} 
                  type="email"
                  value={draft.smtpReplyTo || ''} 
                  onChange={e => setField({ smtpReplyTo: e.target.value })} 
                  placeholder="support@yourdomain.com"
                />
              </div>

              {/* Test Button */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Btn 
                  variant="teal" 
                  onClick={testSmtpConnection}
                  disabled={smtpTestStatus === 'testing'}
                >
                  {smtpTestStatus === 'testing' ? '⏳ Connecting...' : 
                   smtpTestStatus === 'success' ? '✓ Connected!' :
                   smtpTestStatus === 'error' ? '✗ Failed — try again' : '🔌 Test Connection'}
                </Btn>
                <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
                  Connects to your email server and sends a test email from {draft.smtpUser || 'your address'}
                </span>
              </div>

              {smtpTestStatus === 'success' && (
                <div style={{ marginTop: '12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--green)' }}>
                  ✓ Connected and authenticated. A test email was sent from <strong>{draft.smtpUser}</strong> to itself — check that inbox to confirm. Don't forget to <strong>Save Changes</strong> so these details are kept.
                </div>
              )}

              {smtpTestStatus === 'error' && smtpTestError && (
                <div style={{ marginTop: '12px', background: 'rgba(255,95,95,0.08)', border: '1px solid rgba(255,95,95,0.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--red)' }}>
                  ✗ Not connected: {smtpTestError}
                </div>
              )}
            </Card>



            {/* Email Defaults */}
            <Card>
              <div style={sectionTitle}>Email Defaults</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Default From Name</label>
                  <input 
                    style={inputStyle} 
                    value={draft.emailFromName || draft.name || ''} 
                    onChange={e => setField({ emailFromName: e.target.value })} 
                    placeholder="Smith Tyres MK"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Default Reply-To Email</label>
                  <input 
                    style={inputStyle} 
                    type="email"
                    value={draft.emailReplyTo || draft.email || ''} 
                    onChange={e => setField({ emailReplyTo: e.target.value })} 
                    placeholder="invoices@smithtyres.co.uk"
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Payment Information Text (shown in the highlighted box on invoices)</label>
                  <textarea 
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} 
                    value={draft.emailFooter || ''} 
                    onChange={e => setField({ emailFooter: e.target.value })} 
                    placeholder="e.g. Bank transfer: Sort 12-34-56 · Account 12345678. Payment due within 14 days."
                  />
                </div>
              </div>
            </Card>

            {renderSaveRow()}
          </div>
        )}

        {/* VAT TAB */}
        {activeTab === 'vat' && (
          <Card>
            <div style={sectionTitle}>VAT Configuration</div>
            <p style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '20px', marginTop: '-8px' }}>
              Configure your VAT scheme and registration details for HMRC compliance.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>VAT Scheme</label>
                <select 
                  style={inputStyle} 
                  value={draft.vatScheme || 'standard'} 
                  onChange={e => setField({ vatScheme: e.target.value })}
                >
                  <option value="standard">Standard Rate (20%)</option>
                  <option value="flatrate">Flat Rate Scheme</option>
                  <option value="exempt">VAT Exempt</option>
                </select>
              </div>
              
              <div>
                <label style={labelStyle}>VAT Number</label>
                <input 
                  style={inputStyle} 
                  value={draft.vatNumber || ''} 
                  onChange={e => setField({ vatNumber: e.target.value })} 
                  placeholder="GB123456789"
                />
              </div>

              {/* Only show flat rate % if flat rate scheme selected */}
              {draft.vatScheme === 'flatrate' && (
                <div>
                  <label style={labelStyle}>Flat Rate Percentage</label>
                  <input 
                    style={inputStyle} 
                    type="number"
                    step="0.1"
                    value={draft.flatRate || 8.5} 
                    onChange={e => setField({ flatRate: parseFloat(e.target.value) })} 
                    placeholder="8.5"
                  />
                  <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '4px' }}>
                    Check HMRC for your trade's flat rate percentage
                  </div>
                </div>
              )}
            </div>

            {/* VAT Scheme Info */}
            <div style={{ marginTop: '20px' }}>
              {draft.vatScheme === 'standard' && (
                <div style={{ 
                  background: 'rgba(96,165,250,0.08)', 
                  border: '1px solid rgba(96,165,250,0.2)', 
                  borderRadius: '8px', 
                  padding: '14px' 
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--blue)', marginBottom: '6px' }}>
                    Standard Rate (20%)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    Charge 20% VAT on sales and reclaim VAT on purchases. Most businesses use this scheme.
                  </div>
                </div>
              )}

              {draft.vatScheme === 'flatrate' && (
                <div style={{ 
                  background: 'rgba(245,200,66,0.08)', 
                  border: '1px solid rgba(245,200,66,0.2)', 
                  borderRadius: '8px', 
                  padding: '14px' 
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent)', marginBottom: '6px' }}>
                    Flat Rate Scheme
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    Pay a fixed percentage of gross sales to HMRC. Simpler bookkeeping but cannot reclaim VAT on purchases (except capital assets over £2,000).
                  </div>
                </div>
              )}

              {draft.vatScheme === 'exempt' && (
                <div style={{ 
                  background: 'var(--surface2)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  padding: '14px' 
                }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
                    VAT Exempt
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                    Not registered for VAT. Invoices will not include VAT charges.
                  </div>
                </div>
              )}
            </div>

            {/* Gold Plan - Margin Scheme */}
            {TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('gold') && (
              <div style={{ 
                marginTop: '20px',
                background: 'rgba(45,212,191,0.08)', 
                border: '1px solid rgba(45,212,191,0.2)', 
                borderRadius: '8px', 
                padding: '14px' 
              }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--teal)', marginBottom: '6px' }}>
                  ♻ VAT Margin Scheme (Gold Plan)
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
                  Your Gold plan includes the VAT Margin Scheme for used/part-exchange tyres. VAT is calculated only on the profit margin, not the full sale price.
                </div>
              </div>
            )}

            {renderSaveRow()}
          </Card>
        )}

        {/* SUBSCRIPTION TAB */}
        {activeTab === 'users' && <UsersTab />}

        {activeTab === 'accountant' && <AccountantTab />}

        {activeTab === 'subscription' && (
          <SubscriptionTab
            tier={tier}
            setTier={setTier}
            TIERS={TIERS}
            sectionTitle={sectionTitle}
          />
        )}

      </div>
    </div>
  )
}

// Subscription Tab Component with mobile support and working modals
function SubscriptionTab({ tier, setTier, TIERS, sectionTitle }) {
  const settings = useStore(s => s.settings)
  const trialEnds = useStore(s => s.trialEnds)
  const user = useStore(s => s.user)
  const garageId = useStore(s => s.garageId)
  const loadData = useStore(s => s.loadData)
  const [showInvoicesModal, setShowInvoicesModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [changingTier, setChangingTier] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)

  // Returning from Stripe Checkout? The webhook updates the row server-side;
  // refresh local state so the new tier/status shows, then tidy the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('billing') === 'success' && user?.email) {
      loadData(user.email)
    }
    if (params.get('billing')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [user?.email, loadData])

  // Get the current Supabase access token for authenticating API calls.
  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    }
  }

  // Start a real Stripe Checkout for the chosen tier, then redirect to it.
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
          product: 'tyreops',
          tier: newTier,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      // Redirect to Stripe Checkout (no need to clear changingTier — we leave).
      window.location.href = data.url
    } catch (err) {
      alert(err.message || 'Could not start checkout')
      setChangingTier(null)
    }
  }

  // Open the Stripe Billing Portal so the customer can update payment details
  // or cancel. Used by "Manage subscription", "Update Payment" and "Cancel".
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
        body: JSON.stringify({ garageId }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open billing portal')
      window.location.href = data.url
    } catch (err) {
      alert(err.message || 'Could not open billing portal')
      setPortalLoading(false)
    }
  }

  // Build billing history from real subscription data.
  // Paid subscription begins when the trial ends. If there's no trial date on
  // record yet, fall back to the start of the current month (one invoice).
  const monthlyPrice = TIER_PRICE[tier] || 0

  const subStart = (() => {
    const d = trialEnds ? new Date(trialEnds) : new Date()
    if (isNaN(d.getTime())) return new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })()

  const billingInvoices = (() => {
    const out = []
    const now = new Date()
    const cursor = new Date(subStart)
    // One invoice per month from subscription start up to (and including) the
    // current month, only for months that have actually started.
    while (cursor <= now && out.length < 36) {
      const y = cursor.getFullYear()
      const m = String(cursor.getMonth() + 1).padStart(2, '0')
      out.push({
        id: `INV-${y}-${m}`,
        date: `${y}-${m}-01`,
        amount: monthlyPrice,
        tier,
        status: 'paid',
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    // Newest first
    return out.reverse()
  })()

  // Shared invoice field helpers
  const invoiceMeta = (inv) => {
    const g = settings || {}
    const planName = (inv.tier || tier || '').charAt(0).toUpperCase() + (inv.tier || tier || '').slice(1)
    const issued = new Date(inv.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    return { g, planName, issued }
  }

  // Direct one-click PDF download using jsPDF (no print dialog).
  // jsPDF is loaded lazily so it doesn't bloat the main app bundle.
  const downloadInvoicePDF = async (inv) => {
    const { jsPDF } = await import('jspdf')
    const { g, planName, issued } = invoiceMeta(inv)
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const L = 48
    let y = 56

    // Brand
    doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(17, 17, 17)
    doc.text('Alzaro', L, y)
    const aw = doc.getTextWidth('Alzaro')
    doc.setTextColor(79, 70, 229).text('TyreOps', L + aw, y)
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(120, 120, 120)
    doc.text('Tyre Management Pro', L, y + 16)

    // Invoice meta (right aligned)
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(17, 17, 17)
    doc.text('INVOICE', W - L, y, { align: 'right' })
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(120, 120, 120)
    doc.text(inv.id, W - L, y + 16, { align: 'right' })
    doc.text(`Issued: ${issued}`, W - L, y + 30, { align: 'right' })

    // Divider
    y += 48
    doc.setDrawColor(79, 70, 229).setLineWidth(1.5).line(L, y, W - L, y)
    y += 26

    // Billed to
    doc.setFontSize(9).setTextColor(120, 120, 120).text('BILLED TO', L, y)
    doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(17, 17, 17)
    doc.text(g.name || 'Your Garage', L, y + 16)
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(120, 120, 120)
    let ay = y + 32
    ;[g.addr, [g.city, g.post].filter(Boolean).join(', '), g.email]
      .filter(Boolean)
      .forEach(line => { doc.text(String(line), L, ay); ay += 14 })

    // Status
    doc.setFontSize(9).setTextColor(120, 120, 120).text('STATUS', W - L, y, { align: 'right' })
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(22, 163, 74)
    doc.text('PAID', W - L, y + 16, { align: 'right' })

    // Line items table
    let ty = Math.max(ay, y + 60) + 16
    doc.setDrawColor(221, 221, 221).setLineWidth(0.75)
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(120, 120, 120)
    doc.text('DESCRIPTION', L, ty)
    doc.text('AMOUNT', W - L, ty, { align: 'right' })
    ty += 8
    doc.line(L, ty, W - L, ty)
    ty += 22

    doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(17, 17, 17)
    doc.text(`TyreOps subscription - ${planName} plan (monthly)`, L, ty)
    doc.text(`GBP ${inv.amount.toFixed(2)}`, W - L, ty, { align: 'right' })
    ty += 14
    doc.line(L, ty, W - L, ty)
    ty += 26

    // Total
    doc.setFont('helvetica', 'bold').setFontSize(14)
    doc.text('Total', W - L - 120, ty, { align: 'right' })
    doc.text(`GBP ${inv.amount.toFixed(2)}`, W - L, ty, { align: 'right' })

    // Footer
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(150, 150, 150)
    doc.text(
      'This is a system-generated invoice from AlzaroTyreOps. Thank you for your business.',
      L,
      doc.internal.pageSize.getHeight() - 48
    )

    doc.save(`${inv.id}.pdf`)
  }

  // CSV / spreadsheet-friendly receipt download.
  const downloadInvoiceCSV = (inv) => {
    const { g, planName, issued } = invoiceMeta(inv)
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [
      ['Invoice', inv.id],
      ['Issued', issued],
      ['Billed To', g.name || 'Your Garage'],
      ['Address', [g.addr, g.city, g.post].filter(Boolean).join(', ')],
      ['Email', g.email || ''],
      ['Description', `TyreOps subscription - ${planName} plan (monthly)`],
      ['Amount (GBP)', inv.amount.toFixed(2)],
      ['Status', 'PAID'],
    ]
    const csv = rows.map(r => r.map(q).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.id}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Card>
        <div style={sectionTitle}>Current Plan</div>
        
        {/* Mobile-friendly horizontal scroll */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          overflowX: 'auto', 
          paddingBottom: '8px',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
        }}>
          {TIERS.map(t => (
            <div 
              key={t.key} 
              style={{ 
                background: tier === t.key ? 'var(--surface2)' : 'var(--surface)', 
                border: `2px solid ${tier === t.key ? t.color : 'var(--border)'}`, 
                borderRadius: '12px', 
                padding: '20px',
                position: 'relative',
                transition: 'all 0.15s',
                minWidth: '220px',
                flex: '1 0 220px',
                scrollSnapAlign: 'start',
              }}
            >
              {tier === t.key && (
                <div style={{
                  position: 'absolute',
                  top: '-10px',
                  right: '12px',
                  background: t.color,
                  color: t.key === 'silver' ? '#000' : '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '20px',
                }}>
                  CURRENT
                </div>
              )}
              
              <div style={{ 
                fontFamily: 'Syne, sans-serif', 
                fontWeight: 700, 
                fontSize: '18px',
                color: t.color,
                marginBottom: '4px'
              }}>
                {t.label}
              </div>
              
              <div style={{ 
                fontFamily: 'DM Mono, monospace', 
                fontSize: '24px', 
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: '16px'
              }}>
                {t.price}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {t.features.map(feat => (
                  <div key={feat} style={{ 
                    fontSize: '12px', 
                    color: 'var(--text2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ color: t.color }}>✓</span>
                    {feat}
                  </div>
                ))}
              </div>
              
              {tier !== t.key && (
                <Btn 
                  variant={TIER_ORDER.indexOf(t.key) > TIER_ORDER.indexOf(tier) ? 'primary' : 'secondary'}
                  onClick={() => handleTierChange(t.key)} 
                  style={{ width: '100%' }}
                  disabled={changingTier !== null}
                >
                  {changingTier === t.key ? 'Changing...' : 
                   TIER_ORDER.indexOf(t.key) > TIER_ORDER.indexOf(tier) ? 'Upgrade' : 'Downgrade'}
                </Btn>
              )}
            </div>
          ))}
        </div>
        
        <div style={{ 
          fontSize: '11px', 
          color: 'var(--text3)', 
          marginTop: '16px',
          textAlign: 'center'
        }}>
          ← Swipe to see all plans →
        </div>
      </Card>

      {/* Billing Info */}
      <Card>
        <div style={sectionTitle}>Billing Information</div>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>Next Invoice</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 600 }}>
              {(() => {
                const d = new Date()
                const next = new Date(d.getFullYear(), d.getMonth() + 1, 1)
                return `${next.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · £${monthlyPrice}`
              })()}
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>Payment Method</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 600 }}>
              •••• 4242
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={openPortal} disabled={portalLoading}>
            {portalLoading ? 'Opening…' : 'Manage Subscription'}
          </Btn>
          <Btn variant="secondary" onClick={openPortal} disabled={portalLoading}>Update Payment</Btn>
          <Btn variant="ghost" onClick={() => setShowInvoicesModal(true)}>View Invoices</Btn>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card style={{ border: '1px solid rgba(255,95,95,0.3)' }}>
        <div style={{ ...sectionTitle, color: 'var(--red)' }}>Danger Zone</div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>Cancel Subscription</div>
            <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
              Your data will be retained for 30 days after cancellation.
            </div>
          </div>
          <Btn variant="danger" onClick={() => setShowCancelModal(true)}>Cancel Plan</Btn>
        </div>
      </Card>

      {/* View Invoices Modal */}
      {showInvoicesModal && (
        <Modal title="Billing Invoices" onClose={() => setShowInvoicesModal(false)}>
          <div style={{ marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Invoice', 'Date', 'Amount', 'Status', 'Download'].map(h => (
                    <th key={h} style={{ 
                      textAlign: h === 'Download' ? 'right' : 'left', 
                      fontSize: '10px', 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      color: 'var(--text3)', 
                      padding: '8px', 
                      borderBottom: '1px solid var(--border)' 
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {billingInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text3)' }}>
                      No invoices yet — your first invoice will appear once billing begins.
                    </td>
                  </tr>
                )}
                {billingInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ padding: '10px 8px', fontFamily: 'DM Mono, monospace' }}>{inv.id}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--text2)' }}>{inv.date}</td>
                    <td style={{ padding: '10px 8px', fontFamily: 'DM Mono, monospace' }}>£{inv.amount}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ 
                        fontSize: '10px', 
                        fontWeight: 600, 
                        padding: '2px 8px', 
                        borderRadius: '10px',
                        background: 'rgba(34,197,94,0.1)', 
                        color: 'var(--green)' 
                      }}>
                        PAID
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => downloadInvoicePDF(inv)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          PDF
                        </button>
                        <button
                          onClick={() => downloadInvoiceCSV(inv)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text2)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowInvoicesModal(false)}>Close</Btn>
          </div>
        </Modal>
      )}

      {/* Cancel Subscription Modal */}
      {showCancelModal && (
        <Modal title="Cancel Subscription" onClose={() => setShowCancelModal(false)}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              background: 'rgba(255,95,95,0.1)', 
              border: '1px solid rgba(255,95,95,0.2)', 
              borderRadius: '8px', 
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px' }}>
                ⚠️ Are you sure?
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5 }}>
                If you cancel your subscription:
              </div>
              <ul style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '8px', paddingLeft: '20px' }}>
                <li>Your account will remain active until the end of the billing period</li>
                <li>Your data will be retained for 30 days</li>
                <li>You can resubscribe at any time</li>
              </ul>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
              You'll be taken to the secure Stripe billing portal to confirm cancellation.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowCancelModal(false)}>Keep Subscription</Btn>
            <Btn variant="danger" disabled={portalLoading} onClick={() => { setShowCancelModal(false); openPortal() }}>
              {portalLoading ? 'Opening…' : 'Continue to Cancel'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Simple Modal component for subscription
function Modal({ title, children, onClose }) {
  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,.75)', 
        zIndex: 500, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '16px' 
      }} 
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ 
        background: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: '16px', 
        width: '500px', 
        maxWidth: '100%', 
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px' 
      }}>
        <div style={{ 
          fontFamily: 'Syne, sans-serif', 
          fontSize: '18px', 
          fontWeight: 700, 
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {title}
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text3)', 
              fontSize: '18px', 
              cursor: 'pointer' 
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ============================================================
   USERS TAB — multi-user staff seats (Silver: 2, Gold: 4).
   Owner adds staff by email and picks sections. Enforcement is
   RLS (migrations/013_garage_staff.sql); this is the control
   panel. Mirrors SoloOps/PropertyOps.
   ============================================================ */
import { STAFF_PERMS, listStaff, updateStaffPermissions, removeStaff } from '../lib/staff.js'

function UEye({ off }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

const uInp = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 11px', color: 'var(--text)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }
const uBtn = (ghost, danger) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap', background: ghost ? 'var(--surface)' : 'var(--accent)', color: danger ? '#ef4444' : ghost ? 'var(--text)' : '#fff', border: '1px solid ' + (ghost ? 'var(--border)' : 'var(--accent)') })
const uChip = { fontSize: '11.5px', fontWeight: 700, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid var(--accent)', borderRadius: '999px', padding: '3px 10px' }

function UsersTab() {
  const { tier, garageStatus } = useStore()
  const [rows, setRows] = useState(null)
  const [email, setEmail] = useState('')
  const [perms, setPerms] = useState({ invoices: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')

  // Keep in step with PRODUCTS.tyreops.seats in api/staff.js (the real limit)
  // and the tier list in migrations/013_garage_staff.sql (the RLS gate).
  const TIER_SEATS = { silver: 2, gold: 4 }
  const SEATS = TIER_SEATS[(tier || '').toLowerCase()] || 0
  const eligible = SEATS > 0 && ['trial', 'active'].includes((garageStatus || '').toLowerCase())
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : ''
  const seatsLeft = rows === null ? 0 : Math.max(0, SEATS - rows.length)

  const reload = async () => {
    const { data, error } = await listStaff()
    setRows(error ? [] : data || [])
  }
  useEffect(() => { reload() }, [])

  const flash = (m) => { setNotice(m); setTimeout(() => setNotice(''), 4000) }

  const add = async () => {
    setErr('')
    if (!email.trim()) { setErr('Enter their email address.'); return }
    setBusy(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.session?.access_token || ''}` },
        body: JSON.stringify({ product: 'tyreops', email: email.trim(), permissions: perms }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not add the user'); return }
      flash(j.invited ? 'Access given — invite email sent so they can set a password' : 'Access given — they can sign in with their existing Alzaro login')
      setEmail(''); setPerms({ invoices: true })
      await reload()
    } catch (e) { setErr('Network error — try again') }
    finally { setBusy(false) }
  }

  if (rows === null) return <div style={{ color: 'var(--text3)', fontSize: '13px' }}>Loading…</div>

  if (!eligible) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', maxWidth: '560px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '8px' }}>Add your team</div>
        <div style={{ color: 'var(--text2)', fontSize: '13px', lineHeight: 1.6 }}>
          Silver includes 2 extra users and Gold includes 4: invite staff with their own
          logins and choose exactly which sections they can use — just invoices, say,
          while your reports and settings stay yours. Upgrade on the Subscription tab to unlock it.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '14px', maxWidth: '760px' }}>
      {notice && <div style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid var(--accent)', color: 'var(--text)', borderRadius: '8px', padding: '9px 13px', fontSize: '12.5px' }}>{notice}</div>}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '3px' }}>Users</div>
        <div style={{ color: 'var(--text2)', fontSize: '12.5px', marginBottom: '14px' }}>
          Your {tierLabel} plan includes {SEATS} staff seats ({seatsLeft} left). Staff sign in with their
          own email and password and only see the sections you tick — never Settings.
        </div>

        {seatsLeft > 0 && (
          <div style={{ display: 'grid', gap: '11px', paddingBottom: rows.length ? '16px' : 0, marginBottom: rows.length ? '16px' : 0, borderBottom: rows.length ? '1px solid var(--border)' : 'none' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '5px' }}>Their email</div>
              <input style={uInp} type="email" placeholder="name@example.com" value={email}
                     onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '5px' }}>What they can use</div>
              <div style={{ display: 'grid', gap: '7px' }}>
                {STAFF_PERMS.map(([k, label, blurb]) => (
                  <label key={k} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '12.5px' }}>
                    <input type="checkbox" checked={perms[k] === true}
                           onChange={() => setPerms(p => ({ ...p, [k]: !(p[k] === true) }))} style={{ marginTop: '2px' }} />
                    <span><strong>{label}</strong><span style={{ color: 'var(--text3)' }}> — {blurb}</span></span>
                  </label>
                ))}
              </div>
            </div>
            {err && <div style={{ color: '#ef4444', fontSize: '12.5px' }}>{err}</div>}
            <button style={{ ...uBtn(false), width: 'fit-content', border: 'none' }} disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add user'}</button>
          </div>
        )}

        {rows.map(row => <UStaffCard key={row.id} row={row} flash={flash} onChanged={reload} />)}
      </div>
    </div>
  )
}

function UStaffCard({ row, flash, onChanged }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.permissions || {})
  const [saving, setSaving] = useState(false)
  const enabled = STAFF_PERMS.filter(([k]) => row.permissions?.[k] === true).map(([, label]) => label)

  const saveEdit = async () => {
    setSaving(true)
    const { error } = await updateStaffPermissions(row.id, draft)
    setSaving(false)
    if (error) { flash('Could not save — try again'); return }
    setEditing(false); flash('Access updated'); onChanged()
  }
  const remove = async () => {
    if (!window.confirm(`Remove ${row.staff_email}? They lose access immediately.`)) return
    const { error } = await removeStaff(row.id)
    if (error) { flash('Could not remove — try again'); return }
    flash('Removed'); onChanged()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', marginBottom: '11px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13.5px', overflowWrap: 'anywhere' }}>{row.staff_email}</div>
          <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '2px' }}>
            {row.status === 'invited' ? "Invited — hasn't set a password yet" : 'Active'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
          {!editing && <button style={uBtn(true)} onClick={() => { setDraft({ ...(row.permissions || {}) }); setEditing(true) }}>Edit</button>}
          <button style={uBtn(true, true)} onClick={remove}>Remove</button>
        </div>
      </div>

      {!editing && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '11px' }}>
          {enabled.length
            ? enabled.map(label => <span key={label} style={uChip}>{label}</span>)
            : <span style={{ fontSize: '12px', color: 'var(--text3)' }}>No sections enabled — they can sign in but see nothing. Hit Edit to give them access.</span>}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'grid', gap: '7px' }}>
            {STAFF_PERMS.map(([k, label, blurb]) => (
              <label key={k} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '12.5px' }}>
                <input type="checkbox" checked={draft[k] === true}
                       onChange={() => setDraft(d => ({ ...d, [k]: !(d[k] === true) }))} style={{ marginTop: '2px' }} />
                <span><strong>{label}</strong><span style={{ color: 'var(--text3)' }}> — {blurb}</span></span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '7px', marginTop: '12px' }}>
            <button style={{ ...uBtn(false), border: 'none' }} disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
            <button style={uBtn(true)} disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text3)', marginTop: '9px' }}>Changes apply on their next page load.</div>
        </div>
      )}

      <UStaffPassword row={row} flash={flash} onChanged={onChanged} />
    </div>
  )
}

function UStaffPassword({ row, flash, onChanged }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const setPassword = async () => {
    setErr('')
    if (pw.length < 8) { setErr('At least 8 characters.'); return }
    setBusy(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.session?.access_token || ''}` },
        body: JSON.stringify({ product: 'tyreops', action: 'set_password', staff_id: row.id, password: pw }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not set the password'); return }
      setPw(''); flash('Password updated — tell them the new one'); onChanged()
    } catch (e) { setErr('Network error — try again') }
    finally { setBusy(false) }
  }

  const sendReset = async () => {
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(row.staff_email, {
        redirectTo: window.location.origin + '/tyreops/reset-password',
      })
      if (error) { flash('Could not send the reset email'); return }
      flash(`Reset email sent to ${row.staff_email}`)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '7px' }}>Password</div>
      {row.created_via_invite ? (
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '230px', maxWidth: '100%' }}>
            <input style={{ ...uInp, paddingRight: '36px' }} type={show ? 'text' : 'password'} placeholder="New password (min 8 chars)"
                   value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') setPassword() }}
                   autoComplete="new-password" />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}
                    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: '3px', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}>
              <UEye off={show} />
            </button>
          </div>
          <button style={uBtn(true)} disabled={busy} onClick={setPassword}>{busy ? 'Saving…' : 'Set password'}</button>
          {err && <span style={{ color: '#ef4444', fontSize: '12px' }}>{err}</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '9px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={uBtn(true)} disabled={busy} onClick={sendReset}>{busy ? 'Sending…' : 'Send password reset email'}</button>
          <span style={{ fontSize: '11.5px', color: 'var(--text3)' }}>They joined with an Alzaro login they already had, so only they can change its password.</span>
        </div>
      )}
    </div>
  )
}

// ============================================================
// ACCOUNTANT TAB  (view-only books access for the client's accountant)
// ============================================================
// Mirrors the SoloOps AccountantTab but in TyreOps' own theming (the uInp/uBtn
// kit above, --accent). Any trial/active tier can invite — no seat gate (this
// differs from UsersTab, which is Silver/Gold-only). The permission keys match
// api/accountant.js PRODUCTS.tyreops and the accountant RLS in migration 015.
import { getAccountantLink, updateAccountantPermissions, revokeAccountant, setAccountantCanEdit } from '../lib/db'

// key, label, blurb — the seven visibility toggles an accountant can be granted.
// The reporting key is 'vat' (the VAT Report), not 'reports'.
const ACCT_PERMS = [
  ['dashboard', 'Dashboard',  'Stock and sales totals'],
  ['invoices',  'Invoices',   'Invoices and payments'],
  ['inventory', 'Inventory',  'SKUs, stock and used tyres'],
  ['purchases', 'Purchases',  'Stock purchases and batches'],
  ['customers', 'Customers',  'The customer list'],
  ['followups', 'Follow-Ups', 'Follow-up reminders'],
  ['vat',       'VAT Report', 'VAT reporting figures'],
]

function AccountantTab() {
  const { garageStatus } = useStore()
  const [link, setLink] = useState(undefined)   // undefined=loading, null=none
  const [email, setEmail] = useState('')
  // Default: everything visible — they were invited to see the books. Any box
  // can be unticked before or after inviting.
  const [perms, setPerms] = useState({ dashboard: true, invoices: true, inventory: true, purchases: true, customers: true, followups: true, vat: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)   // editing a live link's visibility
  const [draft, setDraft] = useState({})           // pending edits, saved on demand
  const eligible = ['trial', 'active'].includes((garageStatus || '').toLowerCase())

  const flash = (m) => { setNotice(m); setTimeout(() => setNotice(''), 4000) }
  const reload = async () => { setLink(await getAccountantLink()) }
  useEffect(() => { reload() }, [])

  const invite = async () => {
    setErr('')
    if (!email.trim()) { setErr('Enter their email address.'); return }
    setBusy(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const r = await fetch('/api/accountant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess?.session?.access_token || ''}` },
        body: JSON.stringify({ product: 'tyreops', email: email.trim(), permissions: perms }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not send the invite'); return }
      flash(j.existing_user
        ? 'Accountant linked — they can sign in to the portal with their existing login'
        : 'Invite sent — they’ll get an email to set up their portal login')
      setEmail('')
      await reload()
    } catch (e) {
      setErr('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  // Pre-invite: toggle the local perms (no link yet).
  const togglePerm = (k) => setPerms(p => ({ ...p, [k]: !p[k] }))

  // Editing a live link: batch changes into a draft, then Save/Cancel.
  const startEdit = () => { setDraft({ ...(link.permissions || {}) }); setEditing(true) }
  const cancelEdit = () => setEditing(false)
  const saveEdit = async () => {
    const { error } = await updateAccountantPermissions(link.id, draft)
    if (error) { flash('Could not save the changes'); return }
    setLink({ ...link, permissions: draft })
    setEditing(false)
    flash('Access updated')
  }

  const revoke = async () => {
    if (!window.confirm(`Remove ${link.accountant_email}’s access? They’ll no longer be able to see any of your books. You can invite them (or someone else) again any time.`)) return
    const { error } = await revokeAccountant(link.id)
    if (error) { flash('Could not remove access'); return }
    flash('Accountant access removed')
    await reload()
  }

  // Owner-controlled invoice editing (off = view only). Confirm on enable.
  const toggleCanEdit = async () => {
    const enabling = link.can_edit !== true
    if (enabling && !window.confirm(`Allow ${link.accountant_email} to make corrections? They’ll be able to fix mistakes on your invoices, purchases and customer records from their portal. Stock and VAT figures stay read-only. You can switch this off again at any time.`)) return
    const { error } = await setAccountantCanEdit(link.id, enabling)
    if (error) { flash('Could not update editing access'); return }
    setLink({ ...link, can_edit: enabling })
    flash(enabling ? 'Invoice editing enabled' : 'Back to view only')
  }

  if (link === undefined) return <div style={{ color: 'var(--text3)', fontSize: '13px' }}>Loading…</div>

  return (
    <div style={{ display: 'grid', gap: '14px', maxWidth: '760px' }}>
      {notice && <div style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid var(--accent)', color: 'var(--text)', borderRadius: '8px', padding: '9px 13px', fontSize: '12.5px' }}>{notice}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '3px' }}>My accountant</div>
        <div style={{ color: 'var(--text2)', fontSize: '12.5px', marginBottom: '14px', lineHeight: 1.55 }}>
          Give your accountant a window on your books. They sign in to a separate accountant portal.
          By default access is <b>view-only</b> — you can optionally let them correct invoices below.
          You choose what they see, and you can adjust or remove their access at any time.
        </div>

        {!eligible && (
          <div style={{ fontSize: '12.5px', color: 'var(--text2)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
            Your subscription needs to be active to link an accountant.
          </div>
        )}

        {eligible && !link && (
          <div style={{ display: 'grid', gap: '11px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '5px' }}>Accountant’s email</div>
              <input style={uInp} type="email" placeholder="accountant@example.co.uk" value={email}
                     onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') invite() }} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', marginBottom: '5px' }}>What they can see</div>
              <div style={{ display: 'grid', gap: '7px' }}>
                {ACCT_PERMS.map(([k, label, blurb]) => (
                  <label key={k} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '12.5px' }}>
                    <input type="checkbox" checked={perms[k] === true} onChange={() => togglePerm(k)} style={{ marginTop: '2px' }} />
                    <span><strong>{label}</strong><span style={{ color: 'var(--text3)' }}> — {blurb}</span></span>
                  </label>
                ))}
              </div>
            </div>
            {err && <div style={{ color: '#ef4444', fontSize: '12.5px' }}>{err}</div>}
            <button style={{ ...uBtn(false), width: 'fit-content', border: 'none' }} disabled={busy} onClick={invite}>{busy ? 'Sending…' : 'Invite accountant'}</button>
          </div>
        )}

        {eligible && link && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontWeight: 800, fontSize: '14px', wordBreak: 'break-all' }}>{link.accountant_email}</span>
              <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase',
                color: link.status === 'active' ? 'var(--green)' : 'var(--accent)',
                background: link.status === 'active' ? 'rgba(61,214,140,.12)' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
                border: `1px solid ${link.status === 'active' ? 'rgba(61,214,140,.3)' : 'var(--accent)'}`,
                borderRadius: '20px', padding: '2px 9px' }}>
                {link.status === 'active' ? 'Active' : 'Invited'}
              </span>
              <span style={{ ...uChip, color: link.can_edit === true ? 'var(--accent)' : 'var(--text3)', background: 'transparent', border: `1px solid ${link.can_edit === true ? 'var(--accent)' : 'var(--border)'}` }}>
                {link.can_edit === true ? 'Can make corrections' : 'View only'}
              </span>
            </div>
            {link.status !== 'active' && (
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px' }}>
                They’ve been emailed a link to set up their portal login.
              </div>
            )}

            {!editing && (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text3)', margin: '14px 0 8px' }}>What they can see</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {ACCT_PERMS.filter(([k]) => link.permissions?.[k] === true).map(([k, label]) => (
                    <span key={k} style={uChip}>{label}</span>
                  ))}
                  {ACCT_PERMS.every(([k]) => link.permissions?.[k] !== true) && (
                    <span style={{ fontSize: '12.5px', color: 'var(--text3)' }}>No sections shared — hit “Edit access” to choose some.</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={startEdit} style={uBtn(true)}>Edit access</button>
                  <button onClick={revoke} style={{ ...uBtn(true, true), border: '1px solid rgba(239,68,68,.4)' }}>Remove access</button>
                </div>

                {/* Owner-controlled invoice editing (migration 018) */}
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', cursor: link.status === 'active' ? 'pointer' : 'not-allowed', fontSize: '12.5px', opacity: link.status === 'active' ? 1 : 0.55 }}>
                    <input type="checkbox" checked={link.can_edit === true} disabled={link.status !== 'active'} onChange={toggleCanEdit} style={{ marginTop: '2px' }} />
                    <span>
                      <strong>Allow corrections</strong>
                      <span style={{ color: 'var(--text3)' }}> — lets them fix mistakes on your invoices, purchases and customer records (amounts, VAT, dates, details) from their portal. Off = strictly view only. Stock, dashboard and VAT figures always stay read-only.</span>
                      {link.status !== 'active' && <span style={{ color: 'var(--text3)' }}> Available once they’ve accepted the invite.</span>}
                    </span>
                  </label>
                </div>
              </>
            )}
            {editing && (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text3)', margin: '14px 0 8px' }}>What they can see</div>
                <div style={{ display: 'grid', gap: '7px', marginBottom: '16px' }}>
                  {ACCT_PERMS.map(([k, label, blurb]) => (
                    <label key={k} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '12.5px' }}>
                      <input type="checkbox" checked={draft[k] === true} onChange={() => setDraft(d => ({ ...d, [k]: !(d[k] === true) }))} style={{ marginTop: '2px' }} />
                      <span><strong>{label}</strong><span style={{ color: 'var(--text3)' }}> — {blurb}</span></span>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={saveEdit} style={{ ...uBtn(false), border: 'none' }}>Save changes</button>
                  <button onClick={cancelEdit} style={uBtn(true)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
