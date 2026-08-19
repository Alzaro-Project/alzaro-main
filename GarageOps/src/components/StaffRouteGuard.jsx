import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

// Order matters: first permitted section becomes the staff landing page.
const ORDER = [
  ['/dashboard', 'dashboard'], ['/invoices', 'invoices'], ['/customers', 'customers'],
  ['/items', 'items'], ['/database', 'database'], ['/purchases', 'purchases'],
  ['/calendar', 'calendar'], ['/reports', 'reports'],
]

// Redirect-only component: renders nothing, but sends a staff login away from
// any page the owner hasn't ticked — including URLs typed by hand. The
// database would return them no rows anyway (RLS); this keeps the UI honest.
export default function StaffRouteGuard() {
  const staff = useStore(s => s.staff)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!staff) return
    const perms = staff.permissions || {}
    const path = location.pathname
    const home = ORDER.find(([, k]) => perms[k] === true)?.[0]

    const blockedSettings = path.startsWith('/settings')
    const entry = ORDER.find(([p]) => path.startsWith(p))
    const blockedSection = entry && perms[entry[1]] !== true

    if (blockedSettings || blockedSection) {
      if (home) navigate(home, { replace: true })
    }
  }, [staff, location.pathname, navigate])

  return null
}
