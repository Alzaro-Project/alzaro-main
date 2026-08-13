import React from 'react'
import { card, gbp, CAT_COLORS, Empty } from './UI.jsx'

export function MonthlyChart({ invoices, expenses, period = '6months', rangeFrom = '', rangeTo = '', subtitle }) {
  const pad = n => String(n).padStart(2, '0')
  // Local-date keys throughout — toISOString() would shift keys across the
  // UTC boundary (the BST bug fixed here before). Date strings in the data are
  // already local YYYY-MM-DD, so slicing them is safe.
  const dk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const mk = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  const parse = s2 => { const [y, m, d] = (s2 || '').slice(0, 10).split('-').map(Number); return (y && m && d) ? new Date(y, m - 1, d) : null }
  const now = new Date()

  const allDates = () => [...invoices.map(i => i.issue_date), ...expenses.map(e => e.spent_on)].map(parse).filter(Boolean)

  // Bucket granularity + window follow the dashboard's selected period.
  let mode = 'month', start = new Date(now.getFullYear(), now.getMonth() - 5, 1), end = new Date(now)
  if (period === 'today') { mode = 'day'; start = new Date(now) }
  else if (period === 'week') { mode = 'day'; start = new Date(now); start.setDate(now.getDate() - 6) }
  else if (period === 'month') { mode = 'day'; start = new Date(now.getFullYear(), now.getMonth(), 1) }
  else if (period === 'quarter') { mode = 'month'; start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1) }
  else if (period === 'year') { mode = 'month'; start = new Date(now.getFullYear(), 0, 1) }
  else if (period === 'all') {
    const ds = allDates()
    start = ds.length ? new Date(Math.min(...ds)) : start
    const span = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    mode = span > 24 ? 'year' : 'month'
  }
  else if (period === 'custom') {
    const ds = allDates()
    start = parse(rangeFrom) || (ds.length ? new Date(Math.min(...ds)) : new Date(now.getFullYear(), now.getMonth(), 1))
    end = parse(rangeTo) || new Date(now)
    if (end < start) { const t = start; start = end; end = t }
    const days = (end - start) / 86400000
    mode = days <= 31 ? 'day' : days <= 740 ? 'month' : 'year'
  }

  const buckets = []
  if (mode === 'day') {
    const c = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    while (c <= end && buckets.length < 62) {
      const label = period === 'today' ? 'Today'
        : period === 'week' ? c.toLocaleDateString('en-GB', { weekday: 'short' })
        : String(c.getDate())
      buckets.push({ key: dk(c), label })
      c.setDate(c.getDate() + 1)
    }
  } else if (mode === 'month') {
    const c = new Date(start.getFullYear(), start.getMonth(), 1)
    const stop = new Date(end.getFullYear(), end.getMonth(), 1)
    while (c <= stop && buckets.length < 36) {
      const yearMark = c.getMonth() === 0 || buckets.length === 0
      buckets.push({ key: mk(c), label: c.toLocaleDateString('en-GB', { month: 'short' }) + (yearMark && period !== 'quarter' && period !== 'year' ? ` ’${String(c.getFullYear()).slice(2)}` : '') })
      c.setMonth(c.getMonth() + 1)
    }
  } else {
    for (let y = start.getFullYear(); y <= end.getFullYear() && buckets.length < 20; y++) {
      buckets.push({ key: String(y), label: String(y) })
    }
  }

  const keyOf = s2 => mode === 'day' ? (s2 || '').slice(0, 10) : mode === 'month' ? (s2 || '').slice(0, 7) : (s2 || '').slice(0, 4)
  const rev = {}, exp = {}
  invoices.filter(i => i.status === 'paid').forEach(i => { const k = keyOf(i.issue_date); rev[k] = (rev[k] || 0) + Number(i.total || 0) })
  expenses.forEach(e => { const k = keyOf(e.spent_on); exp[k] = (exp[k] || 0) + Number(e.amount || 0) })
  const max = Math.max(1, ...buckets.map(b => Math.max(rev[b.key] || 0, exp[b.key] || 0)))
  const hasData = buckets.some(b => (rev[b.key] || 0) || (exp[b.key] || 0))

  const dense = buckets.length > 14
  const labelEvery = buckets.length > 16 ? Math.ceil(buckets.length / 12) : 1
  const barW = dense ? '7px' : '14px'

  return (
    <div data-card style={{...card, marginBottom:'16px'}}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
        <div style={{fontWeight:700}}>Trend</div>
        <div style={{ display:'flex', gap:'14px', fontSize:'12px', color:'var(--text3)' }}>
          <span style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{width:'10px',height:'10px',borderRadius:'2px',background:'var(--green)'}}/>Revenue</span>
          <span style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{width:'10px',height:'10px',borderRadius:'2px',background:'var(--orange)'}}/>Expenses</span>
        </div>
      </div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>{subtitle || 'Revenue vs expenses'}</div>
      {!hasData ? <Empty msg="Nothing in this period yet — add income and expenses, or pick a wider range." />
      : <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-around', height:'170px', gap: dense ? '4px' : '12px' }}>
        {buckets.map((b, idx) => (
          <div key={b.key} style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', height:'100%' }}>
            <div style={{ flex:1, display:'flex', alignItems:'flex-end', gap: dense ? '2px' : '4px', width:'100%', justifyContent:'center' }}>
              <div className="bar-grow" title={`${b.label} — Revenue ${gbp(rev[b.key]||0)}`} style={{ width:barW, height:`${Math.round(((rev[b.key]||0)/max)*100)}%`, minHeight:(rev[b.key]?'4px':'0'), background:'var(--green)', borderRadius:'4px 4px 0 0', animationDelay:`${Math.min(idx*40, 800)}ms` }} />
              <div className="bar-grow" title={`${b.label} — Expenses ${gbp(exp[b.key]||0)}`} style={{ width:barW, height:`${Math.round(((exp[b.key]||0)/max)*100)}%`, minHeight:(exp[b.key]?'4px':'0'), background:'var(--orange)', borderRadius:'4px 4px 0 0', animationDelay:`${Math.min(idx*40+20, 820)}ms` }} />
            </div>
            <div style={{ fontSize: dense ? '10px' : '12px', color:'var(--text3)', whiteSpace:'nowrap' }}>{idx % labelEvery === 0 ? b.label : ''}</div>
          </div>
        ))}
      </div>}
    </div>
  )
}

