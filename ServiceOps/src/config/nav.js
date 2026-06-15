/* ServiceOps navigation — product-specific.
   `min` is the lowest tier that can access the page. */
export const NAV = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard',  min: 'bronze' },
  { path: '/jobs',      icon: '🛠️', label: 'Jobs',       min: 'bronze' },
  { path: '/quotes',    icon: '📝', label: 'Quotes',     min: 'bronze' },
  { path: '/invoices',  icon: '📄', label: 'Invoices',   min: 'bronze' },
  { path: '/customers', icon: '👥', label: 'Customers',  min: 'bronze' },
  { path: '/schedule',  icon: '📅', label: 'Schedule',   min: 'silver' },
  { path: '/settings',  icon: '🔧', label: 'Settings',   min: 'bronze' },
]
