import React from 'react'
import { card, gbp, CAT_COLORS, Empty } from './UI.jsx'

export function MonthlyChart({ invoices, expenses }) {
  const ym = d => (d||'').slice(0,7)
  // Build the YYYY-MM key from LOCAL year/month. Using toISOString() here would
  // convert local midnight-on-the-1st to UTC, rolling the key back a month in
  // any UTC+ offset (e.g. every month during British Summer Time), so the bars
  // would show the previous month's data under the current month's label.
  const mkey = (y,m) => `${y}-${String(m+1).padStart(2,'0')}`
  const now = new Date()
  const months = []
  for (let i=5; i>=0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth()-i, 1)
    months.push({ key: mkey(dt.getFullYear(), dt.getMonth()), label: dt.toLocaleDateString('en-GB',{month:'short'}) })
  }
  const rev = {}, exp = {}
  invoices.filter(i=>i.status==='paid').forEach(i => { const k=ym(i.issue_date); rev[k]=(rev[k]||0)+Number(i.total||0) })
  expenses.forEach(e => { const k=ym(e.spent_on); exp[k]=(exp[k]||0)+Number(e.amount||0) })
  const max = Math.max(1, ...months.map(m => Math.max(rev[m.key]||0, exp[m.key]||0)))
  const hasData = months.some(m => (rev[m.key]||0) || (exp[m.key]||0))
  return (
    <div data-card style={{...card, marginBottom:'16px'}}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
        <div style={{fontWeight:700}}>Monthly trend</div>
        <div style={{ display:'flex', gap:'14px', fontSize:'12px', color:'var(--text3)' }}>
          <span style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{width:'10px',height:'10px',borderRadius:'2px',background:'var(--green)'}}/>Revenue</span>
          <span style={{display:'flex',alignItems:'center',gap:'6px'}}><span style={{width:'10px',height:'10px',borderRadius:'2px',background:'var(--orange)'}}/>Expenses</span>
        </div>
      </div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Revenue vs expenses, last 6 months</div>
      {!hasData ? <Empty msg="No data yet — add income and expenses to see your trend." />
      : <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-around', height:'170px', gap:'12px' }}>
        {months.map((m,idx) => (
          <div key={m.key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'8px', height:'100%' }}>
            <div style={{ flex:1, display:'flex', alignItems:'flex-end', gap:'4px', width:'100%', justifyContent:'center' }}>
              <div className="bar-grow" title={'Revenue '+gbp(rev[m.key]||0)} style={{ width:'14px', height:`${Math.round(((rev[m.key]||0)/max)*100)}%`, minHeight:(rev[m.key]?'4px':'0'), background:'var(--green)', borderRadius:'4px 4px 0 0', animationDelay:`${idx*70}ms` }} />
              <div className="bar-grow" title={'Expenses '+gbp(exp[m.key]||0)} style={{ width:'14px', height:`${Math.round(((exp[m.key]||0)/max)*100)}%`, minHeight:(exp[m.key]?'4px':'0'), background:'var(--orange)', borderRadius:'4px 4px 0 0', animationDelay:`${idx*70+35}ms` }} />
            </div>
            <div style={{ fontSize:'12px', color:'var(--text3)' }}>{m.label}</div>
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