export function Donut({ rows }) {
  const total = rows.reduce((s,[,v])=>s+v, 0) || 1
  let offset = 0
  const R = 52, C = 2*Math.PI*R
  const [shown, setShown] = React.useState(false)
  React.useEffect(()=>{ const t=setTimeout(()=>setShown(true), 50); return ()=>clearTimeout(t) }, [])
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'22px', flexWrap:'wrap' }}>
      <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink:0 }}>
        <g transform="rotate(-90 70 70)">
          {rows.map(([c,v]) => {
            const frac = v/total
            const len = shown ? frac*C : 0
            const seg = <circle key={c} cx="70" cy="70" r={R} fill="none"
              stroke={CAT_COLORS[c]||'#68635d'} strokeWidth="16"
              strokeDasharray={`${len} ${C-len}`} strokeDashoffset={-offset}
              style={{ transition:'stroke-dasharray .8s cubic-bezier(.4,0,.2,1)' }} />
            offset += shown ? frac*C : 0
            return seg
          })}
        </g>
        <text x="70" y="74" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)" fontFamily="Fira Code">{gbp(total)}</text>
      </svg>
      <div style={{ flex:1, minWidth:'160px' }}>
        {rows.map(([c,v]) => (
          <div key={c} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', fontSize:'13px' }}>
            <span style={{ width:'11px', height:'11px', borderRadius:'3px', background: CAT_COLORS[c]||'#68635d' }} />
            <span style={{ flex:1, color:'var(--text2)' }}>{c}</span>
            <span className="mono" style={{ fontWeight:600 }}>{gbp(v)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
