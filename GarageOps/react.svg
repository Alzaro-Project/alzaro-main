import { useState } from 'react'
import { useStore, TIER_ORDER } from '../store/useStore'
import { PageHeader, Card, Btn, Badge } from '../components/UI'
import { SMTP_PRESETS, validateSmtpConfig, buildSmtpConfig } from '../lib/email'

const TABS = [
  { key: 'garage', label: '🏢 Garage', icon: '🏢' },
  { key: 'email', label: '📧 Email', icon: '📧' },
  { key: 'vat', label: '📊 VAT', icon: '📊' },
  { key: 'subscription', label: '💳 Subscription', icon: '💳' },
]

export default function Settings() {
  const { settings, tier, setTier, updateSettings } = useStore()
  const [activeTab, setActiveTab] = useState('garage')
  const [smtpTestStatus, setSmtpTestStatus] = useState(null)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)

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
    { key: 'bronze', label: '🥉 Bronze', price: '£60/mo', color: '#cd7f32', features: ['50 invoices/month', 'Basic inventory', 'FIFO automatic', '1 user'] },
    { key: 'silver', label: '🥈 Silver', price: '£75/mo', color: '#c0c0c0', features: ['Unlimited invoices', 'Batch override', 'Supplier tracking', 'Used tyres', 'VAT reports', '2 users'] },
    { key: 'gold', label: '🥇 Gold', price: '£90/mo', color: 'var(--accent)', features: ['Everything in Silver', 'Full P&L dashboard', 'VAT Margin Scheme', 'Reports & export', 'Unlimited users'] },
  ]

  // Test SMTP connection
  const testSmtpConnection = async () => {
    const smtpConfig = buildSmtpConfig(settings.smtpProvider || 'custom', {
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: settings.smtpSecure,
      user: settings.smtpUser,
      pass: settings.smtpPass,
      fromName: settings.smtpFromName || settings.name,
      fromEmail: settings.smtpFromEmail || settings.email,
      replyTo: settings.smtpReplyTo,
    })

    const validation = validateSmtpConfig(smtpConfig)
    if (!validation.valid) {
      alert('SMTP configuration incomplete:\n' + validation.errors.join('\n'))
      return
    }

    setSmtpTestStatus('testing')
    
    // In a real app, this would call the /api/test-smtp endpoint
    // For now, simulate the test
    setTimeout(() => {
      if (smtpConfig.host && smtpConfig.auth.user && smtpConfig.auth.pass) {
        setSmtpTestStatus('success')
      } else {
        setSmtpTestStatus('error')
      }
      setTimeout(() => setSmtpTestStatus(null), 3000)
    }, 2000)
  }

  // Handle SMTP provider preset selection
  const handleSmtpProviderChange = (provider) => {
    const preset = SMTP_PRESETS[provider]
    if (preset) {
      updateSettings({
        smtpProvider: provider,
        smtpHost: preset.host,
        smtpPort: preset.port,
        smtpSecure: preset.secure,
      })
    }
  }

  // Check if SMTP is configured
  const getEmailStatus = () => {
    const hasSmtp = settings.smtpHost && settings.smtpUser && settings.smtpPass

    if (hasSmtp) return { configured: true, method: 'SMTP', variant: 'green' }
    return { configured: false, method: 'Gmail fallback', variant: 'yellow' }
  }

  const emailStatus = getEmailStatus()

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your garage profile and preferences" />

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
                  value={settings.name || ''} 
                  onChange={e => updateSettings({ name: e.target.value })} 
                  placeholder="Smith Tyres MK"
                />
              </div>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Address</label>
                <input 
                  style={inputStyle} 
                  value={settings.addr || ''} 
                  onChange={e => updateSettings({ addr: e.target.value })} 
                  placeholder="123 High Street"
                />
              </div>
              
              <div>
                <label style={labelStyle}>City</label>
                <input 
                  style={inputStyle} 
                  value={settings.city || ''} 
                  onChange={e => updateSettings({ city: e.target.value })} 
                  placeholder="Milton Keynes"
                />
              </div>
              
              <div>
                <label style={labelStyle}>Postcode</label>
                <input 
                  style={inputStyle} 
                  value={settings.post || ''} 
                  onChange={e => updateSettings({ post: e.target.value })} 
                  placeholder="MK1 1AA"
                />
              </div>
              
              <div>
                <label style={labelStyle}>Phone</label>
                <input 
                  style={inputStyle} 
                  value={settings.phone || ''} 
                  onChange={e => updateSettings({ phone: e.target.value })} 
                  placeholder="01908 123456"
                />
              </div>
              
              <div>
                <label style={labelStyle}>Email</label>
                <input 
                  style={inputStyle} 
                  type="email"
                  value={settings.email || ''} 
                  onChange={e => updateSettings({ email: e.target.value })} 
                  placeholder="info@smithtyres.co.uk"
                />
              </div>
            </div>

            <div style={{ 
              marginTop: '20px', 
              padding: '12px 16px', 
              background: 'rgba(34,197,94,0.08)', 
              border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px', 
              fontSize: '12px', 
              color: 'var(--green)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>✓</span>
              <span>Settings save automatically</span>
            </div>
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
                  value={settings.smtpProvider || 'custom'}
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
                {settings.smtpProvider && SMTP_PRESETS[settings.smtpProvider]?.notes && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '10px 12px', 
                    background: 'rgba(245,200,66,0.08)', 
                    border: '1px solid rgba(245,200,66,0.2)', 
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: 'var(--accent)'
                  }}>
                    💡 {SMTP_PRESETS[settings.smtpProvider].notes}
                  </div>
                )}
              </div>

              {/* SMTP Server Settings */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={labelStyle}>SMTP Host</label>
                  <input 
                    style={inputStyle} 
                    value={settings.smtpHost || ''} 
                    onChange={e => updateSettings({ smtpHost: e.target.value })} 
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input 
                    style={inputStyle} 
                    type="number"
                    value={settings.smtpPort || 587} 
                    onChange={e => updateSettings({ smtpPort: parseInt(e.target.value) || 587 })} 
                    placeholder="587"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Security</label>
                  <select 
                    style={inputStyle}
                    value={settings.smtpSecure ? 'ssl' : 'tls'}
                    onChange={e => updateSettings({ smtpSecure: e.target.value === 'ssl' })}
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
                    value={settings.smtpUser || ''} 
                    onChange={e => updateSettings({ smtpUser: e.target.value })} 
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password / App Password</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      style={{ ...inputStyle, paddingRight: '40px' }} 
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={settings.smtpPass || ''} 
                      onChange={e => updateSettings({ smtpPass: e.target.value })} 
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
                    value={settings.smtpFromName || ''} 
                    onChange={e => updateSettings({ smtpFromName: e.target.value })} 
                    placeholder={settings.name || 'GarageIQ'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>From Email</label>
                  <input 
                    style={inputStyle} 
                    type="email"
                    value={settings.smtpFromEmail || ''} 
                    onChange={e => updateSettings({ smtpFromEmail: e.target.value })} 
                    placeholder="invoices@yourdomain.com"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Reply-To Email (optional)</label>
                <input 
                  style={inputStyle} 
                  type="email"
                  value={settings.smtpReplyTo || ''} 
                  onChange={e => updateSettings({ smtpReplyTo: e.target.value })} 
                  placeholder="support@yourdomain.com"
                />
              </div>

              {/* Test Button */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <Btn 
                  variant="teal" 
                  onClick={testSmtpConnection}
                  disabled={smtpTestStatus === 'testing'}
                >
                  {smtpTestStatus === 'testing' ? '⏳ Testing...' : 
                   smtpTestStatus === 'success' ? '✓ Connected!' :
                   smtpTestStatus === 'error' ? '✗ Failed' : '🔌 Test Connection'}
                </Btn>
                <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
                  Tests connection to SMTP server
                </span>
              </div>
            </Card>



            {/* Email Defaults */}
            <Card>
              <div style={sectionTitle}>Email Defaults</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Default From Name</label>
                  <input 
                    style={inputStyle} 
                    value={settings.emailFromName || settings.name || ''} 
                    onChange={e => updateSettings({ emailFromName: e.target.value })} 
                    placeholder="Smith Tyres MK"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Default Reply-To Email</label>
                  <input 
                    style={inputStyle} 
                    type="email"
                    value={settings.emailReplyTo || settings.email || ''} 
                    onChange={e => updateSettings({ emailReplyTo: e.target.value })} 
                    placeholder="invoices@smithtyres.co.uk"
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Email Footer Text</label>
                  <textarea 
                    style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} 
                    value={settings.emailFooter || ''} 
                    onChange={e => updateSettings({ emailFooter: e.target.value })} 
                    placeholder="Thank you for your business! Payment is due within 14 days."
                  />
                </div>
              </div>
            </Card>
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
                  value={settings.vatScheme || 'standard'} 
                  onChange={e => updateSettings({ vatScheme: e.target.value })}
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
                  value={settings.vatNumber || ''} 
                  onChange={e => updateSettings({ vatNumber: e.target.value })} 
                  placeholder="GB123456789"
                />
              </div>

              {/* Only show flat rate % if flat rate scheme selected */}
              {settings.vatScheme === 'flatrate' && (
                <div>
                  <label style={labelStyle}>Flat Rate Percentage</label>
                  <input 
                    style={inputStyle} 
                    type="number"
                    step="0.1"
                    value={settings.flatRate || 8.5} 
                    onChange={e => updateSettings({ flatRate: parseFloat(e.target.value) })} 
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
              {settings.vatScheme === 'standard' && (
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

              {settings.vatScheme === 'flatrate' && (
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

              {settings.vatScheme === 'exempt' && (
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
          </Card>
        )}

        {/* SUBSCRIPTION TAB */}
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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showInvoicesModal, setShowInvoicesModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [changingTier, setChangingTier] = useState(null)

  const handleTierChange = async (newTier) => {
    setChangingTier(newTier)
    await setTier(newTier)
    setChangingTier(null)
  }

  // Mock invoice data
  const billingInvoices = [
    { id: 'INV-2026-03', date: '2026-03-01', amount: 90, status: 'paid' },
    { id: 'INV-2026-02', date: '2026-02-01', amount: 90, status: 'paid' },
    { id: 'INV-2026-01', date: '2026-01-01', amount: 90, status: 'paid' },
    { id: 'INV-2025-12', date: '2025-12-01', amount: 75, status: 'paid' },
  ]

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
              1st April 2026
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
          <Btn variant="secondary" onClick={() => setShowPaymentModal(true)}>Update Payment</Btn>
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

      {/* Update Payment Modal */}
      {showPaymentModal && (
        <Modal title="Update Payment Method" onClose={() => setShowPaymentModal(false)}>
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>
              Update your payment details securely. This will be used for future billing.
            </p>
            
            <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px' }}>Current Card</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>💳</span>
                <div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>Visa •••• 4242</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Expires 12/2027</div>
                </div>
              </div>
            </div>

            <div style={{ 
              background: 'rgba(96,165,250,0.1)', 
              border: '1px solid rgba(96,165,250,0.2)', 
              borderRadius: '8px', 
              padding: '14px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '13px', color: 'var(--blue)', marginBottom: '8px' }}>
                🔒 Secure Payment via Stripe
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                In production, this opens Stripe's secure payment form
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Btn>
            <Btn variant="primary" onClick={() => { alert('In production, this would open Stripe checkout'); setShowPaymentModal(false) }}>
              Update Card
            </Btn>
          </div>
        </Modal>
      )}

      {/* View Invoices Modal */}
      {showInvoicesModal && (
        <Modal title="Billing Invoices" onClose={() => setShowInvoicesModal(false)}>
          <div style={{ marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Invoice', 'Date', 'Amount', 'Status', ''].map(h => (
                    <th key={h} style={{ 
                      textAlign: 'left', 
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
                      <button 
                        onClick={() => alert(`Downloading ${inv.id}...`)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--accent)', 
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        Download
                      </button>
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
              Your current plan will end on <strong>1st April 2026</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Btn variant="secondary" onClick={() => setShowCancelModal(false)}>Keep Subscription</Btn>
            <Btn variant="danger" onClick={() => { 
              alert('Subscription cancelled. In production, this would process via Stripe.'); 
              setShowCancelModal(false) 
            }}>
              Yes, Cancel
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