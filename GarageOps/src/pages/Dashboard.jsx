import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore, TIER_ORDER } from '../store/useStore'
import { StatCard, Card, PageHeader, Btn } from '../components/UI'
import GlobalSearch from '../components/GlobalSearch'

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: '6months', label: '6 Months' },
  { key: 'year', label: 'This Year' },
]

function filterByPeriod(invoices, period) {
  const now = new Date()
  return invoices.filter(inv => {
    if (inv.status !== 'paid' && inv.status !== 'sent') return false
    const d = new Date(inv.date)
    if (period === 'today') return d.toDateString() === now.toDateString()
    if (period === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w }
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === 'quarter') { const q = Math.floor(now.getMonth() / 3); return Math.floor(d.getMonth() / 3) === q && d.getFullYear() === now.getFullYear() }
    if (period === '6months') { const s = new Date(now); s.setMonth(now.getMonth() - 6); return d >= s }
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    return true
  })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { invoices, skus, batches, usedTyres, customers, tier, dashPeriod, setDashPeriod, getFIFOCost, getTotalStock, settings } = useStore()
  const isGold = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('gold')

  const [showRevenueDropdown, setShowRevenueDropdown] = useState(false)
  const [showCOGSDropdown, setShowCOGSDropdown] = useState(false)
  const [revenueLimit, setRevenueLimit] = useState(5)
  const [cogsLimit, setCogsLimit] = useState(5)

  const filtered = filterByPeriod(invoices, dashPeriod)

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
      <PageHeader title="Dashboard" subtitle={`${settings?.name || 'Your Garage'} — ${PERIODS.find(p => p.key === dashPeriod)?.label}`} />

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

      {/* Stat Cards - Clickable Revenue and COGS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }} className="stat-grid">
        {/* Revenue Card - Clickable */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => { setShowRevenueDropdown(!showRevenueDropdown); setShowCOGSDropdown(false) }}
            style={{ cursor: 'pointer' }}
          >
            <StatCard 
              label="Revenue ▾" 
              value={`£${revenue.toFixed(2)}`} 
              delta={`${filtered.length} invoices`} 
              color="var(--accent)" 
            />
          </div>
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

        {/* COGS Card - Clickable */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => { setShowCOGSDropdown(!showCOGSDropdown); setShowRevenueDropdown(false) }}
            style={{ cursor: 'pointer' }}
          >
            <StatCard 
              label="Cost of Sales ▾" 
              value={`£${cogs.toFixed(2)}`} 
              delta={`${tyresSold} tyres sold`} 
            />
          </div>
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

        <StatCard label="Gross Profit" value={`£${profit.toFixed(2)}`} delta={`${margin}% margin`} color="var(--green)" />
        <StatCard label="Stock Value" value={`£${stockVal.toFixed(2)}`} delta={`${activeBatches} active batches`} color="var(--blue)" />
      </div>

      {/* Gold content */}
      {isGold ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            <Card>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: '12px', fontFamily: 'DM Mono, monospace' }}>Monthly P&L</div>
              <PLChart invoices={invoices} />
            </Card>
            <Card>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: '12px', fontFamily: 'DM Mono, monospace' }}>Top Selling Tyres</div>
              <TopTyres invoices={filtered} skus={skus} />
            </Card>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            <Card>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', marginBottom: '12px', fontFamily: 'DM Mono, monospace' }}>Stock Alerts</div>
              <StockAlerts lowStock={lowStock} getTotalStock={getTotalStock} />
            </Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignContent: 'start' }}>
              <StatCard label="Used Tyre Revenue" value={`£${usedRev.toFixed(2)}`} delta="Part-ex resales" color="var(--teal)" />
              <StatCard label="Active Batches" value={activeBatches} delta="FIFO tracking" />
              <StatCard label="Used in Stock" value={usedTyres.filter(u => !u.sold).length} delta="Available" color="var(--teal)" />
              <StatCard label="Total SKUs" value={skus.length} delta="Tyre types" />
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
  // Generate real data from invoices for last 6 months
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
        inv.lines.forEach(l => {
          rev += l.qty * l.unit
          cost += l.qty * (l.cost || 0)
        })
      }
    })
    monthData.push({ month: monthName, rev, cost })
  }

  const maxVal = Math.max(...monthData.map(m => m.rev), 1) * 1.1

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '160px', paddingBottom: '20px', position: 'relative' }}>
      {monthData.map((m, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', display: 'flex', gap: '2px', alignItems: 'flex-end', flex: 1 }}>
            <div style={{ flex: 1, background: 'rgba(245,200,66,0.7)', borderRadius: '3px 3px 0 0', height: `${(m.rev / maxVal) * 100}%`, minHeight: '2px' }} />
            <div style={{ flex: 1, background: 'rgba(255,95,95,0.5)', borderRadius: '3px 3px 0 0', height: `${(m.cost / maxVal) * 100}%`, minHeight: '2px' }} />
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace' }}>{m.month}</div>
        </div>
      ))}
      <div style={{ position: 'absolute', bottom: '20px', right: 0, display: 'flex', gap: '10px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: 'rgba(245,200,66,0.7)', borderRadius: '2px', display: 'inline-block' }} />Rev</span>
        <span style={{ fontSize: '10px', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', background: 'rgba(255,95,95,0.5)', borderRadius: '2px', display: 'inline-block' }} />Cost</span>
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
  if (!top.length) return <div style={{ color: 'var(--text3)', fontSize: '12px' }}>No sales data for this period</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
      <thead><tr>
        {['Tyre', 'Size', 'Sold', 'Profit'].map(h => <th key={h} style={{ textAlign: 'left', fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>)}
      </tr></thead>
      <tbody>
        {top.map(([id, s]) => {
          const sk = skus.find(sk => sk.id === id)
          if (!sk) return null
          return (
            <tr key={id}>
              <td style={{ padding: '8px', fontWeight: 600 }}>{sk.brand} {sk.model}</td>
              <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{sk.w}/{sk.p}R{sk.r}</td>
              <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace' }}>{s.qty}</td>
              <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>£{s.profit.toFixed(2)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
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