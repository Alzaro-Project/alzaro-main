import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

// Brand accent colours kept fixed across themes (intentional TyreOps yellow + green tick).
// Everything else uses theme variables so the banner follows light/dark mode.
const ACCENT = '#FFC700'
const SUCCESS = '#22c55e'

export default function WelcomeBanner() {
  const navigate = useNavigate()
  const settings = useStore(s => s.settings)
  const customers = useStore(s => s.customers)
  const batches = useStore(s => s.batches)
  const invoices = useStore(s => s.invoices)
  const dismissed = useStore(s => s.welcomeBannerDismissed)
  const dismissWelcomeBanner = useStore(s => s.dismissWelcomeBanner)

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
  const allDone = completedCount === totalSteps

  // Once every step is complete, dismiss the banner permanently.
  useEffect(() => {
    if (allDone && !dismissed) dismissWelcomeBanner()
  }, [allDone, dismissed, dismissWelcomeBanner])

  if (dismissed || allDone) return null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
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
          color: 'var(--text3)',
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
          color: ACCENT,
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 4px 0',
        }}>
          👋 Welcome to TyreOps
        </h2>
        <p style={{
          color: 'var(--text2)',
          fontSize: '14px',
          margin: 0,
        }}>
          Let's get you set up — {completedCount} of {totalSteps} complete
        </p>
      </div>

      {/* Progress bar */}
      <div style={{
        height: '6px',
        background: 'var(--surface2)',
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '20px',
      }}>
        <div style={{
          height: '100%',
          width: `${(completedCount / totalSteps) * 100}%`,
          background: ACCENT,
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
              background: 'var(--surface2)',
              border: `1px solid ${step.done ? SUCCESS : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
            onMouseLeave={e => e.currentTarget.style.borderColor = step.done ? SUCCESS : 'var(--border)'}
          >
            {/* Tick / number */}
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: step.done ? SUCCESS : 'transparent',
              border: step.done ? 'none' : `2px solid var(--border)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: step.done ? '#000' : 'var(--text3)',
              fontSize: '14px',
              fontWeight: 700,
            }}>
              {step.done ? '✓' : ''}
            </div>

            <span style={{
              color: step.done ? 'var(--text3)' : 'var(--text)',
              fontSize: '14px',
              textDecoration: step.done ? 'line-through' : 'none',
              flex: 1,
            }}>
              {step.label}
            </span>

            <span style={{ color: 'var(--text3)', fontSize: '14px' }}>→</span>
          </button>
        ))}
      </div>
    </div>
  )
}
