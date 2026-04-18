import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

export default function TrialGuard({ children }) {
  const user = useStore(s => s.user)
  const isAdmin = useStore(s => s.isAdmin)
  const garageId = useStore(s => s.garageId)
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveTrialEnds, setLiveTrialEnds] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch fresh status from Supabase on mount and periodically
  useEffect(() => {
    if (!garageId || isAdmin) {
      setLoading(false)
      return
    }

    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('garages')
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
  }, [garageId, isAdmin])

  // Admins bypass all checks
  if (isAdmin) return children
  
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
            Email: support@garageiq.co.uk
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
              Your 14-day free trial has ended. Subscribe to continue using GarageIQ and access all your data.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <a 
                href="mailto:support@garageiq.co.uk?subject=GarageIQ Subscription"
                style={{ 
                  background: 'var(--accent)', 
                  color: '#000', 
                  fontWeight: 700, 
                  fontSize: '14px', 
                  padding: '13px 24px', 
                  borderRadius: '8px', 
                  textDecoration: 'none',
                  display: 'inline-block'
                }}
              >
                Subscribe Now
              </a>
              <div style={{ color: 'var(--text3)', fontSize: '12px' }}>
                Starting from £60/month
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '24px', paddingTop: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>
                Questions? Contact us:
              </div>
              <div style={{ color: 'var(--text2)', fontSize: '13px' }}>
                support@garageiq.co.uk
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