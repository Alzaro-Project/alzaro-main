import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

// Order matters: first permitted section becomes the staff landing page.
const ORDER = [
  ['/dashboard', 'dashboard'], ['/invoices', 'invoices'], ['/inventory', 'inventory'],
  ['/purchases', 'purchases'], ['/customers', 'customers'], ['/follow-ups', 'followups'],
  ['/vat', 'vat'],
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
    const allowed = (p, key) => perms[key] === true
    const home = ORDER.find(([, k]) => perms[k] === true)?.[0]

    const blockedSettings = path.startsWith('/settings')
    const blockedDeleted = path.startsWith('/recently-deleted') &&
      !['invoices', 'inventory', 'customers'].some(k => perms[k] === true)
    const entry = ORDER.find(([p]) => path.startsWith(p))
    const blockedSection = entry && !allowed(entry[0], entry[1])

    if (blockedSettings || blockedDeleted || blockedSection) {
      if (home) navigate(home, { replace: true })
    }
  }, [staff, location.pathname, navigate])

  return null
}
