import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, TIER_ORDER } from '../store/useStore'
import { PageHeader } from '../components/UI'
import GlobalSearch from '../components/GlobalSearch'
import WelcomeBanner from '../components/WelcomeBanner'

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: '6months', label: '6 Months' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
]

function filterByPeriod(invoices, period, customFrom, customTo) {
  const now = new Date()
  return invoices.filter(inv => {
    if (inv.status !== 'paid' && inv.status !== 'sent') return false
    const d = new Date(inv.date)
    if (period === 'custom') {
      if (customFrom && d < new Date(customFrom + 'T00:00:00')) return false
      if (customTo && d > new Date(customTo + 'T23:59:59')) return false
      return true
    }
    if (period === 'today') return d.toDateString() === now.toDateString()
    if (period === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === 'quarter') { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear() }
    if (period === '6months') { const s = new Date(now); s.setMonth(now.getMonth() - 6); return d >= s }
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    return true
  })
}

// Interactive stat card: 3D tilt that follows the cursor, hover lift/glow,
// click-through navigation with an arrow hint. Pass `to` for navigation or
// `onClick` for custom behaviour (e.g. the Revenue/COGS dropdowns).
function DashCard({ label, value, delta, color = 'var(--text)', onClick, hint, index = 0 }) {
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
        cursor: onClick ? 'pointer' : 'default', position: 'relative', overflow: 'hidden',
        transform, animationDelay: `${index * 60}ms`,
      }}
    >
      {/* soft glow that follows hover */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: hover ? 1 : 0, transition: 'opacity .25s',
        background: `radial-gradient(420px circle at 30% 0%, color-mix(in srgb, ${color} 14%, transparent), transparent 70%)`,
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>{label}</div>
        {onClick && (
          <div style={{
            fontSize: '13px', color, transition: 'transform .2s, opacity .2s',
            opacity: hover ? 1 : 0.35, transform: hover ? 'translateX(2px)' : 'none',
          }}>→</div>
        )}
      </div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '24px', fontWeight: 500, marginTop: '5px', marginBottom: '3px', color }}>{value}</div>
      {delta && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{hover && hint ? hint : delta}</div>}
    </div>
  )
}


