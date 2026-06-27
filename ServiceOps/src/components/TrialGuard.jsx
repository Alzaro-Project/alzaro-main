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

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }

    const fetchStatus = async () => {
      try {
        const { data, error } = await db
          .from('product_members')
          .select('status, trial_ends')
          .eq('user_id', user.id)
          .eq('product', 'serviceops')
          .maybeSingle()
        if (!error && data) {
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
            <a href="/serviceops/settings" style={{ display: 'inline-block', background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13.5, padding: '12px 22px', borderRadius: 8, textDecoration: 'none' }}>View plans</a>
            <div style={{ color: 'var(--txt-3)', fontSize: 12, marginTop: 10 }}>Starting from £12.99/month</div>
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
