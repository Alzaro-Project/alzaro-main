import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'

// ============================================================
// Dashboard — GarageOps v2
// ------------------------------------------------------------
// Top bar: New Invoice + Quick Sale + Search
// Period tabs (Today / Week / Month / Quarter / 6 Months / Year)
// Top 4 tiles: Sales (Money In|Invoiced) · Overdue · MOTs Due · placeholder
// Mid row: Monthly revenue chart · Mini calendar
// MOTs Due Soon list
// Bottom 4 tiles: Unpaid Sent · Avg Invoice · Total Customers · placeholder
// ============================================================

// ---------- THEME ----------
const T = {
  bg: '#0c0a0f',
  surface: '#14121a',
  surface2: '#1e1b26',
  surface3: '#282432',
  border: 'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.1)',
  red: '#e53935',
  green: '#4caf50',
  amber: '#ff9800',
  blue: '#60a5fa',
  purple: '#a78bfa',
  text: '#f8f7fa',
  text2: '#9d99a8',
  text3: '#5c586a',
}

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
function shortMoney(n) {
  const v = Number(n) || 0
  if (v >= 1000) return `£${(v / 1000).toFixed(1)}k`
  return `£${v.toFixed(0)}`
}

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

// ============================================================
// MAIN
// ============================================================
export default function Dashboard() {
  const navigate = useNavigate()
  const { invoices, customers, motReminders, vehicles, dashPeriod, setDashPeriod } = useStore()
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
  // Pulls from motReminders first, falls back to vehicles.mot_due
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

  // -------- RECENT INVOICES (kept for the MOTs section table style) --------
  // Note: actual invoice list lives on /invoices — dashboard only shows MOTs list

  // -------- QUICK SALE --------
  const handleQuickSale = () => {
    const choice = window.confirm(
      'Quick sale — what kind?\n\n' +
      'OK = Walk-in / cash (no customer needed)\n' +
      'Cancel = Pre-filled paid invoice (still pick a customer)'
    )
    if (choice) {
      // Walk-in: hand a flag to Invoices via session storage
      sessionStorage.setItem('garageops_quick_sale', 'walkin')
    } else {
      sessionStorage.setItem('garageops_quick_sale', 'paid')
    }
    navigate('/invoices')
  }

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>

      {/* ===== TOP BAR ===== */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/invoices')} style={btnPrimary}>
          <i className="ti ti-plus" aria-hidden="true" /> New invoice
        </button>
        <button onClick={handleQuickSale} style={btnSecondary}>
          <i className="ti ti-bolt" aria-hidden="true" /> Quick sale
        </button>
        <div style={searchBox}>
          <i className="ti ti-search" style={{ color: T.text3 }} aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search customers, invoices, car reg..."
            style={{ background: 'none', border: 'none', outline: 'none', color: T.text, fontFamily: 'inherit', fontSize: '13px', width: '100%' }}
          />
        </div>
      </div>

      {/* ===== PERIOD TABS ===== */}
      <div style={{
        display: 'flex', gap: '4px',
        background: T.surface, border: `0.5px solid ${T.border}`,
        padding: '4px', borderRadius: '10px',
        marginBottom: '16px', overflowX: 'auto',
      }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setDashPeriod(p.key)} style={{
            padding: '8px 14px', borderRadius: '7px',
            fontSize: '12px', fontWeight: period === p.key ? 500 : 400,
            color: period === p.key ? T.text : T.text2,
            background: period === p.key ? T.surface2 : 'transparent',
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}>{p.label}</button>
        ))}
      </div>

      {/* ===== TOP 4 TILES ===== */}
      <div className="dash-top4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {/* Sales */}
        <div style={tile}>
          <div style={tileLbl}>Sales</div>
          <div style={{ display: 'inline-flex', background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '6px', padding: '2px', marginBottom: '10px' }}>
            <button onClick={() => setSalesType('paid')} style={toggleBtn(salesType === 'paid')}>Money in</button>
            <button onClick={() => setSalesType('invoiced')} style={toggleBtn(salesType === 'invoiced')}>Invoiced</button>
          </div>
          <div style={{ ...tileNum, color: T.green }}>{money(sales.total)}</div>
          <div style={tileSub}>{sales.count} {salesType === 'paid' ? 'paid' : 'invoice'}{sales.count === 1 ? '' : 's'}</div>
        </div>

        {/* Overdue */}
        <div style={tile}>
          <div style={tileLbl}>Overdue invoices</div>
          <div style={{ ...tileNum, color: T.red }}>{overdue.count}</div>
          <div style={tileSub}>{money(overdue.total)} outstanding</div>
        </div>

        {/* MOTs Due Soon */}
        <div style={tile}>
          <div style={tileLbl}>MOTs due soon</div>
          <div style={{ ...tileNum, color: T.amber }}>{motsDueSoon.length}</div>
          <div style={tileSub}>Next 30 days</div>
        </div>

        {/* Placeholder */}
        <PlaceholderTile />
      </div>

      {/* ===== MID ROW: P&L + CALENDAR ===== */}
      <div className="dash-mid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
        <RevenueChart invoices={invoices} />
        <MiniCalendar motsDueSoon={motsDueSoon} onOpenFull={() => navigate('/calendar')} />
      </div>

      {/* ===== MOTs DUE SOON LIST ===== */}
      <SectionLabel>
        MOTs due soon
        <button onClick={() => navigate('/customers')} style={linkBtn}>View all →</button>
      </SectionLabel>
      <MotsList items={motsDueSoon.slice(0, 5)} />

      {/* ===== BOTTOM 4 TILES ===== */}
      <div className="dash-bot4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div style={tile}>
          <div style={tileLbl}>Unpaid sent</div>
          <div style={{ ...tileNum, color: T.blue }}>{unpaidSent.count}</div>
          <div style={tileSub}>{money(unpaidSent.total)} awaiting</div>
        </div>
        <div style={tile}>
          <div style={tileLbl}>Avg invoice</div>
          <div style={tileNum}>{money(avgInvoice)}</div>
          <div style={tileSub}>This month</div>
        </div>
        <div style={tile}>
          <div style={tileLbl}>Total customers</div>
          <div style={tileNum}>{customers.length}</div>
          <div style={tileSub}>On the books</div>
        </div>
        <PlaceholderTile />
      </div>

      {/* Responsive breakdown */}
      <style>{`
        @media (max-width: 900px) {
          .dash-top4, .dash-bot4 { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-mid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .dash-top4, .dash-bot4 { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function PlaceholderTile() {
  return (
    <div style={{
      background: 'rgba(229,57,53,0.04)',
      border: `0.5px dashed rgba(229,57,53,0.3)`,
      borderRadius: '12px', padding: '14px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100px', color: T.text3,
    }}>
      <i className="ti ti-plus" style={{ fontSize: '20px', color: T.red, opacity: 0.6, marginBottom: '6px' }} aria-hidden="true" />
      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: T.text3 }}>Add later</div>
    </div>
  )
}

function RevenueChart({ invoices }) {
  // last 6 months
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
      months.push({ name, rev, cost })
    }
    return months
  }, [invoices])

  const max = Math.max(...monthData.map(m => m.rev), 1) * 1.1

  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontWeight: 500, fontSize: '13px' }}>Monthly revenue</div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: T.text2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: T.red, borderRadius: '2px' }} />Revenue
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '8px', height: '8px', background: T.text2, borderRadius: '2px' }} />Cost
          </span>
        </div>
      </div>
      <div style={{ height: '150px', display: 'flex', alignItems: 'flex-end', gap: '10px', padding: '0 4px' }}>
        {monthData.map((m, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%' }}>
            <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', flex: 1, justifyContent: 'center', width: '100%' }}>
              <div title={`Revenue: ${money(m.rev)}`} style={{ width: '10px', borderRadius: '2px 2px 0 0', background: T.red, height: `${(m.rev / max) * 100}%`, minHeight: m.rev > 0 ? '2px' : '0' }} />
              <div title={`Cost: ${money(m.cost)}`} style={{ width: '10px', borderRadius: '2px 2px 0 0', background: T.text2, height: `${(m.cost / max) * 100}%`, minHeight: m.cost > 0 ? '2px' : '0' }} />
            </div>
            <div style={{ fontSize: '9px', color: T.text3, fontFamily: 'monospace' }}>{m.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniCalendar({ motsDueSoon, onOpenFull }) {
  const [view, setView] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monthName = new Date(view.y, view.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  // Days that have an MOT due in the displayed month
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
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ fontWeight: 500, fontSize: '13px' }}>{monthName}</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => nav(-1)} style={calNav}><i className="ti ti-chevron-left" /></button>
          <button onClick={() => nav(1)} style={calNav}><i className="ti ti-chevron-right" /></button>
          <button onClick={onOpenFull} style={{ ...calNav, width: 'auto', padding: '0 8px', fontSize: '10px', fontFamily: 'monospace' }}>Open</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '4px 0', fontSize: '9px', color: T.text3, fontFamily: 'monospace' }}>{d}</div>
        ))}
        {cells.map((c, i) => (
          <div key={i} style={{
            position: 'relative',
            textAlign: 'center', padding: '6px 0',
            borderRadius: '4px',
            fontSize: '11px',
            color: c.dim ? '#3c3845' : (c.isToday ? '#fff' : T.text),
            background: c.isToday ? T.red : 'transparent',
            fontWeight: c.isToday ? 500 : 400,
          }}>
            {c.d}
            {!c.dim && c.hasMot && !c.isToday && (
              <span style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: T.amber }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MotsList({ items }) {
  if (!items.length) {
    return (
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '24px', textAlign: 'center', color: T.text3, fontSize: '13px', marginBottom: '14px' }}>
        No MOTs due in the next 30 days
      </div>
    )
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '4px 0', marginBottom: '14px' }}>
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
            borderBottom: `0.5px solid ${T.border}`, alignItems: 'center', fontSize: '12px',
          }}>
            <span style={{ fontWeight: 500 }}>{r.name}</span>
            <span style={{ fontFamily: 'monospace', background: T.surface2, padding: '3px 8px', borderRadius: '5px', color: T.text, display: 'inline-block', fontSize: '11px', width: 'fit-content' }}>{r.reg}</span>
            <span style={{ color: T.text2 }}>{r.vehicle || '—'}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 500, color: isUrgent ? T.red : T.amber }}>{status}</span>
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
      fontSize: '10px', color: T.text2,
      textTransform: 'uppercase', letterSpacing: '0.8px',
      fontWeight: 500, marginBottom: '10px', fontFamily: 'monospace',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      {children}
    </div>
  )
}

// ============================================================
// STYLES
// ============================================================
const btnPrimary = {
  background: T.red, color: '#fff', border: 'none',
  padding: '11px 16px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const btnSecondary = {
  background: T.surface2, color: T.text, border: `1px solid ${T.border2}`,
  padding: '11px 14px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const searchBox = {
  flex: 1, minWidth: '180px', display: 'flex', alignItems: 'center', gap: '8px',
  background: T.surface2, border: `1px solid ${T.border}`,
  padding: '10px 13px', borderRadius: '10px',
}
const tile = {
  background: T.surface, border: `0.5px solid ${T.border}`,
  borderRadius: '12px', padding: '14px',
  minHeight: '100px',
}
const tileLbl = {
  fontSize: '10px', color: T.text2,
  textTransform: 'uppercase', letterSpacing: '0.8px',
  fontWeight: 500, marginBottom: '8px', fontFamily: 'monospace',
}
const tileNum = {
  fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1,
}
const tileSub = { fontSize: '11px', color: T.text2, marginTop: '4px' }
const toggleBtn = (on) => ({
  padding: '4px 8px', fontSize: '10px',
  color: on ? T.text : T.text2,
  background: on ? T.surface3 : 'transparent',
  border: 'none', borderRadius: '4px',
  cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
})
const calNav = {
  width: '24px', height: '24px',
  background: T.surface2, border: 'none',
  color: T.text2, borderRadius: '5px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '12px',
}
const iconBtn = {
  width: '26px', height: '26px',
  background: T.surface2, border: 'none',
  borderRadius: '5px', color: T.text2, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '12px', textDecoration: 'none',
}
const linkBtn = {
  background: 'none', border: 'none',
  color: T.red, fontSize: '11px', cursor: 'pointer',
  fontFamily: 'inherit',
}
