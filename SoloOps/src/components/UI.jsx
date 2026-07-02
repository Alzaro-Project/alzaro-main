import React from 'react'
import { createPortal } from 'react-dom'

// ---------- constants ----------
export const CATEGORIES = ['Fuel','Travel','Software','Marketing','Equipment','Insurance','Utilities','Professional Services','Office Costs','Other']
export const CAT_COLORS = { Software:'#f97316', Fuel:'#f59e0b', Marketing:'#3b82f6', Equipment:'#22c55e', Travel:'#eab308', Insurance:'#a78bfa', Utilities:'#38bdf8', 'Professional Services':'#fb7185', 'Office Costs':'#94a3b8', Other:'#68635d' }

export const NAV = [
  ['dashboard','Dashboard','📊','basic'], ['income','Income','📄','basic'], ['clients','Clients','👥','basic'], ['expenses','Expenses','💷','bronze'],
  ['banking','Banking','🏦','silver'], ['recurring','Recurring','🔁','bronze'], ['receipts','Receipts','🧾','bronze'], ['mileage','Mileage','🚗','silver'],
  ['reports','Reports','📈','silver'], ['documents','Documents','📁','gold'], ['tax','Tax','📋','gold'], ['settings','Settings','🔧','basic']
]

export const TIER_ORDER = ['basic','bronze','silver','gold']

// ---------- formatting ----------
export const gbp = n => '£' + (Number(n)||0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

// ---------- shared inline styles ----------
export const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'22px' }
export const inp = { background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'11px 14px', color:'var(--text)', fontSize:'14px', outline:'none', width:'100%' }
export const grad = 'linear-gradient(135deg, var(--orange), var(--amber))'
export const btnPri = { background:grad, color:'#000', fontWeight:700, fontSize:'14px', padding:'10px 16px', borderRadius:'10px', border:'none', cursor:'pointer' }
export const btnSec = { background:'var(--surface2)', color:'var(--text)', fontWeight:700, fontSize:'13px', padding:'9px 14px', borderRadius:'10px', border:'1px solid var(--border-light)', cursor:'pointer' }

