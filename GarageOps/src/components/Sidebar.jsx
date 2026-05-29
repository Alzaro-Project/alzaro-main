import { useNavigate, useLocation } from 'react-router-dom'
import { useStore, TIER_ORDER } from '../store/useStore'
import GlobalSearch from './GlobalSearch'

// ============================================================
// Sidebar — GarageOps v2
// ------------------------------------------------------------
// 8 nav items, Tabler outline icons.
// Now theme-aware: colours come from a palette that switches on
// the store `theme` ('dark' | 'light'). Footer has a Light/Dark
// toggle above Sign out (PropOps style).
// ============================================================

const NAV = [
  { path: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard', min: 'bronze' },
  { path: '/invoices',  icon: 'ti-file-text',        label: 'Invoices',  min: 'bronze' },
  { path: '/customers', icon: 'ti-users',            label: 'Customers', min: 'bronze' },
  { path: '/items',     icon: 'ti-package',          label: 'Items',     min: 'bronze' },
  { path: '/purchases', icon: 'ti-shopping-cart',    label: 'Purchases', min: 'bronze' },
  { path: '/calendar',  icon: 'ti-calendar',         label: 'Calendar',  min: 'bronze' },
  { path: '/reports',   icon: 'ti-receipt-tax',      label: 'VAT & Reports', min: 'bronze' },
  { path: '/settings',  icon: 'ti-settings',         label: 'Settings',  min: 'bronze' },
]

const TIER_STYLE = {
  bronze: { bg: 'rgba(180,100,30,0.18)', color: '#cd7f32', border: 'rgba(180,100,30,0.3)', icon: 'ti-award' },
  silver: { bg: 'rgba(160,160,160,0.15)', color: '#c0c0c0', border: 'rgba(160,160,160,0.3)', icon: 'ti-medal' },
  gold:   { bg: 'rgba(245,200,66,0.12)',  color: '#f5c842', border: 'rgba(245,200,66,0.3)',  icon: 'ti-crown' },
  admin:  { bg: 'rgba(167,139,250,0.1)',  color: '#a78bfa', border: 'rgba(167,139,250,0.3)', icon: 'ti-shield-lock' },
}

// Sidebar palette per theme
function sidebarPalette(isDark) {
  return isDark ? {
    bg: '#14121a',
    border: 'rgba(255,255,255,0.06)',
    border2: 'rgba(255,255,255,0.08)',
    text: '#f8f7fa',
    text2: '#9d99a8',
    text3: '#5c586a',
    hover: '#1e1b26',
    active: '#1e1b26',
  } : {
    bg: '#ffffff',
    border: 'rgba(0,0,0,0.08)',
    border2: 'rgba(0,0,0,0.1)',
    text: '#1a1820',
    text2: '#5c586a',
    text3: '#9d99a8',
    hover: '#f3f1f6',
    active: '#f0eef5',
  }
}

export default function Sidebar({ onNavigate, isMobile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, tier, isAdmin, logout, settings, theme, toggleTheme } = useStore()

  const isDark = theme !== 'light'
  const P = sidebarPalette(isDark)
  const ts = TIER_STYLE[tier] || TIER_STYLE.bronze

  const handleNav = (item) => {
    const locked = TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(item.min)
    if (locked) { alert('Upgrade your plan to access this feature.'); return }
    navigate(item.path)
    if (onNavigate) onNavigate()
  }

  return (
    <div style={{
      width: '230px',
      background: P.bg,
      borderRight: `1px solid ${P.border}`,
      display: 'flex',
      flexDirection: 'column',
      height: isMobile ? 'calc(100vh - 56px)' : '100vh',
      fontFamily: "'Space Grotesk', sans-serif",
      transition: 'background .2s, border-color .2s',
    }}>
      {/* Logo — hidden on mobile (shown in app header) */}
      {!isMobile && (
        <div style={{ padding: '18px 16px 14px', borderBottom: `1px solid ${P.border}` }}>
          <div style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.3px', color: P.text }}>
            Alzaro<span style={{ color: '#e53935' }}>GarageOps</span>
          </div>
          <div style={{ fontSize: '10px', color: P.text3, fontFamily: 'monospace', marginTop: '4px', letterSpacing: '0.3px' }}>
            Garage management pro
          </div>
        </div>
      )}

      {/* Garage info + tier */}
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${P.border}` }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: P.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {settings?.name || user?.name || 'Your Garage'}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '3px 9px', borderRadius: '20px',
          fontSize: '10px', fontWeight: 500, fontFamily: 'monospace',
          background: ts.bg, color: ts.color, border: `1px solid ${ts.border}`,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          <i className={`ti ${ts.icon}`} style={{ fontSize: '10px' }} aria-hidden="true" />
          {tier}
        </span>
      </div>

      {/* Search */}
      {!isAdmin && (
        <div style={{ padding: '10px 12px' }}>
          <GlobalSearch showInSidebar placeholder="Search..." onResultClick={() => { if (onNavigate) onNavigate() }} />
        </div>
      )}

      {/* Nav */}
      <div style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
        {isAdmin ? (
          <>
            <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1px', color: P.text3, padding: '12px 16px 6px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
              Platform
            </div>
            <NavItem
              icon="ti-crown"
              label="Licence manager"
              active={location.pathname === '/admin'}
              onClick={() => { navigate('/admin'); if (onNavigate) onNavigate() }}
              P={P}
            />
          </>
        ) : (
          NAV.map(item => {
            const locked = TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(item.min)
            return (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                locked={locked}
                active={location.pathname === item.path}
                onClick={() => handleNav(item)}
                P={P}
              />
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${P.border}` }}>
        {/* Light / Dark mode toggle (above Sign out — PropOps style) */}
        <button
          onClick={() => toggleTheme()}
          style={{
            width: '100%',
            background: 'transparent',
            border: `1px solid ${P.border2}`,
            borderRadius: '6px',
            padding: '7px',
            fontSize: '11px',
            color: P.text2,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'inherit',
            marginBottom: '8px',
            transition: 'background .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = P.hover }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i
            className={`ti ${isDark ? 'ti-sun' : 'ti-moon'}`}
            style={{ fontSize: '13px', color: isDark ? '#f5c842' : '#a78bfa' }}
            aria-hidden="true"
          />
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>

        <div style={{ fontSize: '10px', color: P.text3, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button onClick={() => logout()} style={{
          width: '100%',
          background: 'transparent',
          border: `1px solid ${P.border2}`,
          borderRadius: '6px',
          padding: '7px',
          fontSize: '11px',
          color: P.text2,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          fontFamily: 'inherit',
        }}>
          <i className="ti ti-logout" aria-hidden="true" /> Sign out
        </button>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, locked, onClick, P }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 14px',
      margin: '2px 8px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: active ? 500 : 400,
      cursor: 'pointer',
      transition: 'all .12s',
      color: active ? P.text : P.text2,
      background: active ? P.active : 'transparent',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = P.hover }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <i className={`ti ${icon}`} style={{
        fontSize: '16px',
        width: '18px',
        textAlign: 'center',
        color: active ? '#e53935' : P.text2,
      }} aria-hidden="true" />
      <span style={{ flex: 1 }}>{label}</span>
      {locked && <i className="ti ti-lock" style={{ fontSize: '11px', opacity: 0.5 }} aria-hidden="true" />}
    </div>
  )
}
