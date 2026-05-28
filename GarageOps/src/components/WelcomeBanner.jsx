import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

export default function WelcomeBanner() {
  const navigate = useNavigate()
  const { settings, customers, batches, invoices } = useStore()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  // Compute step completion
  const settingsDone = !!(settings?.name && settings?.addr && settings?.phone)
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
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '14px',
      padding: '24px',
      marginBottom: '20px',
      position: 'relative',
    }}>
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
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
          color: 'var(--accent)',
          fontSize: '20px',
          fontWeight: 700,
          margin: '0 0 4px 0',
        }}>
          👋 Welcome to GarageOps
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
          background: 'var(--accent)',
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
              border: `1px solid ${step.done ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = step.done ? 'var(--green)' : 'var(--border)'}
          >
            {/* Tick / circle */}
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: step.done ? 'var(--green)' : 'transparent',
              border: step.done ? 'none' : '2px solid var(--border)',
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
              color: step.done ? 'var(--text2)' : 'var(--text)',
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
