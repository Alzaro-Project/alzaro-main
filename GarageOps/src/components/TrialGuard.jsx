import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

export default function TrialGuard({ children }) {
  const user = useStore(s => s.user)
  const garageId = useStore(s => s.garageId)
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveTrialEnds, setLiveTrialEnds] = useState(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(null)   // tier key while a checkout is starting
  const [buyErr, setBuyErr] = useState('')

  // Fetch fresh status from Supabase on mount and periodically
  useEffect(() => {
    if (!garageId) {
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('product_members')
          .select('status, trial_ends')
          .eq('id', garageId)
          .single()

        if (!error && data) {
          setLiveStatus(data.status)
          setLiveTrialEnds(data.trial_ends)
        }
      } catch (err) {
        console.error('Failed to fetch garage status:', err)
      }
      setLoading(false)
    }

    fetchStatus()

    // Re-check status every 30 seconds in case admin changes it
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [garageId])

  // Start a Stripe Checkout for the chosen tier straight from this wall.
  // The app (and its Settings billing page) sits behind this very guard, so an
  // expired-trial user previously had no self-serve way to subscribe.
  const PLANS = [
    { key: 'basic',  name: 'Basic',  price: '£5.99'  },
    { key: 'bronze', name: 'Bronze', price: '£12.99' },
    { key: 'silver', name: 'Silver', price: '£18.99' },
    { key: 'gold',   name: 'Gold',   price: '£28.99' },
  ]
  const startCheckout = async (tierKey) => {
    setBuying(tierKey); setBuyErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const email = user?.email || session?.user?.email
      if (!session?.access_token || !email) throw new Error('Please sign in again to subscribe.')
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, garageId, product: 'garageops', tier: tierKey }),
      })
      const out = await res.json()
      if (!res.ok || !out.url) throw new Error(out.error || 'Could not start checkout')
      window.location.href = out.url
    } catch (e) {
      setBuyErr(e.message || 'Could not start checkout')
      setBuying(null)
    }
  }

  // If no user, let the router handle redirect to login
  if (!user) return children

  // Show loading state while fetching status
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
          <div style={{ color: 'var(--text2)', fontSize: '14px' }}>Loading...</div>
        </div>
      </div>
    )
  }
  
  // If status is 'suspended', block access
  if (liveStatus === 'suspended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Account Suspended
          </div>
          <div style={{ color: 'var(--text2)', marginBottom: '24px', lineHeight: 1.6 }}>
            Your account has been suspended. Please contact support to resolve this issue.
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '13px' }}>
            Email: support@alzaro.co.uk
          </div>
          <button
            onClick={() => {
              useStore.getState().logout()
            }}
            style={{
              marginTop: '20px',
              background: 'var(--surface3)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }
  
  // Check if trial has expired
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
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Trial Expired
            </div>
            <div style={{ color: 'var(--text2)', marginBottom: '24px', lineHeight: 1.6 }}>
              Your 14-day free trial has ended. Subscribe to continue using Alzaro GarageOps and access all your data.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PLANS.map(p => (
                <button
                  key={p.key}
                  onClick={() => startCheckout(p.key)}
                  disabled={!!buying || !garageId}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: p.key === 'silver' ? 'var(--accent)' : 'var(--surface3)',
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
              onClick={() => {
                useStore.getState().logout()
              }}
              style={{
                marginTop: '16px',
                background: 'none',
                border: 'none',
                color: 'var(--text3)',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
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
