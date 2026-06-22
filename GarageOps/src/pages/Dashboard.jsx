import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, TIER_ORDER } from '../store/useStore'
import WelcomeBanner from '../components/WelcomeBanner'

// ============================================================
// Dashboard — GarageOps v2
// ------------------------------------------------------------
// Colours come from CSS variables (see styles/theme.css). The store
// sets data-theme on <html>; this whole page reflips automatically.
// Calendar days are clickable → jump to /calendar on that date.
// ============================================================

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: '6months', label: '6 Months' },
  { key: 'year', label: 'This Year' },
]

// ---------- HELPERS ----------
function money(n) { return `£${(Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function invoiceTotal(inv) {
  return (inv.lines || []).reduce((sum, l) => {
    const lineTotal = (l.qty || 0) * (l.unit || 0)
    const vat = l.lineType === 'used' && l.marginScheme
      ? (l.qty || 0) * ((l.unit || 0) - (l.cost || 0)) * 0.2
      : (inv.vatScheme === 'standard' ? lineTotal * 0.2 : 0)
    return sum + lineTotal + vat
  }, 0)
}

// Inclusive period range [startDate, endDate]
function periodRange(period, now = new Date()) {
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const end = new Date(today); end.setHours(23, 59, 59, 999)
  if (period === 'today') return [today, end]
  if (period === 'week') { const s = new Date(today); s.setDate(today.getDate() - 6); return [s, end] }
  if (period === 'month') { const s = new Date(today.getFullYear(), today.getMonth(), 1); return [s, end] }
  if (period === 'quarter') { const q = Math.floor(today.getMonth() / 3); const s = new Date(today.getFullYear(), q * 3, 1); return [s, end] }
  if (period === '6months') { const s = new Date(today); s.setMonth(today.getMonth() - 6); return [s, end] }
  if (period === 'year') { const s = new Date(today.getFullYear(), 0, 1); return [s, end] }
  return [today, end]
}

function inRange(date, [start, end]) {
  if (!date) return false
  const d = new Date(date)
  return d >= start && d <= end
}

// ---------- STYLES (use CSS variables) ----------
const btnPrimary = {
  background: 'var(--red)', color: '#fff', border: 'none',
  padding: '11px 16px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const btnSecondary = {
  background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border2)',
  padding: '11px 14px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const searchBox = {
  flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '8px',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  padding: '10px 13px', borderRadius: '10px',
}
const tileSub = { fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }
const toggleBtn = (on) => ({
  padding: '4px 8px', fontSize: '10px',
  color: on ? 'var(--text)' : 'var(--text2)',
  background: on ? 'var(--surface3)' : 'transparent',
  border: 'none', borderRadius: '4px',
  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
})
const calNav = {
  width: '24px', height: '24px',
  background: 'var(--surface2)', border: 'none',
  color: 'var(--text2)', borderRadius: '5px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
}
const iconBtn = {
  width: '26px', height: '26px',
  background: 'var(--surface2)', border: 'none',
  borderRadius: '5px', color: 'var(--text2)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '12px', textDecoration: 'none',
}
const linkBtn = {
  background: 'none', border: 'none',
  color: 'var(--red)', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
}

// ============================================================
// ANIMATED CARDS (ported from TyreOps) — 3D tilt-follow, hover glow,
// click-through arrow hint. Pass `onClick` to make a card navigate.
// ============================================================
function DashCard({ label, value, delta, color = 'var(--text)', onClick, hint, index = 0, children }) {
  const ref = useRef(null)
  const [transform, setTransform] = useState('')
  const [hover, setHover] = useState(false)

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    setTransform(`perspective(700px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px) scale(1.02)`)
  }
  const onLeave = () => { setTransform(''); setHover(false) }

  return (
    <div
      ref={ref}
      className="dash-card"
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px',
        minHeight: '100px', cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden',
        transform, animationDelay: `${index * 60}ms`,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: hover ? 1 : 0, transition: 'opacity .25s',
        background: `radial-gradient(420px circle at 30% 0%, color-mix(in srgb, ${color} 14%, transparent), transparent 70%)`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'monospace' }}>{label}</div>
        {onClick && (
          <div style={{
            fontSize: '13px', color, transition: 'transform .2s, opacity .2s',
            opacity: hover ? 1 : 0.35, transform: hover ? 'translateX(2px)' : 'none',
          }}>→</div>
        )}
      </div>
      {children ? children : (<>
        <div style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 700, marginTop: '5px', marginBottom: '3px', color }}>{value}</div>
        {delta && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{hover && hint ? hint : delta}</div>}
      </>)}
    </div>
  )
}

function TiltPanel({ title, accent = 'var(--text2)', onClick, children, index = 0, right }) {
  const ref = useRef(null)
  const [transform, setTransform] = useState('')
  const [hover, setHover] = useState(false)

  const onMove = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    setTransform(`perspective(900px) rotateX(${(-y * 2.5).toFixed(2)}deg) rotateY(${(x * 3.5).toFixed(2)}deg) translateY(-3px)`)
  }
  const onLeave = () => { setTransform(''); setHover(false) }

  return (
    <div
      ref={ref}
      className="dash-card"
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px',
        cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden',
        transform, animationDelay: `${index * 60}ms`,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: hover ? 1 : 0, transition: 'opacity .25s',
        background: `radial-gradient(560px circle at 25% 0%, color-mix(in srgb, ${accent} 10%, transparent), transparent 70%)`,
      }} />
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'monospace' }}>{title}</div>
          {right ? right : (onClick && (
            <div style={{
              fontSize: '13px', color: accent, transition: 'transform .2s, opacity .2s',
              opacity: hover ? 1 : 0.35, transform: hover ? 'translateX(2px)' : 'none',
            }}>→</div>
          ))}
        </div>
      )}
      {children}
    </div>
  )
}

// ============================================================
// MAIN
// ============================================================
export default function Dashboard() {
  const navigate = useNavigate()
  const { invoices, customers, motReminders, vehicles, dashPeriod, setDashPeriod, tier } = useStore()
  const hasSilver = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('silver')
  const hasGold = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('gold')
  const period = dashPeriod || 'today'
  const [salesType, setSalesType] = useState('paid') // 'paid' | 'invoiced'
  const [search, setSearch] = useState('')

  // -------- SALES TILE --------
  const sales = useMemo(() => {
    const range = periodRange(period)
    let total = 0, count = 0
    invoices.forEach(inv => {
      if (salesType === 'paid') {
        if (inv.status === 'paid' && inRange(inv.paidAt || inv.date, range)) {
          total += invoiceTotal(inv); count++
        }
      } else {
        if (inv.status !== 'draft' && inRange(inv.date, range)) {
          total += invoiceTotal(inv); count++
        }
      }
    })
    return { total, count }
  }, [invoices, period, salesType])

  // -------- OVERDUE TILE --------
  const overdue = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const list = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft' && i.due && new Date(i.due) < today)
    return { count: list.length, total: list.reduce((s, i) => s + invoiceTotal(i), 0) }
  }, [invoices])

  // -------- MOTs DUE SOON TILE + LIST --------
  const motsDueSoon = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const limit = new Date(today); limit.setDate(today.getDate() + 30)
    const out = []
    ;(motReminders || []).forEach(r => {
      const d = r.mot_due ? new Date(r.mot_due) : null
      if (d && d <= limit) {
        out.push({ id: r.id, name: r.customer_name || '—', reg: r.reg || '—', vehicle: r.vehicle || '', date: d, phone: r.phone || '' })
      }
    })
    ;(vehicles || []).forEach(v => {
      if (out.find(x => x.reg === v.reg)) return
      const d = v.mot_due ? new Date(v.mot_due) : null
      if (d && d <= limit) {
        const cust = (customers || []).find(c => c.id === v.customer_id) || {}
        out.push({ id: v.id, name: cust.name || '—', reg: v.reg || '—', vehicle: [v.make, v.model].filter(Boolean).join(' '), date: d, phone: cust.phone || '' })
      }
    })
    return out.sort((a, b) => a.date - b.date)
  }, [motReminders, vehicles, customers])

  // -------- BOTTOM TILES --------
  const unpaidSent = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const list = invoices.filter(i => i.status === 'sent' && (!i.due || new Date(i.due) >= today))
    return { count: list.length, total: list.reduce((s, i) => s + invoiceTotal(i), 0) }
  }, [invoices])

  const avgInvoice = useMemo(() => {
    const range = periodRange('month')
    const monthInv = invoices.filter(i => i.status !== 'draft' && inRange(i.date, range))
    if (!monthInv.length) return 0
    return monthInv.reduce((s, i) => s + invoiceTotal(i), 0) / monthInv.length
  }, [invoices])

  // -------- QUICK SALE --------
  const handleQuickSale = () => {
    const choice = window.confirm(
      'Quick sale — what kind?\n\n' +
      'OK = Walk-in / cash (no customer needed)\n' +
      'Cancel = Pre-filled paid invoice (still pick a customer)'
    )
    if (choice) {
      sessionStorage.setItem('garageops_quick_sale', 'walkin')
    } else {
      sessionStorage.setItem('garageops_quick_sale', 'paid')
    }
    navigate('/invoices')
  }

  // -------- CALENDAR DAY CLICK --------
  // Hands the chosen date to the full Calendar page via sessionStorage,
  // then navigates there. The Calendar page can read
  // sessionStorage.getItem('garageops_calendar_date') on mount.
  const handleCalendarDayClick = (year, month, day) => {
    const picked = new Date(year, month, day)
    const iso = `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, '0')}-${String(picked.getDate()).padStart(2, '0')}`
    sessionStorage.setItem('garageops_calendar_date', iso)
    navigate('/calendar')
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--text)' }}>

      {/* ===== GETTING-STARTED GUIDE (auto-hides when complete or dismissed) ===== */}
      <WelcomeBanner />

      {/* ===== TOP BAR ===== */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/invoices')} style={btnPrimary}>
          <i className="ti ti-plus" aria-hidden="true" /> New invoice
        </button>
        <button onClick={handleQuickSale} style={btnSecondary}>
          <i className="ti ti-bolt" aria-hidden="true" /> Quick sale
        </button>
        <div style={searchBox}>
          <i className="ti ti-search" style={{ color: 'var(--text3)' }} aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers, invoices, car reg..."
            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: '13px', width: '100%' }}
          />
        </div>
      </div>

      {/* ===== PERIOD TABS ===== */}
      <div style={{
        display: 'flex', gap: '4px',
        background: 'var(--surface)', border: '0.5px solid var(--border)',
        padding: '4px', borderRadius: '10px',
        marginBottom: '16px', overflowX: 'auto',
      }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setDashPeriod(p.key)} style={{
            padding: '8px 14px', borderRadius: '7px',
            fontSize: '12px', fontWeight: period === p.key ? 500 : 400,
            color: period === p.key ? 'var(--text)' : 'var(--text2)',
            background: period === p.key ? 'var(--surface2)' : 'transparent',
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>{p.label}</button>
        ))}
      </div>

      {/* ===== TOP 4 TILES ===== */}
      <div className="dash-top4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {/* Sales (has an internal toggle, so use the children slot) */}
        <DashCard label="Sales" index={0} onClick={() => navigate('/invoices')} color="var(--green)">
          <div style={{ display: 'inline-flex', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: '6px', padding: '2px', margin: '6px 0 10px' }}>
            <button onClick={(e) => { e.stopPropagation(); setSalesType('paid') }} style={toggleBtn(salesType === 'paid')}>Money in</button>
            <button onClick={(e) => { e.stopPropagation(); setSalesType('invoiced') }} style={toggleBtn(salesType === 'invoiced')}>Invoiced</button>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 700, color: 'var(--green)' }}>{money(sales.total)}</div>
          <div style={tileSub}>{sales.count} {salesType === 'paid' ? 'paid' : 'invoice'}{sales.count === 1 ? '' : 's'}</div>
        </DashCard>

        {/* Overdue */}
        <DashCard
          label="Overdue invoices" index={1} color="var(--red)"
          value={overdue.count} delta={`${money(overdue.total)} outstanding`}
          hint="View invoices →" onClick={() => navigate('/invoices', { state: { filter: 'overdue' } })}
        />

        {/* MOTs Due Soon */}
        {hasSilver ? (
          <DashCard
            label="MOTs due soon" index={2} color="var(--amber)"
            value={motsDueSoon.length} delta="Next 30 days"
            hint="View customers →" onClick={() => navigate('/customers')}
          />
        ) : (
          <LockedTile label="MOT reminders" requiredTier="silver" onUpgrade={() => navigate('/settings', { state: { tab: 'subscription' } })} />
        )}

        {/* Placeholder */}
        <PlaceholderTile />
      </div>

      {/* ===== MID ROW: P&L + CALENDAR ===== */}
      <div className="dash-mid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        {hasGold ? (
          <RevenueChart invoices={invoices} />
        ) : (
          <LockedTile label="Monthly revenue chart" requiredTier="gold" onUpgrade={() => navigate('/settings', { state: { tab: 'subscription' } })} />
        )}
        <MiniCalendar
          motsDueSoon={motsDueSoon}
          onOpenFull={() => navigate('/calendar')}
          onDayClick={handleCalendarDayClick}
        />
      </div>

      {/* ===== MOTs DUE SOON LIST ===== */}
      {hasSilver && (
        <>
          <SectionLabel>
            MOTs due soon
            <button onClick={() => navigate('/customers')} style={linkBtn}>View all →</button>
          </SectionLabel>
          <MotsList items={motsDueSoon.slice(0, 5)} />
        </>
      )}

      {/* ===== BOTTOM 4 TILES ===== */}
      <div className="dash-bot4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <DashCard
          label="Unpaid sent" index={0} color="var(--blue)"
          value={unpaidSent.count} delta={`${money(unpaidSent.total)} awaiting`}
          hint="View invoices →" onClick={() => navigate('/invoices', { state: { filter: 'sent' } })}
        />
        <DashCard
          label="Avg invoice" index={1}
          value={money(avgInvoice)} delta="This month"
          hint="View invoices →" onClick={() => navigate('/invoices')}
        />
        <DashCard
          label="Total customers" index={2}
          value={customers.length} delta="On the books"
          hint="View customers →" onClick={() => navigate('/customers')}
        />
        <PlaceholderTile />
      </div>

      {/* Responsive + calendar hover */}
      <style>{`
        @media (max-width: 900px) {
          .dash-top4, .dash-bot4 { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-mid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .dash-top4, .dash-bot4 { grid-template-columns: 1fr !important; }
        }
        .go-cal-day:hover { background: var(--surface3) !important; }
      `}</style>
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function LockedTile({ label, requiredTier, onUpgrade }) {
  const tierName = requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)
  return (
    <div
      onClick={onUpgrade}
      style={{
        background: 'var(--surface)',
        border: '0.5px dashed var(--border)',
        borderRadius: '12px', padding: '14px', minHeight: '100px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', textAlign: 'center', gap: '6px',
      }}
      title={`Upgrade to ${tierName} to unlock`}
    >
      <i className="ti ti-lock" style={{ fontSize: '20px', color: 'var(--text3)', opacity: 0.7 }} aria-hidden="true" />
      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text2)' }}>{label}</div>
      <div style={{
        fontSize: '10px', fontFamily: 'monospace', color: 'var(--red)',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Upgrade to {tierName}
      </div>
    </div>
  )
}

function PlaceholderTile() {
  return (
    <div style={{
      background: 'rgba(229,57,53,0.04)',
      border: '0.5px dashed rgba(229,57,53,0.3)',
      borderRadius: '12px', padding: '14px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100px', color: 'var(--text3)',
    }}>
      <i className="ti ti-plus" style={{ fontSize: '20px', color: 'var(--red)', opacity: 0.6, marginBottom: '6px' }} aria-hidden="true" />
      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text3)' }}>Add later</div>
    </div>
  )
}

function RevenueChart({ invoices }) {
  const monthData = useMemo(() => {
    const now = new Date()
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59)
      const name = d.toLocaleDateString('en-GB', { month: 'short' })
      let rev = 0, cost = 0
      invoices.forEach(inv => {
        if (inv.status === 'draft') return
        const id = new Date(inv.date)
        if (id >= d && id <= end) {
          (inv.lines || []).forEach(l => {
            rev += (l.qty || 0) * (l.unit || 0)
            cost += (l.qty || 0) * (l.cost || 0)
          })
        }
      })
      months.push({ name, rev, cost, profit: rev - cost })
    }
    return months
  }, [invoices])

  const max = Math.max(...monthData.map(m => Math.max(m.rev, m.cost)), 1) * 1.1
  const [mounted, setMounted] = useState(false)
  const [hov, setHov] = useState(null)
  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t) }, [])

  const h = (v) => mounted ? `${Math.max((v / max) * 100, v > 0 ? 2 : 0.5)}%` : '0%'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'monospace' }}>Monthly P&amp;L</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: 'var(--red)', borderRadius: '2px', display: 'inline-block' }} />Rev</span>
          <span style={{ fontSize: '10px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: 'var(--text2)', opacity: 0.75, borderRadius: '2px', display: 'inline-block' }} />Cost</span>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        {hov !== null && (
          <div style={{
            position: 'absolute', top: '-6px', left: `${(hov + 0.5) * (100 / 6)}%`, transform: 'translateX(-50%)',
            background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '8px',
            padding: '7px 10px', zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 6px 18px rgba(0,0,0,.3)', fontSize: '11px', fontFamily: 'monospace',
          }}>
            <div style={{ color: 'var(--text2)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '3px' }}>{monthData[hov].name}</div>
            <div style={{ color: 'var(--red)' }}>Rev {money(monthData[hov].rev)}</div>
            <div style={{ color: 'var(--text2)' }}>Cost {money(monthData[hov].cost)}</div>
            <div style={{ color: monthData[hov].profit >= 0 ? 'var(--green)' : 'var(--red)', borderTop: '1px solid var(--border)', marginTop: '3px', paddingTop: '3px' }}>
              P/L {monthData[hov].profit >= 0 ? '+' : '−'}{money(Math.abs(monthData[hov].profit))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', paddingBottom: '20px', position: 'relative' }}>
          {[0.25, 0.5, 0.75].map(g => (
            <div key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: `${20 + g * (140)}px`, borderTop: '1px dashed var(--border)', opacity: 0.5 }} />
          ))}

          {monthData.map((m, i) => (
            <div
              key={i}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                height: '100%', justifyContent: 'flex-end', cursor: 'default',
                opacity: hov === null || hov === i ? 1 : 0.35, transition: 'opacity .15s',
              }}
            >
              <div style={{ width: '100%', display: 'flex', gap: '3px', alignItems: 'flex-end', flex: 1 }}>
                <div style={{
                  flex: 1, borderRadius: '4px 4px 0 0', height: h(m.rev),
                  background: 'linear-gradient(180deg, var(--red), color-mix(in srgb, var(--red) 45%, transparent))',
                  transition: `height .6s cubic-bezier(.2,.8,.3,1) ${i * 70}ms`,
                  boxShadow: hov === i ? '0 0 12px color-mix(in srgb, var(--red) 45%, transparent)' : 'none',
                }} />
                <div style={{
                  flex: 1, borderRadius: '4px 4px 0 0', height: h(m.cost),
                  background: 'linear-gradient(180deg, var(--text2), color-mix(in srgb, var(--text2) 40%, transparent))',
                  opacity: 0.7,
                  transition: `height .6s cubic-bezier(.2,.8,.3,1) ${i * 70 + 40}ms`,
                }} />
              </div>
              <div style={{
                fontSize: '10px', fontFamily: 'monospace',
                color: hov === i ? 'var(--text)' : 'var(--text3)', fontWeight: hov === i ? 700 : 400,
              }}>{m.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniCalendar({ motsDueSoon, onOpenFull, onDayClick }) {
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthName = new Date(view.y, view.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const motDays = useMemo(() => {
    const set = new Set()
    motsDueSoon.forEach(r => {
      if (r.date.getFullYear() === view.y && r.date.getMonth() === view.m) set.add(r.date.getDate())
    })
    return set
  }, [motsDueSoon, view])

  const firstDay = new Date(view.y, view.m, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1 // Mon-first
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const prevDays = new Date(view.y, view.m, 0).getDate()

  const cells = []
  for (let i = offset; i > 0; i--) cells.push({ d: prevDays - i + 1, dim: true })
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = view.y === today.getFullYear() && view.m === today.getMonth() && d === today.getDate()
    cells.push({ d, isToday, hasMot: motDays.has(d) })
  }
  while (cells.length < 42) cells.push({ d: cells.length - daysInMonth - offset + 1, dim: true })

  const nav = (delta) => {
    const nm = view.m + delta
    if (nm < 0) setView({ y: view.y - 1, m: 11 })
    else if (nm > 11) setView({ y: view.y + 1, m: 0 })
    else setView({ y: view.y, m: nm })
  }

  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text)' }}>{monthName}</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => nav(-1)} style={calNav}><i className="ti ti-chevron-left" /></button>
          <button onClick={() => nav(1)} style={calNav}><i className="ti ti-chevron-right" /></button>
          <button onClick={onOpenFull} style={{ ...calNav, width: 'auto', padding: '0 8px', fontSize: '10px', fontFamily: 'monospace' }}>Open</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '4px 0', fontSize: '9px', color: 'var(--text3)', fontFamily: 'monospace' }}>{d}</div>
        ))}
        {cells.map((c, i) => {
          const clickable = !c.dim && onDayClick
          return (
            <div
              key={i}
              className={clickable && !c.isToday ? 'go-cal-day' : ''}
              onClick={clickable ? () => onDayClick(view.y, view.m, c.d) : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick(view.y, view.m, c.d) } } : undefined}
              title={clickable ? 'Open in calendar' : undefined}
              style={{
                position: 'relative',
                textAlign: 'center', padding: '6px 0',
                borderRadius: '4px',
                fontSize: '11px',
                color: c.dim ? 'var(--dim-day)' : (c.isToday ? '#fff' : 'var(--text)'),
                background: c.isToday ? 'var(--red)' : 'transparent',
                fontWeight: c.isToday ? 500 : 400,
                cursor: clickable ? 'pointer' : 'default',
                transition: 'background .12s',
                outline: 'none',
              }}
            >
              {c.d}
              {!c.dim && c.hasMot && !c.isToday && (
                <span style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--amber)' }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MotsList({ items }) {
  if (!items.length) {
    return (
      <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px', marginBottom: '14px' }}>
        No MOTs due in the next 30 days
      </div>
    )
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '4px 0', marginBottom: '14px' }}>
      {items.map(r => {
        const diff = Math.ceil((r.date - today) / (1000 * 60 * 60 * 24))
        const isUrgent = diff <= 7
        const status = diff < 0 ? `Expired ${-diff} day${diff === -1 ? '' : 's'} ago`
          : diff === 0 ? 'Due today'
          : diff === 1 ? 'Due in 1 day'
          : `Due in ${diff} days`
        return (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.9fr 1fr 90px',
            gap: '12px', padding: '12px 18px',
            borderBottom: '0.5px solid var(--border)', alignItems: 'center', fontSize: '12px',
          }}>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{r.name}</span>
            <span style={{ fontFamily: 'monospace', background: 'var(--surface2)', padding: '3px 8px', borderRadius: '5px', color: 'var(--text)', display: 'inline-block', fontSize: '11px', width: 'fit-content' }}>{r.reg}</span>
            <span style={{ color: 'var(--text2)' }}>{r.vehicle || '—'}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 500, color: isUrgent ? 'var(--red)' : 'var(--amber)' }}>{status}</span>
            <span style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
              {r.phone && (
                <>
                  <a href={`tel:${r.phone}`} style={iconBtn} title="Call"><i className="ti ti-phone" /></a>
                  <a href={`https://wa.me/${r.phone.replace(/[^\d]/g, '').replace(/^0/, '44')}`} target="_blank" rel="noopener noreferrer" style={iconBtn} title="WhatsApp"><i className="ti ti-brand-whatsapp" /></a>
                </>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '10px', color: 'var(--text2)',
      textTransform: 'uppercase', letterSpacing: '0.8px',
      fontWeight: 500, marginBottom: '10px', fontFamily: 'monospace',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      {children}
    </div>
  )
}
