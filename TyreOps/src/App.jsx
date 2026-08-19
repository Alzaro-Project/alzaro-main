import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import StaffRouteGuard from './components/StaffRouteGuard'
import { supabase, SUPPORT_MODE } from './lib/supabase'
import Support from './pages/Support'
import SupportBanner from './components/SupportBanner'
import Sidebar from './components/Sidebar'
import TrialGuard from './components/TrialGuard'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Invoices from "./pages/Invoices"
import Inventory from './pages/Inventory'
import Purchases from './pages/Purchases'
import Customers from './pages/Customers'
import FollowUps from './pages/FollowUps'
import VATReport from './pages/VATReport'
import Settings from './pages/Settings'
import RecentlyDeleted from './pages/RecentlyDeleted'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'

const MOBILE_BREAKPOINT = 768

// Apply saved theme on load
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
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Re-render sidebar when theme toggles so the button label updates
  useEffect(() => {
    const handleStorage = () => forceUpdate(n => n + 1)
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const closeSidebar = () => { if (isMobile) setSidebarOpen(false) }

  return (
    <TrialGuard>
      {/* Bounces staff off pages the owner hasn't ticked (typed URLs included) */}
      <StaffRouteGuard />
      {isMobile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px', zIndex: 400,
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: '8px', color: 'var(--text)' }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800 }}>
            Alzaro<span style={{ color: 'var(--accent)' }}>TyreOps</span>
          </div>
          <div style={{ width: '40px' }} />
        </div>
      )}

      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 450 }} />
      )}

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <div style={{
          position: 'fixed', top: isMobile ? '56px' : 0, left: 0, bottom: 0, width: '230px',
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
          transition: 'transform 0.25s ease', zIndex: isMobile ? 500 : 100,
        }}>
          <Sidebar onNavigate={closeSidebar} isMobile={isMobile} />
        </div>

        <div style={{
          marginLeft: isMobile ? 0 : '230px', marginTop: isMobile ? '56px' : 0,
          flex: 1, padding: isMobile ? '16px' : '26px 30px', minWidth: 0, overflowX: 'hidden',
        }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/follow-ups" element={<FollowUps />} />
            <Route path="/vat" element={<VATReport />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/recently-deleted" element={<RecentlyDeleted />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </div>
      </div>

      <style>{`
        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          table { display: block; overflow-x: auto; white-space: nowrap; }
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .modal-content { width: 95vw !important; max-height: 85vh !important; }
          .form-grid-2 { grid-template-columns: 1fr !important; }
          .page-header { flex-direction: column; align-items: flex-start !important; gap: 12px; }
          .page-header > div:last-child { width: 100%; display: flex; flex-wrap: wrap; gap: 8px; }
          button, .btn { font-size: 12px !important; padding: 8px 12px !important; }
          .card { padding: 12px !important; }
          .tab-nav { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }
      `}</style>
    </TrialGuard>
  )
}


// Renders in place of the login redirect when a support tab loads. The tab has
// a valid Supabase session (redeemed by pages/Support.jsx) but the zustand
// store is empty, so seed it from the session and let the normal gate take
// over once `user` is set.
function SupportBootstrap() {
  const login = useStore(s => s.login)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email
      if (email) login(email)
      else setFailed(true)
    })
  }, [login])
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', color: 'var(--text, #444)' }}>
      {failed
        ? 'This support session has expired — start a new one from the platform admin.'
        : 'Opening the account…'}
    </div>
  )
}

export default function App() {
  const user = useStore(s => s.user)
  const loadData = useStore(s => s.loadData)

  // On page load/refresh: if a user session was restored from localStorage,
  // re-fetch their data from Supabase (customers, inventory, invoices, etc.)
  useEffect(() => {
    if (user?.email) {
      loadData(user.email)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter basename="/tyreops">
        {/* Renders only inside an admin support session; null otherwise. */}
        <SupportBanner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/support" element={<Support />} />
          {/* In a support tab the store starts empty — bootstrap it from the
              session instead of bouncing to the login screen. */}
          <Route path="/*" element={user ? <AppLayout /> : SUPPORT_MODE ? <SupportBootstrap /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
