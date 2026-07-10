import React, { useState, useRef, useMemo } from 'react'
import { gbp, Empty } from '../components/UI.jsx'
import { MonthlyChart, Donut } from '../components/Charts.jsx'
import WelcomeBanner from '../components/WelcomeBanner.jsx'

// ---------------------------------------------------------------------------
// Period filter — scoped to this dashboard only. The app-wide year filter in
// the header is untouched; this narrows further within whatever it selected.
// ---------------------------------------------------------------------------
export const PERIODS = [
  { key: 'today',   label: 'Today' },
  { key: 'week',    label: 'This Week' },
  { key: 'month',   label: 'This Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: '6months', label: '6 Months' },
  { key: 'year',    label: 'This Year' },
  { key: 'all',     label: 'All Time' },
]

// Parse a yyyy-mm-dd date string as a LOCAL date (not UTC) so BST/GMT offsets
// can't roll a day backwards — the same class of bug fixed in Charts.jsx.
function localDate(s) {
  if (!s) return null
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function inPeriod(dateStr, period) {
  if (period === 'all') return true
  const d = localDate(dateStr)
  if (!d) return false
  const now = new Date()
  if (period === 'today')   return d.toDateString() === now.toDateString()
  if (period === 'week')    { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
  if (period === 'month')   return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  if (period === 'quarter') { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear() }
  if (period === '6months') { const s = new Date(now); s.setMonth(now.getMonth() - 6); return d >= s }
  if (period === 'year')    return d.getFullYear() === now.getFullYear()
  return true
}

// ---------------------------------------------------------------------------
// DashCard — cursor-following 3D tilt, hover glow, click-through arrow.
// ---------------------------------------------------------------------------
export function DashCard({ label, value, delta, hint, color = 'var(--text)', onClick, index = 0 }) {
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
      className="solo-dash-card"
      data-pop
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
        background: `radial-gradient(420px circle at 30% 0%, color-mix(in srgb, ${color} 14%, transparent), transparent 70%)`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)' }}>{label}</div>
        {onClick && (
          <div style={{ fontSize: '13px', color, transition: 'transform .2s, opacity .2s', opacity: hover ? 1 : 0.35, transform: hover ? 'translateX(2px)' : 'none' }}>→</div>
        )}
      </div>
      <div className="mono" style={{ fontSize: '24px', fontWeight: 500, marginTop: '5px', marginBottom: '3px', color }}>{value}</div>
      {delta && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{hover && hint ? hint : delta}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TiltPanel — larger container, subtler tilt.
// ---------------------------------------------------------------------------
export function TiltPanel({ title, subtitle, accent = 'var(--text2)', onClick, children, index = 0 }) {
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
      className="solo-dash-card"
      data-pop
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px',
        cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden',
        transform, animationDelay: `${index * 60}ms`,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: hover ? 1 : 0, transition: 'opacity .25s',
        background: `radial-gradient(600px circle at 25% 0%, color-mix(in srgb, ${accent} 10%, transparent), transparent 70%)`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: subtitle ? '2px' : '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)' }}>{title}</div>
        {onClick && (
          <div style={{ fontSize: '13px', color: accent, transition: 'transform .2s, opacity .2s', opacity: hover ? 1 : 0.35, transform: hover ? 'translateX(2px)' : 'none' }}>→</div>
        )}
      </div>
      {subtitle && <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>{subtitle}</div>}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashSearch — searches clients, invoices and expenses; keyboard navigable.
// ---------------------------------------------------------------------------
function DashSearch({ clients, invoices, expenses, setView }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(-1)

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const out = []
    clients.forEach(c => { if ((c.name || '').toLowerCase().includes(s)) out.push({ type: 'Client', label: c.name, view: 'clients' }) })
    invoices.forEach(i => {
      const hay = `${i.number || ''} ${i.client_name || ''}`.toLowerCase()
      if (hay.includes(s)) out.push({ type: 'Invoice', label: `${i.number || '—'} · ${i.client_name || ''}`, sub: gbp(i.total || 0), view: 'income' })
    })
    expenses.forEach(e => { if ((e.merchant || '').toLowerCase().includes(s)) out.push({ type: 'Expense', label: e.merchant, sub: gbp(e.amount || 0), view: 'expenses' }) })
    return out.slice(0, 8)
  }, [q, clients, invoices, expenses])

  const go = (r) => { setView(r.view); setQ(''); setOpen(false); setSel(-1) }

  const onKey = (e) => {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter' && sel >= 0) { e.preventDefault(); go(results[sel]) }
    else if (e.key === 'Escape') { setOpen(false); setSel(-1) }
  }

  return (
    <div style={{ position: 'relative', maxWidth: '520px', marginBottom: '16px' }}>
      <input
        value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); setSel(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        placeholder="🔍  Search clients, invoices, expenses…"
        aria-label="Search clients, invoices and expenses"
        style={{
          width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px',
          padding: '13px 16px', color: 'var(--text)', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
        }}
      />
      {open && q.trim().length >= 2 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px',
          overflow: 'hidden', boxShadow: '0 18px 40px rgba(0,0,0,.4)',
        }}>
          {results.length === 0
            ? <div style={{ padding: '14px', fontSize: '12.5px', color: 'var(--text3)' }}>No matches for “{q}”.</div>
            : results.map((r, i) => (
              <div key={i} onMouseDown={() => go(r)} onMouseEnter={() => setSel(i)}
                style={{
                  padding: '11px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: '10px', background: sel === i ? 'var(--surface2)' : 'transparent',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', marginRight: '8px' }}>{r.type}</span>
                  <span style={{ fontSize: '13.5px' }}>{r.label}</span>
                </span>
                {r.sub && <span className="mono" style={{ fontSize: '12.5px', color: 'var(--text2)', flexShrink: 0 }}>{r.sub}</span>}
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export default function Dashboard({
  invoices, expenses, clients, mileage, bizName, uid,
  setView, setModal, tierAllows,
  taxRate, nicRate, allowance,
}) {
  const [period, setPeriod] = useState('month')
  const canExpense = tierAllows('bronze')

  // Narrow to the selected period (dashboard-scoped only).
  const pInvoices = useMemo(() => invoices.filter(i => inPeriod(i.issue_date, period)), [invoices, period])
  const pExpenses = useMemo(() => expenses.filter(e => inPeriod(e.spent_on, period)), [expenses, period])

  const revenue = pInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalExp = pExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const profit = revenue - totalExp
  const taxable = Math.max(0, profit - Number(allowance || 0))
  const estTax = Math.max(0, taxable * (Number(taxRate || 0) / 100) + taxable * (Number(nicRate || 0) / 100))
  const outstanding = pInvoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + Number(i.total || 0), 0)
  const overdue = pInvoices.filter(i => i.status === 'overdue')
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0

  const byCat = {}
  pExpenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0) })
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  const paidCount = pInvoices.filter(i => i.status === 'paid').length
  const periodLabel = PERIODS.find(p => p.key === period)?.label || ''

  return (
    <>
      <WelcomeBanner invoices={invoices} expenses={expenses} clients={clients} bizName={bizName} setView={setView} setModal={setModal} uid={uid} canExpense={canExpense} />

      <div style={{ marginBottom: '4px', fontSize: '13px', color: 'var(--text3)' }}>
        {bizName || 'Your business'} — {periodLabel}
      </div>

      <DashSearch clients={clients} invoices={invoices} expenses={expenses} setView={setView} />

      {/* Period tabs */}
      <div className="solo-period-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '18px', overflowX: 'auto', paddingBottom: '4px' }}>
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            style={{
              flexShrink: 0, padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (period === p.key ? 'var(--border-light)' : 'transparent'),
              background: period === p.key ? 'var(--surface3)' : 'transparent',
              color: period === p.key ? 'var(--text)' : 'var(--text2)',
            }}>{p.label}</button>
        ))}
      </div>

      {/* KPI row */}
      <div className="solo-kpi-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${canExpense ? 4 : 3},1fr)`, gap: '12px', marginBottom: '18px' }}>
        <DashCard label="Revenue (paid)" value={gbp(revenue)} delta={`${paidCount} paid invoice${paidCount === 1 ? '' : 's'}`} hint="View income →" color="var(--green)" index={0} onClick={() => setView('income')} />
        {canExpense && <DashCard label="Expenses" value={gbp(totalExp)} delta={`${pExpenses.length} logged`} hint="View expenses →" color="var(--orange)" index={1} onClick={() => setView('expenses')} />}
        <DashCard label="Profit" value={gbp(profit)} delta={`${margin}% margin`} hint="View reports →" color={profit >= 0 ? 'var(--green)' : 'var(--red)'} index={2} onClick={() => setView('reports')} />
        <DashCard label="Est. tax" value={gbp(estTax)} delta="estimate only" hint="View tax →" color="var(--amber)" index={3} onClick={() => setView('tax')} />
      </div>

      {/* Chart + breakdown */}
      <div className="solo-dash-cols" style={{ display: 'grid', gridTemplateColumns: canExpense ? '1fr 1fr' : '1fr', gap: '16px', marginBottom: '18px' }}>
        <TiltPanel title="Monthly trend" subtitle="Revenue vs expenses, last 6 months" accent="var(--orange)" index={4} onClick={() => setView('reports')}>
          <MonthlyChart invoices={pInvoices} expenses={pExpenses} />
        </TiltPanel>
        {canExpense && (
          <TiltPanel title="Expense breakdown" subtitle="By category" accent="var(--red)" index={5} onClick={() => setView('expenses')}>
            {catRows.length === 0 ? <Empty msg="No expenses yet — add your first one." /> : <Donut rows={catRows} />}
          </TiltPanel>
        )}
      </div>

      {/* Secondary row */}
      <div className="solo-dash-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <TiltPanel title="Outstanding invoices" subtitle="Sent or overdue, awaiting payment" accent="var(--amber)" index={6} onClick={() => setView('income')}>
          <div className="mono" style={{ fontSize: '26px', fontWeight: 600, color: outstanding > 0 ? 'var(--amber)' : 'var(--text)' }}>{gbp(outstanding)}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>
            {overdue.length > 0
              ? <span style={{ color: 'var(--red)' }}>{overdue.length} overdue</span>
              : 'Nothing overdue'}
          </div>
        </TiltPanel>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignContent: 'start' }}>
          <DashCard label="Clients" value={clients.length} delta="Total on file" hint="View clients →" index={7} onClick={() => setView('clients')} />
          <DashCard label="Invoices" value={pInvoices.length} delta={periodLabel} hint="View income →" index={8} onClick={() => setView('income')} />
          {tierAllows('silver')
            ? <DashCard label="Mileage" value={`${mileage.reduce((s, m) => s + Number(m.miles || 0), 0).toFixed(0)} mi`} delta={`${mileage.length} journeys`} hint="View mileage →" color="var(--blue)" index={9} onClick={() => setView('mileage')} />
            : <DashCard label="Mileage" value="—" delta="Silver feature" index={9} />}
          <DashCard label="Taxable profit" value={gbp(taxable)} delta={`after £${Number(allowance || 0).toLocaleString()} allowance`} hint="View tax →" color="var(--amber)" index={10} onClick={() => setView('tax')} />
        </div>
      </div>
    </>
  )
}
