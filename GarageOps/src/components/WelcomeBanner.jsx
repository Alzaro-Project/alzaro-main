import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

// Brand colours (GarageOps gold theme)
const BRAND = {
  accent: '#FFC700',
  accentDark: '#E5B400',
  surface: '#1a1a1a',
  surfaceLight: '#252525',
  border: '#333',
  text: '#fff',
  textMuted: '#999',
  success: '#22c55e',
}

export default function WelcomeBanner() {
  const navigate = useNavigate()
  const settings = useStore(s => s.settings)
  const customers = useStore(s => s.customers)
  const batches = useStore(s => s.batches)
  const invoices = useStore(s => s.invoices)
  const dismissed = useStore(s => s.welcomeBannerDismissed)
  const dismissWelcomeBanner = useStore(s => s.dismissWelcomeBanner)

  if (dismissed) return null

  // Compute step completion
  const settingsDone = !!(settings.name && settings.addr && settings.phone)
  const customerDone = customers.length > 0
  const purchaseDone = batches.length > 0
  const invoiceDone = invoices.length > 0

  const steps = [
    { id: 'settings', label: 'Set up your garage details', done: settingsDone, path: '/settings' },
    { id: 'customer', label: 'Add your first customer', done: customerDone, path: '/customers' },
    { id: 'purchase', label: 'Record a stock purchase', done: purchaseDone, path: '/purchases' },
    { id: 'invoice', label: 'Create your first invoice', done: invoiceDone, path: '/invoices' },
  ]

  const completedCount = steps.filter(s => s.done).length
  const totalSteps = steps.length

  return (
    <div style={{
      background: BRAND.surface,
      border: `1px solid ${BRAND.border}`,
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px',
      position: 'relative',
    }}>
      {/* Dismiss button */}
      <button
        onClick={dismissWelcomeBanner}
        title="Dismiss"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'transparent',
          border: 'none',
          color: BRAND.textMuted,
          fontSize: '20px',
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          color: BRAND.accent,
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 4px 0',
        }}>
          👋 Welcome to GarageOps
        </h2>
        <p style={{
          color: BRAND.textMuted,
          fontSize: '14px',
          margin: 0,
        }}>
          Let's get you set up — {completedCount} of {totalSteps} complete
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '6px',
        background: BRAND.surfaceLight,
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '20px',
      }}>
        <div style={{
          height: '100%',
          width: `${(completedCount / totalSteps) * 100}%`,
          background: BRAND.accent,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {steps.map(step => (
          <button
            key={step.id}
            onClick={() => navigate(step.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: BRAND.surfaceLight,
              border: `1px solid ${step.done ? BRAND.success : BRAND.border}`,
              borderRadius: '8px',
              padding: '12px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = BRAND.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = step.done ? BRAND.success : BRAND.border}
          >
            {/* Tick / number */}
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: step.done ? BRAND.success : 'transparent',
              border: step.done ? 'none' : `2px solid ${BRAND.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: step.done ? '#000' : BRAND.textMuted,
              fontSize: '14px',
              fontWeight: 700,
            }}>
              {step.done ? '✓' : ''}
            </div>

            <span style={{
              color: step.done ? BRAND.textMuted : BRAND.text,
              fontSize: '14px',
              textDecoration: step.done ? 'line-through' : 'none',
              flex: 1,
            }}>
              {step.label}
            </span>

            <span style={{ color: BRAND.textMuted, fontSize: '14px' }}>→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