// ---------- count-up hook ----------
export function useCountUp(value, duration=900) {
  const [display, setDisplay] = React.useState(value)
  React.useEffect(() => {
    const m = String(value).match(/-?[\d,]+(\.\d+)?/)
    if (!m) { setDisplay(value); return }
    const target = parseFloat(m[0].replace(/,/g,'')) || 0
    const prefix = String(value).slice(0, m.index)
    const suffix = String(value).slice(m.index + m[0].length)
    const decimals = (m[0].split('.')[1]||'').length
    const start = performance.now()
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const cur = target * eased
      const fmt = cur.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      setDisplay(prefix + fmt + suffix)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return display
}

// ---------- primitives ----------
export function KPI({label,value,color,sub,onClick}) {
  const shown = useCountUp(value)
  return <div data-card onClick={onClick} style={{...card, padding:'20px', cursor: onClick?'pointer':'default'}}>
    <div style={{ fontSize:'12px', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:600 }}>{label}</div>
    <div className="mono" style={{ fontSize:'26px', fontWeight:600, marginTop:'6px', letterSpacing:'-0.5px', color: color||'var(--text)' }}>{shown}</div>
    {sub && <div style={{ fontSize:'12px', color:'var(--text3)', marginTop:'6px' }}>{sub}</div>}
  </div>
}

export function Empty({msg}) {
  return <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)', fontSize:'14px' }}>{msg}</div>
}

// Parse a UK-style date string to an ISO `YYYY-MM-DD`, or null if it can't be
// parsed into a real calendar date. Never returns a malformed/invalid string —
// callers rely on null to skip a row rather than send bad input to Postgres.
//
// Accepts (separators / - .):
//   - DD/MM/YYYY  (UK day-first)
//   - DD/MM/YY    (two-digit year → 2000+YY; bank exports are recent dates)
//   - YYYY-MM-DD  (ISO / year-first)
// The result is range-checked AND round-tripped through Date so impossible
// dates (13 as a month, 31/02, US-order 05/13/2024, etc.) resolve to null.
export function parseDate(t) {
  if (t == null) return null
  t = String(t).trim()
  let y, mo, d, m
  if ((m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/))) {
    y = +m[1]; mo = +m[2]; d = +m[3]
  } else if ((m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/))) {
    d = +m[1]; mo = +m[2]; y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
  } else {
    return null
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const iso = `${String(y).padStart(4,'0')}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const chk = new Date(`${iso}T00:00:00Z`)
  if (isNaN(chk.getTime()) || chk.getUTCMonth()+1 !== mo || chk.getUTCDate() !== d) return null
  return iso
}

// Lenient email sanity check: something, an @, a domain with a dot. Deliberately
// permissive — catches obvious typos (missing @ / domain) without rejecting
// unusual-but-valid addresses (plus tags, subdomains, long TLDs).
export function isEmailish(s) {
  return /^\S+@\S+\.\S+$/.test((s || '').trim())
}

export function DateField({ value, onChange, style }) {
  const toText = (iso) => { if(!iso) return ''; const [y,m,d]=iso.split('-'); return d&&m&&y ? `${d}/${m}/${y}` : iso }
  const [text, setText] = React.useState(toText(value))
  React.useEffect(()=>{ setText(toText(value)) }, [value])
  const parse = parseDate
  return (
    <div style={{ display:'flex', gap:'6px', ...style }}>
      <input style={{...inp, flex:1}} placeholder="DD/MM/YYYY" value={text}
        onChange={e=>{ setText(e.target.value); const iso=parse(e.target.value); if(iso) onChange(iso) }}
        onBlur={()=>{ const iso=parse(text); if(iso) onChange(iso); else setText(toText(value)) }} />
      <input type="date" value={value||''} onChange={e=>onChange(e.target.value)}
        style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'0 10px', color:'var(--text)', width:'52px', minWidth:'52px', cursor:'pointer', colorScheme:'inherit' }} title="Pick from calendar" />
    </div>
  )
}

export function Th({cols}) {
  return <tr>{cols.map((c,i)=><th key={i} style={{ textAlign: i>=cols.length-2?'right':'left', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text3)', fontWeight:700, padding:'0 14px 12px', borderBottom:'1px solid var(--border)' }}>{c}</th>)}</tr>
}

export function Td({children,mono,muted,right,style}) {
  return <td style={{ padding:'14px', borderBottom:'1px solid var(--border)', fontSize:'13.5px', textAlign:right?'right':'left', color:muted?'var(--text3)':'var(--text)', fontFamily:mono?'Fira Code, monospace':'inherit', ...style }}>{children}</td>
}

export function Row({left,mid,right,status}) {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'13.5px' }}>
    <span>{left} <span className="mono" style={{color:'var(--text3)', fontSize:'12px'}}>{mid}</span></span>
    <span style={{display:'flex',gap:'10px',alignItems:'center'}}><span className="mono">{right}</span><Status s={status}/></span>
  </div>
}

export function Status({s}) {
  const map = { paid:['var(--green)','rgba(34,197,94,.12)'], sent:['var(--blue)','rgba(59,130,246,.12)'], overdue:['var(--red)','rgba(239,68,68,.12)'], draft:['var(--text2)','var(--surface3)'] }
  const [c,bg] = map[s]||map.draft
  return <span style={{ padding:'3px 10px', borderRadius:'7px', fontSize:'11px', fontWeight:700, textTransform:'uppercase', color:c, background:bg }}>{s}</span>
}

export function Line({label,v,bold}) {
  return <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', fontSize:'14px' }}><span style={{color:'var(--text2)'}}>{label}</span><span className="mono" style={{fontWeight:bold?700:500}}>{v}</span></div>
}

export function Check({ok,t}) {
  return <div style={{ display:'flex', alignItems:'center', gap:'12px', fontSize:'14px', padding:'8px 0' }}><span style={{ width:'22px', height:'22px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', background: ok?'rgba(34,197,94,.12)':'var(--surface3)', color: ok?'var(--green)':'var(--text3)', fontWeight:700, fontSize:'13px' }}>{ok?'✓':'!'}</span>{t}</div>
}

export function Modal({title,children,onClose}) {
  return createPortal(
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'20px' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', border:'1px solid var(--border-light)', borderRadius:'18px', padding:'28px', width:'420px', maxWidth:'100%', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div style={{ fontSize:'18px', fontWeight:800 }}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text2)', fontSize:'20px', cursor:'pointer' }}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

export function ErrBox({m}) {
  return <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--red)', marginBottom:'14px' }}>{m}</div>
}
