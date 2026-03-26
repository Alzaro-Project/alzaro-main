import { useNavigate, useLocation } from 'react-router-dom'
import { useStore, TIER_ORDER } from '../store/useStore'
import GlobalSearch from './GlobalSearch'

const NAV = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard', min: 'bronze' },
  { path: '/invoices', icon: '📄', label: 'Invoices', min: 'bronze' },
  { path: '/inventory', icon: '⚙️', label: 'Inventory', min: 'bronze' },
  { path: '/purchases', icon: '📦', label: 'Purchases', min: 'bronze' },
  { path: '/customers', icon: '👥', label: 'Customers', min: 'bronze' },
  { path: '/reports', icon: '📑', label: 'Reports', min: 'bronze' },
  { path: '/vat', icon: '📈', label: 'VAT Report', min: 'silver' },
  { path: '/settings', icon: '🔧', label: 'Settings', min: 'bronze' },
]

const TIER_LABELS = { bronze: '🥉 Bronze', silver: '🥈 Silver', gold: '🥇 Gold', admin: '👑 Admin' }
const TIER_CLASSES = {
  bronze: { bg: 'rgba(180,100,30,0.2)', color: '#cd7f32', border: 'rgba(180,100,30,0.3)' },
  silver: { bg: 'rgba(160,160,160,0.15)', color: '#c0c0c0', border: 'rgba(160,160,160,0.3)' },
  gold: { bg: 'rgba(245,200,66,0.12)', color: '#f5c842', border: 'rgba(245,200,66,0.3)' },
  admin: { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
}

export default function Sidebar({ onNavigate, isMobile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, tier, isAdmin, logout, settings } = useStore()

  const tierStyle = TIER_CLASSES[tier] || TIER_CLASSES.bronze

  const handleNav = (item) => {
    const locked = TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(item.min)
    if (locked) { alert('Upgrade your plan to access this feature.'); return }
    navigate(item.path)
    if (onNavigate) onNavigate()
  }

  const handleAdminNav = () => {
    navigate('/admin')
    if (onNavigate) onNavigate()
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div style={{
      width: '230px', 
      background: 'var(--surface)', 
      borderRight: '1px solid var(--border)',
      display: 'flex', 
      flexDirection: 'column', 
      height: isMobile ? 'calc(100vh - 56px)' : '100vh',
    }}>
      {/* Logo - hidden on mobile (shown in header) */}
      {!isMobile && (
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '21px', fontWeight: 800 }}>
            Alzaro<span style={{ color: 'var(--accent)' }}>TyreOps</span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>
            Tyre Management Pro
          </div>
        </div>
      )}

      {/* Garage Info */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
          {settings?.name || user?.name || 'Your Garage'}
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px',
          borderRadius: '20px', fontSize: '11px', fontWeight: 700, fontFamily: 'DM Mono, monospace',
          background: tierStyle.bg, color: tierStyle.color,
          border: `1px solid ${tierStyle.border}`,
          textTransform: 'uppercase',
        }}>
          {tier}
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {/* Global Search */}
        {!isAdmin && (
          <div style={{ padding: '0 12px 12px' }}>
            <GlobalSearch 
              showInSidebar 
              placeholder="Search..."
              onResultClick={() => { if (onNavigate) onNavigate() }}
            />
          </div>
        )}
        
        {isAdmin ? (
          <>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', color: 'var(--text3)', padding: '10px 16px 5px', textTransform: 'uppercase' }}>Platform</div>
            <NavItem icon="👑" label="Licence Manager" active={location.pathname === '/admin'} onClick={handleAdminNav} />
          </>
        ) : (
          <>
            {NAV.map(item => {
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
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user?.email}
        </div>
        <button onClick={handleLogout} style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: 'none', 
          color: 'var(--text2)', 
          fontSize: '12px', 
          padding: '8px 12px',
          borderRadius: '6px', 
          border: '1px solid var(--border)', 
          cursor: 'pointer',
        }}>
          🚪 Sign Out
        </button>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, locked, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', 
      alignItems: 'center', 
      gap: '10px', 
      padding: '10px 16px',
      margin: '2px 8px',
      borderRadius: '8px',
      fontSize: '13px', 
      fontWeight: active ? 600 : 500, 
      cursor: 'pointer', 
      transition: 'all .12s',
      color: active ? 'var(--text)' : 'var(--text2)',
      background: active ? 'var(--surface3)' : 'transparent',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--surface2)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent' } }}
    >
      <span style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {locked && <span style={{ fontSize: '10px', opacity: .5 }}>🔒</span>}
    </div>
  )
}
