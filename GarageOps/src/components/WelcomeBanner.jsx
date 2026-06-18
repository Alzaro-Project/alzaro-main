import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// WelcomeBanner — GarageOps getting-started guide
// ------------------------------------------------------------
// Shows on the Dashboard until either (a) all steps are done,
// or (b) the user dismisses it (dismissal is remembered per
// garage via localStorage). Booking & purchase counts come
// straight from Supabase since they aren't held in the store.
// ============================================================

export default function WelcomeBanner() {
  const navigate = useNavigate()
  const { settings, customers, invoices, garageId } = useStore()

  const [dismissed, setDismissed] = useState(false)
  const [counts, setCounts] = useState(null) // { bookings, purchases }

  const storageKey = garageId ? `go-welcome-dismissed-${garageId}` : null

  // Read remembered dismissal once we know the garage
  useEffect(() => {
    if (!storageKey) return
    try {
      if (localStorage.getItem(storageKey) === '1') setDismissed(true)
    } catch { /* private browsing — banner just won't remember */ }
  }, [storageKey])

  // Count bookings & purchases (cheap head-only queries)
  useEffect(() => {
    if (!garageId) return
    Promise.all([
      supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('account_id', garageId),
      supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('account_id', garageId),
    ]).then(([b, p]) => {
      setCounts({ bookings: b.count || 0, purchases: p.count || 0 })
    }).catch(() => {
      setCounts({ bookings: 0, purchases: 0 })
    })
  }, [garageId])

  const handleDismiss = () => {
    setDismissed(true)
    try { if (storageKey) localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
  }

  if (dismissed) return null
  if (!counts) return null // wait for counts to avoid steps flickering

  const steps = [
    { id: 'settings', label: 'Set up your garage details', done: !!(settings?.name && settings?.addr && settings?.phone), path: '/settings' },
    { id: 'customer', label: 'Add your first customer', done: (customers || []).length > 0, path: '/customers' },
    { id: 'booking',  label: 'Create your first booking', done: counts.bookings > 0, path: '/calendar' },
    { id: 'purchase', label: 'Record a purchase', done: counts.purchases > 0, path: '/purchases' },
    { id: 'invoice',  label: 'Raise your first invoice', done: (invoices || []).length > 0, path: '/invoices' },
  ]

  const completedCount = steps.filter(s => s.done).length
  const totalSteps = steps.length

  // Everything done — quietly retire the banner for good
  if (completedCount === totalSteps) {
    try { if (storageKey) localStorage.setItem(storageKey, '1') } catch { /* ignore */ }
    return null
  }

  return (
    <div className="card" style={{
      background: 'var(--surface)',
      border: '0.5px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      position: 'relative',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        title="Dismiss — you can finish these steps anytime"
        style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'transparent', border: 'none',
          color: 'var(--text3)', fontSize: '16px', cursor: 'pointer',
          padding: '4px 8px', lineHeight: 1,
        }}
      >
        <i className="ti ti-x" aria-hidden="true" />
      </button>

      {/* Header */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.3px' }}>
          👋 Welcome to Alzaro <span style={{ color: 'var(--red)' }}>GarageOps</span>
        </div>
        <div style={{ color: 'var(--text2)', fontSize: '12px', marginTop: '2px' }}>
          Let's get you set up — {completedCount} of {totalSteps} complete
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: '6px', background: 'var(--surface2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          height: '100%',
          width: `${(completedCount / totalSteps) * 100}%`,
          background: 'var(--red)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {steps.map(step => (
          <button
            key={step.id}
            onClick={() => navigate(step.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'var(--surface2)',
              border: `1px solid ${step.done ? 'var(--green)' : 'var(--border)'}`,
              borderRadius: '8px', padding: '10px 14px',
              cursor: 'pointer', textAlign: 'left',
              transition: 'border-color 0.15s ease',
              fontFamily: 'inherit', width: '100%',
            }}
            onMouseEnter={e => { if (!step.done) e.currentTarget.style.borderColor = 'var(--red)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = step.done ? 'var(--green)' : 'var(--border)' }}
          >
            <div style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: step.done ? 'var(--green)' : 'transparent',
              border: step.done ? 'none' : '2px solid var(--border2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: '#000', fontSize: '13px', fontWeight: 700,
            }}>
              {step.done ? '✓' : ''}
            </div>
            <span style={{
              color: step.done ? 'var(--text3)' : 'var(--text)',
              fontSize: '13px',
              textDecoration: step.done ? 'line-through' : 'none',
              flex: 1,
            }}>
              {step.label}
            </span>
            <i className="ti ti-arrow-right" style={{ color: 'var(--text3)', fontSize: '14px' }} aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
