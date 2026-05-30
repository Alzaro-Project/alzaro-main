import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { getTenantStatus } from '../lib/db'
import { PRODUCT, TIER_PRICE, TIER_ORDER } from '../config/product'

const lowestPrice = TIER_PRICE[TIER_ORDER[0]]

export default function TrialGuard({ children }) {
  const user = useStore(s => s.user)
  const isAdmin = useStore(s => s.isAdmin)
  const tenantId = useStore(s => s.tenantId)
  const logout = useStore(s => s.logout)
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveTrialEnds, setLiveTrialEnds] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!tenantId || isAdmin) { setLoading(false); return }

    const fetchStatus = async () => {
      try {
        const data = await getTenantStatus(tenantId)
        setLiveStatus(data.status)
        setLiveTrialEnds(data.trial_ends)
      } catch (err) {
        console.error('Failed to fetch tenant status:', err)
      }
      setLoading(false)
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [tenantId, isAdmin])

  if (isAdmin) return children
  if (!user) return children

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

  const Block = ({ icon, title, body, children }) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', maxWidth: '500px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{title}</div>
        <div style={{ color: 'var(--text2)', marginBottom: '24px', lineHeight: 1.6 }}>{body}</div>
        {children}
        <div style={{ marginTop: '8px' }}>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )

  if (liveStatus === 'suspended') {
    return (
      <Block icon="🔒" title="Account Suspended"
        body={`Your account has been suspended. Please contact support to resolve this.`}>
        <div style={{ color: 'var(--text3)', fontSize: '13px', marginBottom: '8px' }}>{PRODUCT.supportEmail}</div>
      </Block>
    )
  }

  if (liveStatus === 'trial' && liveTrialEnds) {
    const trialEnd = new Date(liveTrialEnds)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    trialEnd.setHours(0, 0, 0, 0)
    if (today > trialEnd) {
      return (
        <Block icon="⏰" title="Trial Expired"
          body={`Your ${PRODUCT.trialDays}-day free trial has ended. Subscribe to continue using ${PRODUCT.name} and access your data.`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            <a href={`mailto:${PRODUCT.supportEmail}?subject=${encodeURIComponent(PRODUCT.billingSubject)}`}
              style={{ background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '13px 24px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }}>
              Subscribe Now
            </a>
            <div style={{ color: 'var(--text3)', fontSize: '12px' }}>Starting from £{lowestPrice}/month</div>
          </div>
        </Block>
      )
    }
  }

  return children
}
