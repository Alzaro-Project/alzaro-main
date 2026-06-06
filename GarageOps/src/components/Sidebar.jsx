import { useNavigate, useLocation } from 'react-router-dom'
import { useStore, TIER_ORDER } from '../store/useStore'
import GlobalSearch from './GlobalSearch'

// ============================================================
// Sidebar — GarageOps v2
// ------------------------------------------------------------
// Colours come from CSS variables (see styles/theme.css), so the
// whole component reflips when the store sets data-theme on <html>.
// Footer has a Light/Dark toggle above Sign out (PropOps style).
// ============================================================

const NAV = [
  { path: '/dashboard', icon: 'ti-layout-dashboard', label: 'Dashboard', min: 'bronze' },
  { path: '/invoices',  icon: 'ti-file-text',        label: 'Invoices',  min: 'bronze' },
  { path: '/customers', icon: 'ti-users',            label: 'Customers', min: 'bronze' },
  { path: '/items',     icon: 'ti-package',          label: 'Items',     min: 'bronze' },
  { path: '/purchases', icon: 'ti-shopping-cart',    label: 'Purchases', min: 'bronze' },
  { path: '/calendar',  icon: 'ti-calendar',         label: 'Calendar',  min: 'bronze' },
  { path: '/reports',   icon: 'ti-receipt-tax',      label: 'VAT & Reports', min: 'silver' },
  { path: '/settings',  icon: 'ti-settings',         label: 'Settings',  min: 'bronze' },
]

const TIER_STYLE = {
  bronze: { bg: 'rgba(180,100,30,0.18)', color: '#cd7f32', border: 'rgba(180,100,30,0.3)', icon: 'ti-award' },
  silver: { bg: 'rgba(160,160,160,0.15)', color: '#c0c0c0', border: 'rgba(160,160,160,0.3)', icon: 'ti-medal' },
  gold:   { bg: 'rgba(245,200,66,0.12)',  color: '#f5c842', border: 'rgba(245,200,66,0.3)',  icon: 'ti-crown' },
  admin:  { bg: 'rgba(167,139,250,0.1)',  color: '#a78bfa', border: 'rgba(167,139,250,0.3)', icon: 'ti-shield-lock' },
}

export default function Sidebar({ onNavigate, isMobile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, tier, isAdmin, logout, settings, theme, toggleTheme } = useStore()

  const isDark = theme !== 'light'
  const ts = TIER_STYLE[tier] || TIER_STYLE.bronze

  const handleNav = (item) => {
    // Always navigate — if user lacks the required tier, the destination page's
    // <TierGate> wrapper will show the upgrade screen. Much nicer than a blocking alert.
    navigate(item.path)
    if (onNavigate) onNavigate()
  }

  return (
    <div style={{
      width: '230px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      height: isMobile ? 'calc(100vh - 56px)' : '100vh',
      fontFamily: "'Space Grotesk', sans-serif",
      transition: 'var(--theme-transition)',
    }}>
      {/* Logo — hidden on mobile (shown in app header) */}
      {!isMobile && (
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '19px', fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text)' }}>
            Alzaro<span style={{ color: 'var(--red)' }}>GarageOps</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'monospace', marginTop: '4px', letterSpacing: '0.3px' }}>
            Garage management pro
          </div>
        </div>
      )}

      {/* Garage info + tier */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <div style={{ fontSize: '9px', fontWeight: 500, letterSpacing: '1px', color: 'var(--text3)', padding: '12px 16px 6px', textTransform: 'uppercase', fontFamily: 'monospace' }}>
              Platform
            </div>
            <NavItem
              icon="ti-crown"
              label="Licence manager"
              active={location.pathname === '/admin'}
              onClick={() => { navigate('/admin'); if (onNavigate) onNavigate() }}
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
              />
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        {/* Light / Dark mode toggle (above Sign out — PropOps style) */}
        <button
          onClick={() => toggleTheme()}
          className="go-footer-btn"
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--border2)',
            borderRadius: '6px',
            padding: '7px',
            fontSize: '11px',
            color: 'var(--text2)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontFamily: 'inherit',
            marginBottom: '8px',
          }}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <i
            className={`ti ${isDark ? 'ti-sun' : 'ti-moon'}`}
            style={{ fontSize: '13px', color: isDark ? '#f5c842' : '#7c3aed' }}
            aria-hidden="true"
          />
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>

        <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button onClick={() => logout()} className="go-footer-btn" style={{
          width: '100%',
          background: 'transparent',
          border: '1px solid var(--border2)',
          borderRadius: '6px',
          padding: '7px',
          fontSize: '11px',
          color: 'var(--text2)',
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

      {/* Hover styles via CSS so they work with variables */}
      <style>{`
        .go-footer-btn:hover { background: var(--hover) !important; }
        .go-nav-item:hover { background: var(--hover); }
      `}</style>
    </div>
  )
}

function NavItem({ icon, label, active, locked, onClick }) {
  return (
    <div onClick={onClick} className={active ? '' : 'go-nav-item'} style={{
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
      color: active ? 'var(--text)' : 'var(--text2)',
      background: active ? 'var(--active)' : 'transparent',
    }}>
      <i className={`ti ${icon}`} style={{
        fontSize: '16px',
        width: '18px',
        textAlign: 'center',
        color: active ? 'var(--red)' : 'var(--text2)',
      }} aria-hidden="true" />
      <span style={{ flex: 1 }}>{label}</span>
      {locked && <i className="ti ti-lock" style={{ fontSize: '11px', opacity: 0.5 }} aria-hidden="true" />}
    </div>
  )
}
