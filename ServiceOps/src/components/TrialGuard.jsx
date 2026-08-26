import { useEffect, useState } from 'react'
import { db } from '../lib/db.js'

// Status gating for ServiceOps, mirroring the other verticals' TrialGuard.
// Reads product_members.status / trial_ends (by user_id + product) and blocks
// access when a subscription is suspended/cancelled or an unpaid trial has
// expired. The Stripe webhook keeps status in sync; re-check on mount + 30s.
export default function TrialGuard({ user, children }) {
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveTrialEnds, setLiveTrialEnds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [memberId, setMemberId] = useState(null)   // product_members row id — the checkout API's garageId
  const [buying, setBuying] = useState(null)
  const [buyErr, setBuyErr] = useState('')

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }

    const fetchStatus = async () => {
      try {
        const { data, error } = await db
          .from('product_members')
          .select('id, status, trial_ends')
          .eq('user_id', user.id)
          .eq('product', 'serviceops')
          .maybeSingle()
        if (!error && data) {
          setMemberId(data.id)
          setLiveStatus(data.status)
          setLiveTrialEnds(data.trial_ends)
        }
      } catch (err) {
        console.error('Failed to fetch ServiceOps status:', err)
      }
      setLoading(false)
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [user?.id])

  // Start a Stripe Checkout straight from this wall — /serviceops/settings sits
  // behind this same guard, so the old "View plans" link just looped back here.
  const PLANS = [
    { key: 'basic',  name: 'Basic',  price: '£5.99'  },
    { key: 'bronze', name: 'Bronze', price: '£12.99' },
    { key: 'silver', name: 'Silver', price: '£18.99' },
    { key: 'gold',   name: 'Gold',   price: '£28.99' },
  ]
  const startCheckout = async (tierKey) => {
    setBuying(tierKey); setBuyErr('')
    try {
      const { data: { session } } = await db.auth.getSession()
      const email = user?.email || session?.user?.email
      if (!session?.access_token || !email) throw new Error('Please sign in again to subscribe.')
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, garageId: memberId, product: 'serviceops', tier: tierKey }),
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
    try { await db.auth.signOut() } catch (e) { /* ignore */ }
    window.location.href = '/serviceops/login'
  }

  const wrap = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }
  const cardStyle = { background: 'var(--panel-2)', border: '0.5px solid var(--line)', borderRadius: 16, padding: 40, maxWidth: 460, textAlign: 'center' }
  const outBtn = { marginTop: 18, background: 'var(--panel)', border: '0.5px solid var(--line)', borderRadius: 8, padding: '9px 18px', color: 'var(--txt)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }

  if (loading) {
    return <div style={{ ...wrap, color: 'var(--txt-3)', fontSize: 13 }}>Loading…</div>
  }

  if (liveStatus === 'suspended') {
    return (
      <div style={wrap}>
        <div style={cardStyle}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Account Suspended</div>
          <div style={{ color: 'var(--txt-2)', marginBottom: 20, lineHeight: 1.6, fontSize: 13.5 }}>
            Your subscription is no longer active. Please contact support or update your billing to restore access.
          </div>
          <div style={{ color: 'var(--txt-3)', fontSize: 12.5 }}>Email: support@alzaro.co.uk</div>
          <button onClick={signOut} style={outBtn}>Sign Out</button>
        </div>
      </div>
    )
  }

  if (liveStatus === 'trial' && liveTrialEnds) {
    const trialEnd = new Date(liveTrialEnds)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    trialEnd.setHours(0, 0, 0, 0)
    if (today > trialEnd) {
      return (
        <div style={wrap}>
          <div style={cardStyle}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>⏰</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Trial Expired</div>
            <div style={{ color: 'var(--txt-2)', marginBottom: 20, lineHeight: 1.6, fontSize: 13.5 }}>
              Your free trial has ended. Subscribe to continue using Alzaro ServiceOps and access all your data.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLANS.map(p => (
                <button
                  key={p.key}
                  onClick={() => startCheckout(p.key)}
                  disabled={!!buying || !memberId}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: p.key === 'silver' ? 'var(--brand)' : 'var(--panel)',
                    color: p.key === 'silver' ? '#fff' : 'var(--txt)',
                    border: '0.5px solid var(--line)', borderRadius: 8,
                    padding: '11px 16px', fontSize: 13.5, fontWeight: 700,
                    cursor: buying ? 'wait' : 'pointer', opacity: buying && buying !== p.key ? 0.6 : 1,
                  }}
                >
                  <span>{buying === p.key ? 'Opening checkout…' : `Subscribe to ${p.name}`}</span>
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>{p.price}/mo</span>
                </button>
              ))}
              {buyErr && <div style={{ color: '#e5484d', fontSize: 12.5 }}>{buyErr}</div>}
              <div style={{ color: 'var(--txt-3)', fontSize: 12 }}>Cancel any time. Your data is exactly where you left it.</div>
            </div>
            <div style={{ borderTop: '0.5px solid var(--line)', marginTop: 20, paddingTop: 14, color: 'var(--txt-3)', fontSize: 12.5 }}>
              Questions? support@alzaro.co.uk
            </div>
            <button onClick={signOut} style={{ ...outBtn, background: 'none', border: 'none', textDecoration: 'underline', color: 'var(--txt-3)', fontWeight: 500, fontSize: 12 }}>Sign out</button>
          </div>
        </div>
      )
    }
  }

  return children
}
