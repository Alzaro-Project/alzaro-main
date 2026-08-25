import { useEffect, useState } from 'react'
import { sb } from '../lib/supabase.js'

// Status gating for SoloOps, mirroring the other verticals' TrialGuard.
// Reads product_members.status / trial_ends (live, by row id) and blocks access
// when a subscription is suspended/cancelled or an unpaid trial has expired.
// The Stripe webhook keeps status in sync; this re-checks on mount + every 30s.
export default function TrialGuard({ memberId, children }) {
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveTrialEnds, setLiveTrialEnds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(null)   // tier key while a checkout is starting
  const [buyErr, setBuyErr] = useState('')

  useEffect(() => {
    if (!memberId) {
      // No membership row yet — let the app render (App.jsx already gated auth).
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const { data, error } = await sb
          .from('product_members')
          .select('status, trial_ends')
          .eq('id', memberId)
          .single()
        if (!error && data) {
          setLiveStatus(data.status)
          setLiveTrialEnds(data.trial_ends)
        }
      } catch (err) {
        console.error('Failed to fetch SoloOps status:', err)
      }
      setLoading(false)
    }

    fetchStatus()
    // Re-check periodically in case an admin or Stripe changes the status.
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [memberId])

  // Start a Stripe Checkout for the chosen tier straight from this wall.
  // Without this an expired-trial user is locked out of Settings by this very
  // guard, so "View plans" used to loop back here with no way to actually pay.
  const PLANS = [
    { key: 'basic',  name: 'Basic',  price: '£5.99'  },
    { key: 'bronze', name: 'Bronze', price: '£12.99' },
    { key: 'silver', name: 'Silver', price: '£18.99' },
    { key: 'gold',   name: 'Gold',   price: '£28.99' },
  ]
  const startCheckout = async (tierKey) => {
    setBuying(tierKey); setBuyErr('')
    try {
      const { data } = await sb.auth.getSession()
      const session = data?.session
      if (!session?.access_token || !session?.user?.email) throw new Error('Please sign in again to subscribe.')
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: session.user.email,
          garageId: memberId,
          product: 'soloops',
          tier: tierKey,
        }),
      })
      const out = await res.json()
      if (!res.ok || !out.url) throw new Error(out.error || 'Could not start checkout')
      window.location.href = out.url
    } catch (e) {
      setBuyErr(e.message || 'Could not start checkout')
      setBuying(null)
    }
  }

  const signOut = async () => {
    try { await sb.auth.signOut() } catch (e) { /* ignore */ }
    window.location.href = '/soloops/login'
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
          <div style={{ color: 'var(--text2)', fontSize: '14px' }}>Loading…</div>
        </div>
      </div>
    )
  }

  // Suspended (e.g. subscription cancelled / payment failed) — block access.
  if (liveStatus === 'suspended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Account Suspended
          </div>
          <div style={{ color: 'var(--text2)', marginBottom: '24px', lineHeight: 1.6 }}>
            Your subscription is no longer active. Please contact support or update your billing to restore access.
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '13px' }}>
            Email: support@alzaro.co.uk
          </div>
          <button
            onClick={signOut}
            style={{ marginTop: '20px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 20px', color: 'var(--text)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Trial expired — block access until they subscribe.
  if (liveStatus === 'trial' && liveTrialEnds) {
    const trialEnd = new Date(liveTrialEnds)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    trialEnd.setHours(0, 0, 0, 0)

    if (today > trialEnd) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Trial Expired
            </div>
            <div style={{ color: 'var(--text2)', marginBottom: '24px', lineHeight: 1.6 }}>
              Your free trial has ended. Subscribe to continue using Alzaro SoloOps and access all your data.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PLANS.map(p => (
                <button
                  key={p.key}
                  onClick={() => startCheckout(p.key)}
                  disabled={!!buying || !memberId}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: p.key === 'silver' ? 'var(--orange)' : 'var(--surface2)',
                    color: p.key === 'silver' ? '#000' : 'var(--text)',
                    border: '1px solid var(--border)', borderRadius: '8px',
                    padding: '12px 18px', fontSize: '14px', fontWeight: 700,
                    cursor: buying ? 'wait' : 'pointer', opacity: buying && buying !== p.key ? 0.6 : 1,
                  }}
                >
                  <span>{buying === p.key ? 'Opening checkout…' : `Subscribe to ${p.name}`}</span>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{p.price}/mo</span>
                </button>
              ))}
              {buyErr && (
                <div style={{ color: '#e5484d', fontSize: '13px' }}>{buyErr}</div>
              )}
              <div style={{ color: 'var(--text3)', fontSize: '12px' }}>
                Cancel any time. Your data is exactly where you left it.
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '24px', paddingTop: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>
                Questions? Contact us:
              </div>
              <div style={{ color: 'var(--text2)', fontSize: '13px' }}>
                support@alzaro.co.uk
              </div>
            </div>
            <button
              onClick={signOut}
              style={{ marginTop: '16px', background: 'none', border: 'none', color: 'var(--text3)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Sign out
            </button>
          </div>
        </div>
      )
    }
  }

  return children
}