function TiltPanel({ title, accent = 'var(--text2)', onClick, children, index = 0 }) {
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>{title}</div>
        {onClick && (
          <div style={{
            fontSize: '13px', color: accent, transition: 'transform .2s, opacity .2s',
            opacity: hover ? 1 : 0.35, transform: hover ? 'translateX(2px)' : 'none',
          }}>→</div>
        )}
      </div>
      {children}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { invoices, skus, batches, usedTyres, customers, tier, dashPeriod, setDashPeriod, getFIFOCost, getTotalStock, settings } = useStore()
  const isGold = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('gold')

  const [showRevenueDropdown, setShowRevenueDropdown] = useState(false)
  const [showCOGSDropdown, setShowCOGSDropdown] = useState(false)
  const [revenueLimit, setRevenueLimit] = useState(5)
  const [cogsLimit, setCogsLimit] = useState(5)

  // Custom date range (defaults to the last 30 days)
  const toISO = (dt) => dt.toISOString().slice(0, 10)
  const [customFrom, setCustomFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return toISO(d) })
  const [customTo, setCustomTo] = useState(() => toISO(new Date()))

  const filtered = filterByPeriod(invoices, dashPeriod, customFrom, customTo)

  // Calculate invoice-level metrics
  const invoiceMetrics = filtered.map(inv => {
    let invRevenue = 0, invCOGS = 0, tyreCount = 0
    inv.lines.forEach(l => {
      const lt = l.qty * l.unit
      invRevenue += lt
      invCOGS += l.qty * (l.cost || 0)
      if (l.skuId || l.usedId) tyreCount += l.qty
    })
    return { ...inv, invRevenue, invCOGS, tyreCount }
  })

  // Sort by revenue for display
  const byRevenue = [...invoiceMetrics].sort((a, b) => b.invRevenue - a.invRevenue)
  const byCOGS = [...invoiceMetrics].sort((a, b) => b.invCOGS - a.invCOGS)

  let revenue = 0, cogs = 0, tyresSold = 0, usedRev = 0
  filtered.forEach(inv => {
    inv.lines.forEach(l => {
      const lt = l.qty * l.unit
      revenue += lt
      cogs += l.qty * (l.cost || 0)
      if (l.skuId || l.usedId) tyresSold += l.qty
      if (l.lineType === 'used') usedRev += lt
    })
  })
  const profit = revenue - cogs
  const margin = revenue > 0 ? Math.round(profit / revenue * 100) : 0
  const stockVal = skus.reduce((a, sk) => {
    return a + batches.filter(b => b.skuId === sk.id && b.remaining > 0).reduce((x, b) => x + b.remaining * b.cost, 0)
  }, 0)
  const activeBatches = batches.filter(b => b.remaining > 0).length

  // Low stock
  const lowStock = skus.filter(sk => getTotalStock(sk.id) <= sk.alert)

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${settings?.name || 'Your Garage'} — ${dashPeriod === 'custom' ? `${customFrom} → ${customTo}` : PERIODS.find(p => p.key === dashPeriod)?.label}`} />

      <WelcomeBanner />

      {/* Global Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <GlobalSearch maxWidth="500px" />
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface2)', borderRadius: '10px', padding: '4px', marginBottom: '20px', width: 'fit-content', flexWrap: 'wrap' }}>
        {PERIODS.map(p => (
          <div key={p.key} onClick={() => setDashPeriod(p.key)} style={{
            padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
            background: dashPeriod === p.key ? 'var(--surface3)' : 'transparent',
            color: dashPeriod === p.key ? 'var(--text)' : 'var(--text2)',
          }}>
            {p.label}
          </div>
        ))}
      </div>

      {/* Custom range pickers — only when Custom is selected */}
      {dashPeriod === 'custom' && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>From</span>
          <input type="date" value={customFrom} max={customTo} onChange={e => setCustomFrom(e.target.value)}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none' }} />
          <span style={{ fontSize: '12px', color: 'var(--text2)' }}>To</span>
          <input type="date" value={customTo} min={customFrom} onChange={e => setCustomTo(e.target.value)}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '7px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none' }} />
        </div>
      )}

      {/* Stat Cards - Clickable Revenue and COGS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }} className="stat-grid">
        {/* Revenue Card - dropdown breakdown */}
        <div style={{ position: 'relative' }}>
          <DashCard
            label="Revenue ▾"
            value={`£${revenue.toFixed(2)}`}
            delta={`${filtered.length} invoices`}
            hint="Click for breakdown"
            color="var(--accent)"
            index={0}
            onClick={() => { setShowRevenueDropdown(!showRevenueDropdown); setShowCOGSDropdown(false) }}
          />
          {showRevenueDropdown && (
            <InvoiceDropdown 
              title="Revenue Breakdown"
              invoices={byRevenue}
              valueKey="invRevenue"
              limit={revenueLimit}
              setLimit={setRevenueLimit}
              onClose={() => setShowRevenueDropdown(false)}
              color="var(--accent)"
            />
          )}
        </div>

        {/* COGS Card - dropdown breakdown */}
        <div style={{ position: 'relative' }}>
          <DashCard
            label="Cost of Sales ▾"
            value={`£${cogs.toFixed(2)}`}
            delta={`${tyresSold} tyres sold`}
            hint="Click for breakdown"
            index={1}
            onClick={() => { setShowCOGSDropdown(!showCOGSDropdown); setShowRevenueDropdown(false) }}
          />
          {showCOGSDropdown && (
            <InvoiceDropdown 
              title="Cost Breakdown"
              invoices={byCOGS}
              valueKey="invCOGS"
              limit={cogsLimit}
              setLimit={setCogsLimit}
              onClose={() => setShowCOGSDropdown(false)}
              color="var(--red)"
            />
          )}
        </div>

        <DashCard label="Gross Profit" value={`£${profit.toFixed(2)}`} delta={`${margin}% margin`} hint="View invoices →" color="var(--green)" index={2} onClick={() => navigate('/invoices')} />
        <DashCard label="Stock Value" value={`£${stockVal.toFixed(2)}`} delta={`${activeBatches} active batches`} hint="View inventory →" color="var(--blue)" index={3} onClick={() => navigate('/inventory')} />
      </div>

      {/* Gold content */}
      {isGold ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            <TiltPanel title="Monthly P&L" accent="var(--accent)" index={4} onClick={() => navigate('/invoices')}>
              <PLChart invoices={invoices} />
            </TiltPanel>
            <TiltPanel title="Top Selling Tyres" accent="var(--teal)" index={5} onClick={() => navigate('/inventory')}>
              <TopTyres invoices={filtered} skus={skus} />
            </TiltPanel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            <TiltPanel title="Stock Alerts" accent="var(--red)" index={6} onClick={() => navigate('/inventory', { state: { tab: 'low' } })}>
              <StockAlerts lowStock={lowStock} getTotalStock={getTotalStock} />
            </TiltPanel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignContent: 'start' }}>
              <DashCard label="Used Tyre Revenue" value={`£${usedRev.toFixed(2)}`} delta="Part-ex resales" hint="View used stock →" color="var(--teal)" index={7} onClick={() => navigate('/inventory', { state: { tab: 'used' } })} />
              <DashCard label="Active Batches" value={activeBatches} delta="FIFO tracking" hint="View purchases →" index={8} onClick={() => navigate('/purchases')} />
              <DashCard label="Used in Stock" value={usedTyres.filter(u => !u.sold).length} delta="Available" hint="View used stock →" color="var(--teal)" index={9} onClick={() => navigate('/inventory', { state: { tab: 'used' } })} />
              <DashCard label="Total SKUs" value={skus.length} delta="Tyre types" hint="View inventory →" index={10} onClick={() => navigate('/inventory')} />
            </div>
          </div>
        </>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px dashed rgba(245,200,66,.3)', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', color: 'var(--accent)', marginBottom: '8px' }}>🥇 Upgrade to Gold for Full Dashboard</div>
          <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>Charts, top sellers, stock alerts and P&L breakdown</div>
          <button 
            onClick={() => navigate('/settings')}
            style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, padding: '9px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
          >
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  )
}

// Invoice Dropdown Component for Revenue/COGS breakdown
function InvoiceDropdown({ title, invoices, valueKey, limit, setLimit, onClose, color }) {
  const displayed = invoices.slice(0, limit)
  const hasMore = invoices.length > limit

  return (
    <>
      {/* Backdrop */}
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
        onClick={onClose}
      />
      
      {/* Dropdown */}
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        marginTop: '8px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        zIndex: 100,
        minWidth: '320px',
        maxHeight: '400px',
        overflowY: 'auto',
      }}>
        <div style={{ 
          padding: '12px 14px', 
          borderBottom: '1px solid var(--border)',
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '.8px',
          textTransform: 'uppercase',
          color: 'var(--text2)',
          fontFamily: 'DM Mono, monospace',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{title}</span>
          <span style={{ color: 'var(--text3)', cursor: 'pointer' }} onClick={onClose}>✕</span>
        </div>

        {displayed.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
            No invoices in this period
          </div>
        ) : (
          <>
            {displayed.map(inv => (
              <div 
                key={inv.id} 
                style={{ 
                  padding: '12px 14px', 
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{inv.custName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>
                    {inv.id} · {inv.date}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontWeight: 600, color }}>
                    £{inv[valueKey].toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)' }}>
                    {inv.tyreCount} tyre{inv.tyreCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <div 
                style={{ 
                  padding: '12px 14px', 
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: 'var(--accent)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                onClick={() => setLimit(limit + 5)}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                Show more ({invoices.length - limit} remaining)
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}

function PLChart({ invoices }) {
  // Real data from invoices for the last 6 months
  const now = new Date()
  const monthData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
    const monthName = d.toLocaleDateString('en-GB', { month: 'short' })
    let rev = 0, cost = 0
    invoices.forEach(inv => {
      if (inv.status !== 'paid' && inv.status !== 'sent') return
      const invDate = new Date(inv.date)
      if (invDate >= d && invDate <= monthEnd) {
        inv.lines.forEach(l => { rev += l.qty * l.unit; cost += l.qty * (l.cost || 0) })
      }
    })
    monthData.push({ month: monthName, rev, cost, profit: rev - cost })
  }

  const maxVal = Math.max(...monthData.map(m => Math.max(m.rev, m.cost)), 1) * 1.1
  const [mounted, setMounted] = useState(false)
  const [hov, setHov] = useState(null)
  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t) }, [])

  const h = (v) => mounted ? `${Math.max((v / maxVal) * 100, v > 0 ? 2 : 0.5)}%` : '0%'

  return (
    <div style={{ position: 'relative' }}>
      {/* Tooltip */}
      {hov !== null && (
        <div style={{
          position: 'absolute', top: '-6px', left: `${(hov + 0.5) * (100 / 6)}%`, transform: 'translateX(-50%)',
          background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '8px',
          padding: '7px 10px', zIndex: 10, pointerEvents: 'none', whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(0,0,0,.3)', fontSize: '11px', fontFamily: 'DM Mono, monospace',
        }}>
          <div style={{ color: 'var(--text2)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '3px' }}>{monthData[hov].month}</div>
          <div style={{ color: 'var(--accent)' }}>Rev £{monthData[hov].rev.toFixed(2)}</div>
          <div style={{ color: 'var(--red)' }}>Cost £{monthData[hov].cost.toFixed(2)}</div>
          <div style={{ color: monthData[hov].profit >= 0 ? 'var(--green)' : 'var(--red)', borderTop: '1px solid var(--border)', marginTop: '3px', paddingTop: '3px' }}>
            P/L {monthData[hov].profit >= 0 ? '+' : '−'}£{Math.abs(monthData[hov].profit).toFixed(2)}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', paddingBottom: '20px', position: 'relative' }}>
        {/* Gridlines */}
        {[0.25, 0.5, 0.75].map(g => (
          <div key={g} style={{ position: 'absolute', left: 0, right: 0, bottom: `${20 + g * (160 - 20) / 160 * 100 * (140 / 160)}px`, borderTop: '1px dashed var(--border)', opacity: 0.5 }} />
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
                background: 'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 45%, transparent))',
                transition: `height .6s cubic-bezier(.2,.8,.3,1) ${i * 70}ms`,
                boxShadow: hov === i ? '0 0 12px color-mix(in srgb, var(--accent) 45%, transparent)' : 'none',
              }} />
              <div style={{
                flex: 1, borderRadius: '4px 4px 0 0', height: h(m.cost),
                background: 'linear-gradient(180deg, var(--red), color-mix(in srgb, var(--red) 40%, transparent))',
                opacity: 0.75,
                transition: `height .6s cubic-bezier(.2,.8,.3,1) ${i * 70 + 40}ms`,
              }} />
            </div>
            <div style={{
              fontSize: '10px', fontFamily: 'DM Mono, monospace',
              color: hov === i ? 'var(--text)' : 'var(--text3)', fontWeight: hov === i ? 700 : 400,
            }}>{m.month}</div>
          </div>
        ))}

        <div style={{ position: 'absolute', bottom: '0px', right: 0, display: 'flex', gap: '10px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: 'var(--accent)', borderRadius: '2px', display: 'inline-block' }} />Rev</span>
          <span style={{ fontSize: '10px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: 'var(--red)', opacity: 0.75, borderRadius: '2px', display: 'inline-block' }} />Cost</span>
        </div>
      </div>
    </div>
  )
}

function TopTyres({ invoices, skus }) {
  const ts = {}
  invoices.forEach(inv => {
    inv.lines.forEach(l => {
      if (l.skuId) {
        if (!ts[l.skuId]) ts[l.skuId] = { qty: 0, profit: 0 }
        ts[l.skuId].qty += l.qty
        ts[l.skuId].profit += l.qty * (l.unit - (l.cost || 0))
      }
    })
  })
  const top = Object.entries(ts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(t) }, [])

  if (!top.length) return <div style={{ color: 'var(--text3)', fontSize: '12px' }}>No sales data for this period</div>
  const maxQty = top[0][1].qty || 1
  const RANK = ['var(--accent)', 'var(--blue)', 'var(--teal)', 'var(--text3)', 'var(--text3)']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {top.map(([id, s], i) => {
        const sk = skus.find(sk => sk.id === id)
        if (!sk) return null
        return (
          <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '22px', height: '22px', borderRadius: '7px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `color-mix(in srgb, ${RANK[i]} 16%, transparent)`,
              color: RANK[i], fontSize: '11px', fontWeight: 700, fontFamily: 'DM Mono, monospace',
            }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sk.brand} {sk.model} <span style={{ color: 'var(--text3)', fontFamily: 'DM Mono, monospace', fontSize: '11px', fontWeight: 400 }}>{sk.w}/{sk.p}R{sk.r}</span>
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                  {s.qty} sold · <span style={{ color: s.profit >= 0 ? 'var(--green)' : 'var(--red)' }}>£{s.profit.toFixed(2)}</span>
                </span>
              </div>
              <div style={{ height: '5px', background: 'var(--surface2)', borderRadius: '99px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '99px',
                  width: mounted ? `${(s.qty / maxQty) * 100}%` : '0%',
                  background: `linear-gradient(90deg, ${RANK[i]}, color-mix(in srgb, ${RANK[i]} 55%, transparent))`,
                  transition: `width .7s cubic-bezier(.2,.8,.3,1) ${i * 90}ms`,
                }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StockAlerts({ lowStock, getTotalStock }) {
  if (!lowStock.length) return <div style={{ color: 'var(--green)', fontSize: '12px', padding: '8px 0' }}>✓ All stock levels OK</div>
  return (
    <div>
      {lowStock.map(sk => {
        const qty = getTotalStock(sk.id)
        return (
          <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: qty === 0 ? 'var(--red)' : 'var(--accent)' }}>⚠</span>
            <span style={{ flex: 1, fontSize: '12px' }}>{sk.brand} {sk.model}<br />
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--text2)' }}>{sk.w}/{sk.p}R{sk.r}</span>
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, fontFamily: 'DM Mono, monospace',
              background: qty === 0 ? 'rgba(255,95,95,0.1)' : 'rgba(245,200,66,0.12)',
              color: qty === 0 ? 'var(--red)' : 'var(--accent)',
            }}>
              {qty === 0 ? 'OUT' : `LOW: ${qty}`}
            </span>
          </div>
        )
      })}
    </div>
  )
}
