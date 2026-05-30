/* ServiceOps navigation — product-specific.
   `min` is the lowest tier that can access the page. */
export const NAV = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard',  min: 'starter' },
  { path: '/jobs',      icon: '🛠️', label: 'Jobs',       min: 'starter' },
  { path: '/quotes',    icon: '📝', label: 'Quotes',     min: 'starter' },
  { path: '/invoices',  icon: '📄', label: 'Invoices',   min: 'starter' },
  { path: '/customers', icon: '👥', label: 'Customers',  min: 'starter' },
  { path: '/schedule',  icon: '📅', label: 'Schedule',   min: 'pro' },
  { path: '/settings',  icon: '🔧', label: 'Settings',   min: 'starter' },
]
