import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import Sidebar from './components/Sidebar'
import TrialGuard from './components/TrialGuard'
import Dashboard from './pages/Dashboard'
import Invoices from "./pages/Invoices"
import Customers from './pages/Customers'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import ForgotPassword from './pages/ForgotPassword'

// Mobile breakpoint
const MOBILE_BREAKPOINT = 768

function AppLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT
      setIsMobile(mobile)
      if (!mobile) setSidebarOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Close sidebar when route changes on mobile
  const closeSidebar = () => {
    if (isMobile) setSidebarOpen(false)
  }

  return (
    <TrialGuard>
      {/* Mobile Header */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '56px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          zIndex: 400,
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
              color: 'var(--text)',
            }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '20px', fontWeight: 800 }}>
            Alzaro<span style={{ color: 'var(--accent)' }}>GarageOps</span>
          </div>
          <div style={{ width: '40px' }} /> {/* Spacer for balance */}
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 450,
          }}
        />
      )}

      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar - fixed on desktop, slide-in on mobile */}
        <div style={{
          position: 'fixed',
          top: isMobile ? '56px' : 0,
          left: 0,
          bottom: 0,
          width: '230px',
          transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
          transition: 'transform 0.25s ease',
          zIndex: isMobile ? 500 : 100,
        }}>
          <Sidebar onNavigate={closeSidebar} isMobile={isMobile} />
        </div>

        {/* Main Content */}
        <div style={{
          marginLeft: isMobile ? 0 : '230px',
          marginTop: isMobile ? '56px' : 0,
          flex: 1,
          padding: isMobile ? '16px' : '26px 30px',
          minWidth: 0,
          overflowX: 'hidden',
        }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </div>
      </div>

      {/* Global mobile styles */}
      <style>{`
        @media (max-width: ${MOBILE_BREAKPOINT}px) {
          /* Make tables scrollable */
          table { display: block; overflow-x: auto; white-space: nowrap; }
          
          /* Stack stat cards */
          .stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          
          /* Adjust modals */
          .modal-content { width: 95vw !important; max-height: 85vh !important; }
          
          /* Stack form grids */
          .form-grid-2 { grid-template-columns: 1fr !important; }
          
          /* Adjust page headers */
          .page-header { flex-direction: column; align-items: flex-start !important; gap: 12px; }
          .page-header > div:last-child { width: 100%; display: flex; flex-wrap: wrap; gap: 8px; }
          
          /* Adjust buttons on mobile */
          button, .btn { font-size: 12px !important; padding: 8px 12px !important; }
          
          /* Card padding */
          .card { padding: 12px !important; }
          
          /* Tab navigation scrollable */
          .tab-nav { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }
      `}</style>
    </TrialGuard>
  )
}

export default function App() {
  const user = useStore(s => s.user)

  return (
    <BrowserRouter basename="/garageops">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/*" element={user ? <AppLayout /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}
