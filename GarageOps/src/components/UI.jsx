// Shared UI primitives + tier-gating components
import { useStore, TIER_ORDER } from '../store/useStore'
import { useNavigate } from 'react-router-dom'

export function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 800 }}>{title}</div>
        {subtitle && <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {children && <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>{children}</div>}
    </div>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', ...style }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, delta, color = 'var(--text)' }) {
  return (
    <Card>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace' }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '24px', fontWeight: 500, marginTop: '5px', marginBottom: '3px', color }}>{value}</div>
      {delta && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{delta}</div>}
    </Card>
  )
}

export function Btn({ children, onClick, variant = 'secondary', sm = false }) {
  const styles = {
    primary: {
      background: 'var(--accent)',
      color: '#fff',
      boxShadow: '0 4px 16px var(--accent-glow)',
    },
    secondary: { background: 'var(--surface3)', color: 'var(--text)', border: '1px solid var(--border-light)' },
    danger: { background: 'rgba(229,57,53,0.1)', color: 'var(--accent)', border: '1px solid rgba(229,57,53,.25)' },
    success: { background: 'rgba(76,175,80,0.12)', color: 'var(--green)', border: '1px solid rgba(76,175,80,.25)' },
    ghost: { background: 'none', color: 'var(--text2)', border: 'none' },
    teal: { background: 'rgba(45,212,191,0.1)', color: 'var(--teal)', border: '1px solid rgba(45,212,191,.2)' },
  }
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: sm ? '6px 12px' : '10px 18px',
      borderRadius: '10px', fontSize: sm ? '11px' : '13px', fontWeight: 600,
      cursor: 'pointer', transition: 'all .2s ease', fontFamily: 'inherit',
      ...styles[variant],
    }}>
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'gray' }) {
  const styles = {
    green: { background: 'rgba(76,175,80,0.12)', color: 'var(--green)' },
    red: { background: 'rgba(229,57,53,0.12)', color: 'var(--accent)' },
    yellow: { background: 'rgba(255,179,0,0.12)', color: 'var(--amber)' },
    blue: { background: 'rgba(66,165,245,0.12)', color: 'var(--blue)' },
    gray: { background: 'var(--surface3)', color: 'var(--text2)' },
    teal: { background: 'rgba(45,212,191,0.12)', color: 'var(--teal)' },
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '20px',
      fontSize: '10px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
      ...styles[variant],
    }}>
      {children}
    </span>
  )
}

// =============================================================
// TIER GATING
// =============================================================

export const TIER_INFO = {
  bronze: { label: 'Bronze', price: '£60/mo', color: '#cd7f32', icon: '🥉' },
  silver: { label: 'Silver', price: '£75/mo', color: '#c0c0c0', icon: '🥈' },
  gold: { label: 'Gold', price: '£90/mo', color: 'var(--accent)', icon: '🥇' },
}

/**
 * Wrap any page or section to require a minimum tier.
 * Usage: <TierGate min="silver" feature="Reports"><ReportsContent /></TierGate>
 *
 * If the user's tier is below `min`, they see an upgrade screen instead
 * of the children. Admins always pass through.
 */
export function TierGate({ min, feature, children }) {
  const { tier, isAdmin } = useStore()
  if (isAdmin) return children
  if (TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(min)) {
    return <UpgradeScreen feature={feature} requiredTier={min} currentTier={tier} />
  }
  return children
}

/**
 * Full-page lockout screen shown when a user lacks the required tier.
 * CTA navigates to Settings → Subscription tab.
 */
export function UpgradeScreen({ feature, requiredTier, currentTier }) {
  const navigate = useNavigate()
  const info = TIER_INFO[requiredTier] || TIER_INFO.silver
  const current = TIER_INFO[currentTier] || TIER_INFO.bronze

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <Card style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '40px 32px', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle red glow in background */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          right: '-100px',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>{info.icon}</div>
          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.5px' }}>
            {feature} is a {info.label} feature
          </div>
          <div style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
            Upgrade your plan to unlock {feature ? feature.toLowerCase() : 'this feature'} and other advanced tools for your garage.
          </div>

          <div style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border-light)',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Required Plan
              </div>
              <div style={{ fontWeight: 600, fontSize: '15px', marginTop: '2px' }}>
                {info.icon} {info.label}
              </div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '20px', fontWeight: 600, color: 'var(--accent)' }}>
              {info.price}
            </div>
          </div>

          <button
            onClick={() => navigate('/settings', { state: { tab: 'subscription' } })}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              fontFamily: 'Space Grotesk, sans-serif',
              fontWeight: 600,
              fontSize: '14px',
              padding: '13px 28px',
              borderRadius: '10px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 16px var(--accent-glow)',
              transition: 'transform 0.1s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px var(--accent-glow)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px var(--accent-glow)' }}
          >
            Upgrade to {info.label} →
          </button>

          <div style={{ marginTop: '14px', fontSize: '12px', color: 'var(--text3)' }}>
            You're currently on <strong style={{ color: 'var(--text2)' }}>{current.icon} {current.label}</strong>
          </div>
        </div>
      </Card>
    </div>
  )
}

/**
 * Small inline pill showing a tier badge — useful in sidebar items, table rows,
 * or anywhere you want to mark something as requiring a higher tier.
 */
export function TierBadge({ tier, sm = false }) {
  const info = TIER_INFO[tier]
  if (!info) return null
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      padding: sm ? '1px 5px' : '2px 7px',
      borderRadius: '10px',
      fontSize: sm ? '8px' : '9px',
      fontWeight: 700,
      fontFamily: 'JetBrains Mono, monospace',
      background: 'var(--surface3)',
      color: info.color,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      whiteSpace: 'nowrap',
    }}>
      {info.icon} {info.label}
    </span>
  )
}

/**
 * Helper hook: returns { canUse, currentTier, requiredTier } for inline gating
 * within a page (e.g. disable a button, hide a section).
 *
 * Usage:
 *   const { canUse } = useTier('gold')
 *   if (!canUse) return <Btn disabled>Export to CSV (Gold+)</Btn>
 */
export function useTier(min) {
  const { tier, isAdmin } = useStore()
  if (isAdmin) return { canUse: true, currentTier: tier, requiredTier: min }
  const canUse = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min)
  return { canUse, currentTier: tier, requiredTier: min }
}
