import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { PRODUCT } from './config/product'
import Sidebar from './components/Sidebar'
import TrialGuard from './components/TrialGuard'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import { Jobs, Quotes, Invoices, Customers, Schedule, Settings } from './pages'

const MOBILE_BREAKPOINT = 768

function initTheme() {
  const saved = localStorage.getItem('alzaro-theme') || 'light'
  document.documentElement.setAttribute('data-theme', saved)
}
initTheme()

function AppLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onStorage = () => forceUpdate(n => n + 1)
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const closeSidebar = () => { if (isMobile) setSidebarOpen(false) }

  return (
    <TrialGuard>
      {isMobile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '56px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 400 }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '8px', color: 'var(--text)' }}>{sidebarOpen ? '✕' : '☰'}</button>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800 }}>Alzaro<span style={{ color: 'var(--accent)' }}>{PRODUCT.name.replace('Alzaro', '')}</span></div>
          <div style={{ width: '40px' }} />
        </div>
      )}
      {isMobile && sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 450 }} />}

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <div style={{ position: 'fixed', top: isMobile ? '56px' : 0, left: 0, bottom: 0, width: '230px', transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)', transition: 'transform 0.25s ease', zIndex: isMobile ? 500 : 100 }}>
          <Sidebar onNavigate={closeSidebar} isMobile={isMobile} />
        </div>
        <div style={{ marginLeft: isMobile ? 0 : '230px', marginTop: isMobile ? '56px' : 0, flex: 1, padding: isMobile ? '16px' : '26px 30px', minWidth: 0, overflowX: 'hidden' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/quotes" element={<Quotes />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </div>

      <style>{`
        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          table { display: block; overflow-x: auto; white-space: nowrap; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </TrialGuard>
  )
}

export default function App() {
  const user = useStore(s => s.user)
  const isAdmin = useStore(s => s.isAdmin)
  const ready = useStore(s => s.ready)
  const init = useStore(s => s.init)

  useEffect(() => { init() }, [init])

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text2)', fontSize: '14px' }}>⏳ Loading…</div>
      </div>
    )
  }

  return (
    <BrowserRouter basename={PRODUCT.basename}>
      <Routes>
        <Route path="/login" element={(user) ? <Navigate to={isAdmin ? '/admin' : '/dashboard'} /> : <Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/*" element={user ? <AppLayout /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}
