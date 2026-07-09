import React from 'react'
import { card, gbp, KPI, Td, Empty } from '../components/UI.jsx'

export default function Recurring({ expenses }) {
  const norm = (m) => (m||'')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\b(LTD|LIMITED|UK|USA|COM|SUBSCRIPTION|SUB|PAYMENT|DD|BACS|CARD|LONDON)\b/g, '')
    .replace(/\s+/g, ' ').trim()
    .split(' ').slice(0, 2).join(' ')

  const groups = {}
  expenses.forEach(e => {
    const key = norm(e.merchant)
    if (!key) return
    if (!groups[key]) groups[key] = { label: e.merchant, category: e.category, items: [] }
    groups[key].items.push(e)
  })

  const recurring = Object.values(groups)
    .filter(g => g.items.length >= 2)
    .map(g => {
      const amounts = g.items.map(i => Number(i.amount) || 0)
      const avg = amounts.reduce((a,b)=>a+b,0) / amounts.length
      const dates = g.items.map(i => i.spent_on).filter(Boolean).sort()
      // Estimate how often the charge actually recurs from the average gap
      // between occurrences, rather than treating every 2+ merchant as monthly
      // (which overstated anything billed quarterly/annually). Clamp to a sane
      // band (weekly … ~yearly) so a same-day pair can't blow the figure up.
      let perMonth = 1
      if (dates.length >= 2) {
        const spanDays = Math.max(1, (new Date(dates[dates.length-1]) - new Date(dates[0])) / 86400000)
        const intervalDays = spanDays / (dates.length - 1)
        perMonth = 30.44 / intervalDays
      }
      perMonth = Math.min(4.35, Math.max(1/12, perMonth))
      const monthly = avg * perMonth
      return {
        label: g.label,
        category: g.category,
        count: g.items.length,
        monthly,
        annual: monthly * 12,
        lastSeen: dates[dates.length - 1] || '—',
        confidence: g.items.length >= 3 ? 'Confirmed' : 'Possible',
      }
    })
    .sort((a,b) => b.annual - a.annual)

  const totalMonthly = recurring.reduce((s,r)=>s+r.monthly, 0)
  const totalAnnual = totalMonthly * 12

  if (recurring.length === 0) {
    return (
      <div style={card}>
        <div style={{fontWeight:700, marginBottom:'4px'}}>Recurring &amp; subscriptions</div>
        <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Detected automatically from your expenses</div>
        <Empty msg="No recurring payments detected yet. Once a merchant appears on 2+ expenses, it'll show up here." />
      </div>
    )
  }

  return (
    <>
      <div className="solo-kpi-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'16px' }}>
        <KPI label="Subscriptions found" value={recurring.length} />
        <KPI label="Est. monthly cost" value={gbp(totalMonthly)} color="var(--orange-light)" />
        <KPI label="Est. annual cost" value={gbp(totalAnnual)} color="var(--amber)" />
      </div>
      <div style={card}>
        <div style={{fontWeight:700, marginBottom:'4px'}}>Detected subscriptions</div>
        <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Grouped by merchant · "Possible" = seen twice, "Confirmed" = 3+ times</div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>
            {['Merchant','Category','Seen','Last','Monthly','Annual',''].map((h,i)=>(
              <th key={i} style={{ textAlign:(i>=4&&i<6)?'right':'left', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text3)', fontWeight:700, padding:'0 14px 12px', borderBottom:'1px solid var(--border)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {recurring.map((r,idx) => (
              <tr key={idx}>
                <Td>{r.label}</Td>
                <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{r.category}</span></Td>
                <Td muted mono>{r.count}×</Td>
                <Td muted mono>{r.lastSeen}</Td>
                <Td mono right>{gbp(r.monthly)}</Td>
                <Td mono right>{gbp(r.annual)}</Td>
                <Td right><span style={{ fontSize:'10.5px', fontWeight:700, padding:'2px 9px', borderRadius:'20px', color: r.confidence==='Confirmed'?'var(--green)':'var(--amber)', background: r.confidence==='Confirmed'?'rgba(34,197,94,.12)':'rgba(245,158,11,.12)' }}>{r.confidence}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
