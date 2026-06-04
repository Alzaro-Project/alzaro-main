// ============================================================
//  Alzaro SoloOps — Dashboard
//  Loaded by app.html via <script type="text/babel">.
//  Uses CDN globals (React, ReactDOM) + window.sb from supabase.js.
//  Reads LIVE data from soloops_* tables. Includes auth gate
//  and add-forms for expenses & invoices.
// ============================================================
const { useState, useEffect } = React

const CATEGORIES = ['Fuel','Travel','Software','Marketing','Equipment','Insurance','Utilities','Professional Services','Office Costs','Other']
const CAT_COLORS = { Software:'#f97316', Fuel:'#f59e0b', Marketing:'#3b82f6', Equipment:'#22c55e', Travel:'#eab308', Insurance:'#a78bfa', Utilities:'#38bdf8', 'Professional Services':'#fb7185', 'Office Costs':'#94a3b8', Other:'#68635d' }
const gbp = n => '£' + (Number(n)||0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

// ---- styles ----
const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'22px' }
const inp = { background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'11px 14px', color:'var(--text)', fontSize:'14px', outline:'none', width:'100%' }
const grad = 'linear-gradient(135deg, var(--orange), var(--amber))'
const btnPri = { background:grad, color:'#000', fontWeight:700, fontSize:'14px', padding:'10px 16px', borderRadius:'10px', border:'none', cursor:'pointer' }
const btnSec = { background:'var(--surface2)', color:'var(--text)', fontWeight:700, fontSize:'13px', padding:'9px 14px', borderRadius:'10px', border:'1px solid var(--border-light)', cursor:'pointer' }

const NAV = [
  ['dashboard','Dashboard'], ['income','Income'], ['expenses','Expenses'],
  ['banking','Banking'], ['recurring','Recurring'], ['receipts','Receipts'], ['mileage','Mileage'],
  ['reports','Reports'], ['documents','Documents'], ['tax','Tax'], ['settings','Settings']
]

function App() {
  const [session, setSession] = useState(undefined) // undefined=loading, null=logged out
  const [view, setView] = useState('dashboard')
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [mileage, setMileage] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'expense' | 'invoice' | null
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState('dark')
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
  }, [theme])

  // ---- auth gate ----
  useEffect(() => {
    window.sb.auth.getSession().then(({ data }) => {
      setSession(data.session || null)
    })
    const { data: sub } = window.sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // ---- load live data once logged in ----
  const loadAll = async () => {
    setLoading(true)
    // Access gate: this account must have signed up for SoloOps.
    // (Stops someone reaching dashboard.html directly with a non-SoloOps account.)
    const { data: sess } = await window.sb.auth.getSession()
    const uid = sess?.session?.user?.id
    if (uid) {
      const { data: access } = await window.sb
        .from('soloops_access').select('user_id').eq('user_id', uid).maybeSingle()
      if (!access) {
        await window.sb.auth.signOut()
        window.location.href = '/soloops/login'
        return
      }
    }
    const [inv, exp, mil] = await Promise.all([
      window.sb.from('soloops_invoices').select('*').order('issue_date', { ascending: false }),
      window.sb.from('soloops_expenses').select('*').order('spent_on', { ascending: false }),
      window.sb.from('soloops_mileage').select('*').order('journey_date', { ascending: false }),
    ])
    setInvoices(inv.data || [])
    setExpenses(exp.data || [])
    setMileage(mil.data || [])
    setLoading(false)
  }
  useEffect(() => { if (session) loadAll() }, [session])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3000) }
  const signOut = async () => { await window.sb.auth.signOut(); window.location.href = '/soloops/login' }

  // ---- derived totals ----
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s,i)=>s+Number(i.total||0),0)
  const totalExp = expenses.reduce((s,e)=>s+Number(e.amount||0),0)
  const profit = revenue - totalExp
  const estTax = Math.max(0, profit * 0.20 + Math.max(0,(profit-12570))*0.09) // rough estimate only
  const outstanding = invoices.filter(i => i.status==='sent' || i.status==='overdue').reduce((s,i)=>s+Number(i.total||0),0)

  // category breakdown
  const byCat = {}
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category]||0) + Number(e.amount||0) })
  const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1])

  if (session === undefined)
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}>Loading…</div>

  if (session === null) {
    // not logged in → bounce to login
    window.location.href = '/soloops/login'
    return null
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'230px 1fr', minHeight:'100vh' }}>
      {/* SIDEBAR */}
      <aside style={{ background:'var(--surface)', borderRight:'1px solid var(--border)', padding:'22px 16px', position:'sticky', top:0, height:'100vh', display:'flex', flexDirection:'column', gap:'4px' }}>
        <div style={{ fontSize:'20px', fontWeight:800, letterSpacing:'-0.5px', padding:'6px 12px 22px' }}>Alzaro <span style={{color:'var(--orange)'}}>SoloOps</span></div>
        {NAV.map(([k,label]) => (
          <div key={k} data-nav onClick={()=>setView(k)} style={{
            padding:'11px 14px', borderRadius:'10px', fontSize:'14px', fontWeight:600, cursor:'pointer',
            color: view===k ? 'var(--text)' : 'var(--text2)',
            background: view===k ? 'var(--surface3)' : 'transparent',
            border: view===k ? '1px solid var(--border-light)' : '1px solid transparent'
          }}>{label}</div>
        ))}
        <div style={{ flex:1 }} />
        <div style={{ fontSize:'12px', color:'var(--text3)', padding:'0 12px 8px', wordBreak:'break-all' }}>{session.user.email}</div>
        <button onClick={()=>setTheme(theme==='dark'?'light':'dark')} style={{...btnSec, width:'100%', marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}>
          {theme==='dark' ? '☀ Light mode' : '🌙 Dark mode'}
        </button>
        <button onClick={signOut} style={{...btnSec, width:'100%'}}>Sign out</button>
      </aside>

      {/* MAIN */}
      <div style={{ minWidth:0 }}>
        {/* topbar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 28px', borderBottom:'1px solid var(--border)' }}>
          <h1 style={{ fontSize:'20px', fontWeight:800 }}>{NAV.find(n=>n[0]===view)[1]}</h1>
          <div style={{ display:'flex', gap:'10px' }}>
            <button style={btnSec} onClick={()=>setModal('expense')}>+ Expense</button>
            <button style={btnPri} onClick={()=>setModal('invoice')}>+ Invoice</button>
          </div>
        </div>

        <div style={{ padding:'28px' }} className="fade-in">
          {loading ? <div style={{color:'var(--text2)'}}>Loading your data…</div> : <>

          {/* ===== DASHBOARD ===== */}
          {view==='dashboard' && <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'16px' }}>
              <div data-pop style={{animationDelay:'0ms'}}><KPI label="Revenue (paid)" value={gbp(revenue)} onClick={()=>setView('income')} /></div>
              <div data-pop style={{animationDelay:'60ms'}}><KPI label="Expenses" value={gbp(totalExp)} onClick={()=>setView('expenses')} /></div>
              <div data-pop style={{animationDelay:'120ms'}}><KPI label="Profit" value={gbp(profit)} color={profit>=0?'var(--green)':'var(--red)'} onClick={()=>setView('reports')} /></div>
              <div data-pop style={{animationDelay:'180ms'}}><KPI label="Est. tax" value={gbp(estTax)} color="var(--amber)" sub="estimate only" onClick={()=>setView('tax')} /></div>
            </div>

            {/* monthly revenue vs expenses chart */}
            <div onClick={()=>setView('reports')} style={{cursor:'pointer'}}><MonthlyChart invoices={invoices} expenses={expenses} /></div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div data-card onClick={()=>setView('expenses')} style={{...card, cursor:'pointer'}}>
                <div style={{fontWeight:700, marginBottom:'4px'}}>Expense breakdown</div>
                <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>By category</div>
                {catRows.length===0 ? <Empty msg="No expenses yet — add your first one." />
                  : <Donut rows={catRows} />}
              </div>
              <div data-card onClick={()=>setView('income')} style={{...card, cursor:'pointer'}}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                  <div style={{fontWeight:700}}>Outstanding invoices</div>
                  <span className="mono" style={{ color:'var(--orange-light)', fontWeight:600 }}>{gbp(outstanding)}</span>
                </div>
                <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Awaiting payment</div>
                {invoices.filter(i=>i.status!=='paid').length===0 ? <Empty msg="No outstanding invoices." />
                  : invoices.filter(i=>i.status!=='paid').slice(0,6).map(i => (
                  <Row key={i.id} left={i.client_name||'—'} mid={i.number||''} right={gbp(i.total)} status={i.status} />
                ))}
              </div>
            </div>
          </>}

          {/* ===== INCOME ===== */}
          {view==='income' && (
            <div style={card}>
              {invoices.length===0 ? <Empty msg="No invoices yet. Click “+ Invoice” to create one." />
              : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><Th cols={['Invoice','Client','Issued','Total','Status']} /></thead>
                <tbody>{invoices.map(i => (
                  <tr key={i.id}>
                    <Td mono>{i.number||'—'}</Td><Td>{i.client_name||'—'}</Td>
                    <Td muted>{i.issue_date}</Td><Td mono right>{gbp(i.total)}</Td>
                    <Td right><Status s={i.status}/></Td>
                  </tr>))}</tbody>
              </table>}
            </div>
          )}

          {/* ===== EXPENSES ===== */}
          {view==='expenses' && (
            <div style={card}>
              {expenses.length===0 ? <Empty msg="No expenses yet. Click “+ Expense” to add one." />
              : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><Th cols={['Date','Merchant','Category','Amount']} /></thead>
                <tbody>{expenses.map(e => (
                  <tr key={e.id}>
                    <Td muted mono>{e.spent_on}</Td><Td>{e.merchant} {e.has_receipt && <span style={{ fontSize:'10.5px', color:'var(--green)', border:'1px solid rgba(34,197,94,.4)', borderRadius:'20px', padding:'1px 7px', marginLeft:'6px' }}>receipt</span>}</Td>
                    <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{e.category}</span></Td>
                    <Td mono right>{gbp(e.amount)}</Td>
                  </tr>))}</tbody>
              </table>}
            </div>
          )}

          {/* ===== BANKING / CSV IMPORT ===== */}
          {view==='banking' && (
            <BankImport uid={session.user.id} existingExpenses={expenses} onImported={()=>{loadAll();flash('Transactions imported')}} />
          )}

          {/* ===== RECURRING / SUBSCRIPTIONS ===== */}
          {view==='recurring' && (
            <Recurring expenses={expenses} />
          )}

          {/* ===== RECEIPTS / MATCHING ===== */}
          {view==='receipts' && (
            <Receipts uid={session.user.id} expenses={expenses} onMatched={()=>{loadAll();flash('Receipt attached')}} />
          )}

          {/* ===== REPORTS ===== */}
          {view==='reports' && (
            <Reports invoices={invoices} expenses={expenses} mileage={mileage} />
          )}

          {/* ===== DOCUMENTS ===== */}
          {view==='documents' && (
            <Documents uid={session.user.id} invoices={invoices} expenses={expenses} />
          )}

          {/* ===== MILEAGE ===== */}
          {view==='mileage' && (() => {
            const totalMiles = mileage.reduce((s,m)=>s+(Number(m.miles)||0),0)
            // HMRC AMAP: 45p/mile first 10,000 miles, 25p after (cars/vans)
            const first = Math.min(totalMiles, 10000)
            const over = Math.max(0, totalMiles - 10000)
            const claim = first * 0.45 + over * 0.25
            const downloadReport = () => {
              const rows = [['Date','From','To','Purpose','Miles']]
              mileage.forEach(m => rows.push([m.journey_date||'', m.start_loc||'', m.end_loc||'', (m.purpose||'').replace(/,/g,' '), m.miles||0]))
              rows.push([])
              rows.push(['Total miles', totalMiles])
              rows.push(['First 10,000 miles @ 45p', (first*0.45).toFixed(2)])
              rows.push(['Over 10,000 miles @ 25p', (over*0.25).toFixed(2)])
              rows.push(['Total claim (GBP)', claim.toFixed(2)])
              const csv = rows.map(r => r.join(',')).join('\n')
              const blob = new Blob([csv], { type:'text/csv' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = 'soloops-mileage-report.csv'
              a.click()
            }
            return (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'16px' }}>
                <KPI label="Total miles" value={totalMiles.toLocaleString('en-GB')} />
                <KPI label="HMRC claim" value={gbp(claim)} color="var(--green)" sub="45p/25p AMAP split" />
                <KPI label="Journeys" value={mileage.length} />
              </div>
              <div style={card}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                  <div>
                    <div style={{fontWeight:700}}>Mileage log</div>
                    <div style={{fontSize:'12.5px', color:'var(--text3)'}}>HMRC approved rates: 45p/mile up to 10,000, 25p after</div>
                  </div>
                  <div style={{ display:'flex', gap:'10px' }}>
                    {mileage.length>0 && <button style={btnSec} onClick={downloadReport}>Download HMRC report</button>}
                    <button style={btnPri} onClick={()=>setModal('mileage')}>+ Log journey</button>
                  </div>
                </div>
                {mileage.length===0 ? <Empty msg="No journeys logged yet. Click “+ Log journey” to add one." />
                : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><Th cols={['Date','From','To','Purpose','Miles','Claim']} /></thead>
                  <tbody>{mileage.map(m => (
                    <tr key={m.id}>
                      <Td muted mono>{m.journey_date}</Td><Td>{m.start_loc}</Td><Td>{m.end_loc}</Td>
                      <Td muted>{m.purpose}</Td><Td mono right>{m.miles}</Td>
                      <Td mono right style={{color:'var(--green)'}}>{gbp(m.claim)}</Td>
                    </tr>))}</tbody>
                </table>}
              </div>
            </>
            )
          })()}

          {/* ===== TAX ===== */}
          {view==='tax' && (
            <>
            <div style={{ background:'var(--amber-soft, rgba(245,158,11,0.1))', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'12px', padding:'14px 18px', marginBottom:'16px', fontSize:'13px', color:'var(--text2)', lineHeight:1.6 }}>
              <strong style={{color:'var(--amber)'}}>⚠ Estimate only — not tax advice.</strong> These figures are a rough guide based on simplified UK rates and your recorded income and expenses. They are not a substitute for professional advice or an official HMRC calculation. Always confirm your actual liability with an accountant or HMRC before filing.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div style={card}>
                <div style={{fontWeight:700, marginBottom:'4px'}}>Estimated tax</div>
                <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Rough estimate — not tax advice</div>
                <Line label="Taxable profit" v={gbp(profit)} />
                <Line label="Income tax (est.)" v={gbp(Math.max(0,profit*0.20))} />
                <Line label="National Insurance (est.)" v={gbp(Math.max(0,(profit-12570)*0.09))} />
                <div style={{ borderTop:'1px solid var(--border)', marginTop:'10px', paddingTop:'12px' }}>
                  <Line label="Total estimated" v={gbp(estTax)} bold />
                </div>
              </div>
              <div style={card}>
                <div style={{fontWeight:700, marginBottom:'16px'}}>Self Assessment readiness</div>
                <Check ok={invoices.length>0} t="Income recorded" />
                <Check ok={expenses.length>0} t="Expenses recorded" />
                <Check ok={mileage.length>0} t="Mileage logged" />
              </div>
            </div>
            </>
          )}

          {/* ===== SETTINGS ===== */}
          {view==='settings' && (
            <div style={{...card, maxWidth:'480px'}}>
              <div style={{fontWeight:700, marginBottom:'16px'}}>Account</div>
              <Line label="Email" v={session.user.email} />
              <Line label="Business" v={session.user.user_metadata?.business_name || '—'} />
              <Line label="Plan" v="Gold · 14-day trial" />
              <button onClick={signOut} style={{...btnSec, marginTop:'18px'}}>Sign out</button>
            </div>
          )}

          </>}
        </div>
      </div>

      {/* MODALS */}
      {modal==='expense' && <ExpenseForm onClose={()=>setModal(null)} onSaved={()=>{setModal(null);loadAll();flash('Expense added')}} uid={session.user.id} />}
      {modal==='invoice' && <InvoiceForm onClose={()=>setModal(null)} onSaved={()=>{setModal(null);loadAll();flash('Invoice created')}} uid={session.user.id} />}
      {modal==='mileage' && <MileageForm onClose={()=>setModal(null)} onSaved={()=>{setModal(null);loadAll();flash('Journey logged')}} uid={session.user.id} mileage={mileage} />}

      {/* TOAST */}
      {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'var(--surface2)', border:'1px solid var(--border-light)', borderLeft:'3px solid var(--orange)', borderRadius:'12px', padding:'14px 18px', fontSize:'13.5px', boxShadow:'0 14px 40px rgba(0,0,0,.5)', zIndex:200 }}>✓ {toast}</div>}
    </div>
  )
}

// ---------- small components ----------
function useCountUp(value, duration=900) {
  // animate numbers in £x,xxx or plain-number strings up from 0
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

function KPI({label,value,color,sub,onClick}) {
  const shown = useCountUp(value)
  return <div data-card onClick={onClick} style={{...card, padding:'20px', cursor: onClick?'pointer':'default'}}>
    <div style={{ fontSize:'12px', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:600 }}>{label}</div>
    <div className="mono" style={{ fontSize:'26px', fontWeight:600, marginTop:'6px', letterSpacing:'-0.5px', color: color||'var(--text)' }}>{shown}</div>
    {sub && <div style={{ fontSize:'12px', color:'var(--text3)', marginTop:'6px' }}>{sub}</div>}
  </div>
}
function MonthlyChart({ invoices, expenses }) {
  const ym = d => (d||'').slice(0,7)
  const now = new Date()
  const months = []
  for (let i=5; i>=0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth()-i, 1)
    months.push({ key: dt.toISOString().slice(0,7), label: dt.toLocaleDateString('en-GB',{month:'short'}) })
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
      {!hasData ? <Empty msg="No data yet — add invoices and expenses to see your trend." />
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
function Donut({ rows }) {
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
function Empty({msg}) { return <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--text3)', fontSize:'14px' }}>{msg}</div> }
function Th({cols}) { return <tr>{cols.map((c,i)=><th key={i} style={{ textAlign: i>=cols.length-2?'right':'left', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text3)', fontWeight:700, padding:'0 14px 12px', borderBottom:'1px solid var(--border)' }}>{c}</th>)}</tr> }
function Td({children,mono,muted,right,style}) { return <td style={{ padding:'14px', borderBottom:'1px solid var(--border)', fontSize:'13.5px', textAlign:right?'right':'left', color:muted?'var(--text3)':'var(--text)', fontFamily:mono?'Fira Code, monospace':'inherit', ...style }}>{children}</td> }
function Row({left,mid,right,status}) {
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'13.5px' }}>
    <span>{left} <span className="mono" style={{color:'var(--text3)', fontSize:'12px'}}>{mid}</span></span>
    <span style={{display:'flex',gap:'10px',alignItems:'center'}}><span className="mono">{right}</span><Status s={status}/></span>
  </div>
}
function Status({s}) {
  const map = { paid:['var(--green)','rgba(34,197,94,.12)'], sent:['var(--blue)','rgba(59,130,246,.12)'], overdue:['var(--red)','rgba(239,68,68,.12)'], draft:['var(--text2)','var(--surface3)'] }
  const [c,bg] = map[s]||map.draft
  return <span style={{ padding:'3px 10px', borderRadius:'7px', fontSize:'11px', fontWeight:700, textTransform:'uppercase', color:c, background:bg }}>{s}</span>
}
function Line({label,v,bold}) { return <div style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', fontSize:'14px' }}><span style={{color:'var(--text2)'}}>{label}</span><span className="mono" style={{fontWeight:bold?700:500}}>{v}</span></div> }
function Check({ok,t}) { return <div style={{ display:'flex', alignItems:'center', gap:'12px', fontSize:'14px', padding:'8px 0' }}><span style={{ width:'22px', height:'22px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', background: ok?'rgba(34,197,94,.12)':'var(--surface3)', color: ok?'var(--green)':'var(--text3)', fontWeight:700, fontSize:'13px' }}>{ok?'✓':'!'}</span>{t}</div> }

// ---------- add-expense form (with smart category suggestion) ----------
function ExpenseForm({onClose,onSaved,uid}) {
  const [merchant,setMerchant]=useState(''); const [category,setCategory]=useState('Other')
  const [amount,setAmount]=useState(''); const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')

  // smart suggestion: check learned rules as user types merchant
  const suggest = async (m) => {
    setMerchant(m)
    if (m.length < 3) return
    const { data } = await window.sb.from('soloops_rules').select('*')
    const hit = (data||[]).find(r => m.toUpperCase().includes(r.pattern.toUpperCase()))
    if (hit) setCategory(hit.category)
  }
  const save = async () => {
    if(!merchant||!amount) return setErr('Merchant and amount are required')
    setBusy(true); setErr('')
    const { error } = await window.sb.from('soloops_expenses').insert({
      user_id:uid, merchant:merchant.trim(), category, amount:Number(amount), spent_on:date, source:'manual'
    })
    if(error){ setErr(error.message); setBusy(false); return }
    // learn the rule so future merchants auto-categorise
    await window.sb.from('soloops_rules').upsert({ user_id:uid, pattern:merchant.trim().split(' ')[0].toUpperCase(), category }, { onConflict:'user_id,pattern', ignoreDuplicates:true }).then(()=>{}).catch(()=>{})
    onSaved()
  }
  return <Modal title="Add expense" onClose={onClose}>
    {err && <ErrBox m={err} />}
    <input style={inp} placeholder="Merchant (e.g. Adobe UK)" value={merchant} onChange={e=>suggest(e.target.value)} />
    <select style={{...inp, marginTop:'12px'}} value={category} onChange={e=>setCategory(e.target.value)}>
      {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
    </select>
    <input style={{...inp, marginTop:'12px'}} type="number" placeholder="Amount (£)" value={amount} onChange={e=>setAmount(e.target.value)} />
    <input style={{...inp, marginTop:'12px'}} type="date" value={date} onChange={e=>setDate(e.target.value)} />
    <button style={{...btnPri, width:'100%', marginTop:'16px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':'Save expense'}</button>
  </Modal>
}

// ---------- add-invoice form ----------
function InvoiceForm({onClose,onSaved,uid}) {
  const [client,setClient]=useState(''); const [number,setNumber]=useState('')
  const [total,setTotal]=useState(''); const [status,setStatus]=useState('sent')
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const save = async () => {
    if(!client||!total) return setErr('Client and total are required')
    setBusy(true); setErr('')
    const { error } = await window.sb.from('soloops_invoices').insert({
      user_id:uid, client_name:client.trim(), number:number.trim()||null, total:Number(total), status, issue_date:date
    })
    if(error){ setErr(error.message); setBusy(false); return }
    onSaved()
  }
  return <Modal title="Create invoice" onClose={onClose}>
    {err && <ErrBox m={err} />}
    <input style={inp} placeholder="Client name" value={client} onChange={e=>setClient(e.target.value)} />
    <input style={{...inp, marginTop:'12px'}} placeholder="Invoice number (e.g. INV-0001)" value={number} onChange={e=>setNumber(e.target.value)} />
    <input style={{...inp, marginTop:'12px'}} type="number" placeholder="Total (£)" value={total} onChange={e=>setTotal(e.target.value)} />
    <select style={{...inp, marginTop:'12px'}} value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
    </select>
    <input style={{...inp, marginTop:'12px'}} type="date" value={date} onChange={e=>setDate(e.target.value)} />
    <button style={{...btnPri, width:'100%', marginTop:'16px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':'Save invoice'}</button>
  </Modal>
}

function Modal({title,children,onClose}) {
  return <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'20px' }}>
    <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', border:'1px solid var(--border-light)', borderRadius:'18px', padding:'28px', width:'420px', maxWidth:'100%' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
        <div style={{ fontSize:'18px', fontWeight:800 }}>{title}</div>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--text2)', fontSize:'20px', cursor:'pointer' }}>×</button>
      </div>
      {children}
    </div>
  </div>
}
function ErrBox({m}) { return <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--red)', marginBottom:'14px' }}>{m}</div> }

// ---------- REPORTS ----------
function Reports({ invoices, expenses, mileage }) {
  const [msg, setMsg] = React.useState('')

  const download = (filename, rows) => {
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = filename; a.click()
    setMsg('Downloaded ' + filename); setTimeout(()=>setMsg(''), 2500)
  }

  const ym = d => (d||'').slice(0,7)            // YYYY-MM
  const yr = d => (d||'').slice(0,4)            // YYYY
  const quarter = d => { const m = parseInt((d||'0-0').slice(5,7)); return 'Q' + (Math.ceil(m/3)||0) }
  const sum = (arr,f) => arr.reduce((s,x)=>s+(Number(f(x))||0),0)

  const paid = invoices.filter(i => i.status === 'paid')
  const totalRev = sum(paid, i=>i.total)
  const totalExp = sum(expenses, e=>e.amount)

  // group helper
  const groupBy = (arr, keyFn, valFn) => {
    const g = {}
    arr.forEach(x => { const k = keyFn(x); g[k] = (g[k]||0) + (Number(valFn(x))||0) })
    return Object.entries(g).sort()
  }

  const reports = [
    { id:'profit', name:'Profit & loss', desc:'Revenue, expenses, net profit', build: () => {
      const rows = [['Profit & Loss Report'],['Generated', new Date().toLocaleDateString('en-GB')],[],
        ['Revenue (paid invoices)', totalRev.toFixed(2)],
        ['Total expenses', totalExp.toFixed(2)],
        ['Net profit', (totalRev-totalExp).toFixed(2)]]
      return ['soloops-profit-loss.csv', rows]
    }},
    { id:'monthly', name:'Monthly report', desc:'Revenue & expenses by month', build: () => {
      const rev = Object.fromEntries(groupBy(paid, i=>ym(i.issue_date), i=>i.total))
      const exp = Object.fromEntries(groupBy(expenses, e=>ym(e.spent_on), e=>e.amount))
      const months = [...new Set([...Object.keys(rev),...Object.keys(exp)])].sort()
      const rows = [['Month','Revenue','Expenses','Profit'],
        ...months.map(m => [m, (rev[m]||0).toFixed(2), (exp[m]||0).toFixed(2), ((rev[m]||0)-(exp[m]||0)).toFixed(2)])]
      return ['soloops-monthly.csv', rows]
    }},
    { id:'quarterly', name:'Quarterly report', desc:'Revenue & expenses by quarter', build: () => {
      const rev = Object.fromEntries(groupBy(paid, i=>yr(i.issue_date)+' '+quarter(i.issue_date), i=>i.total))
      const exp = Object.fromEntries(groupBy(expenses, e=>yr(e.spent_on)+' '+quarter(e.spent_on), e=>e.amount))
      const qs = [...new Set([...Object.keys(rev),...Object.keys(exp)])].sort()
      const rows = [['Quarter','Revenue','Expenses','Profit'],
        ...qs.map(q => [q, (rev[q]||0).toFixed(2), (exp[q]||0).toFixed(2), ((rev[q]||0)-(exp[q]||0)).toFixed(2)])]
      return ['soloops-quarterly.csv', rows]
    }},
    { id:'annual', name:'Annual report', desc:'Revenue & expenses by year', build: () => {
      const rev = Object.fromEntries(groupBy(paid, i=>yr(i.issue_date), i=>i.total))
      const exp = Object.fromEntries(groupBy(expenses, e=>yr(e.spent_on), e=>e.amount))
      const ys = [...new Set([...Object.keys(rev),...Object.keys(exp)])].sort()
      const rows = [['Year','Revenue','Expenses','Profit'],
        ...ys.map(y => [y, (rev[y]||0).toFixed(2), (exp[y]||0).toFixed(2), ((rev[y]||0)-(exp[y]||0)).toFixed(2)])]
      return ['soloops-annual.csv', rows]
    }},
    { id:'expense', name:'Expense report', desc:'All expenses by category', build: () => {
      const byCat = groupBy(expenses, e=>e.category||'Other', e=>e.amount)
      const rows = [['Expense Report by Category'],[],['Category','Total'],
        ...byCat.map(([c,v]) => [c, v.toFixed(2)]),[],
        ['Line items'],['Date','Merchant','Category','Amount'],
        ...expenses.map(e => [e.spent_on, e.merchant, e.category, Number(e.amount).toFixed(2)])]
      return ['soloops-expenses.csv', rows]
    }},
    { id:'income', name:'Income report', desc:'All invoices & payments', build: () => {
      const rows = [['Income Report'],[],['Invoice','Client','Issued','Status','Total'],
        ...invoices.map(i => [i.number||'', i.client_name||'', i.issue_date||'', i.status||'', Number(i.total).toFixed(2)]),[],
        ['Total invoiced', sum(invoices,i=>i.total).toFixed(2)],
        ['Total paid', totalRev.toFixed(2)]]
      return ['soloops-income.csv', rows]
    }},
    { id:'tax', name:'Tax summary', desc:'Annual SA-ready summary (estimate)', build: () => {
      const profit = totalRev - totalExp
      const incomeTax = Math.max(0, profit*0.20)
      const nic = Math.max(0,(profit-12570)*0.09)
      const rows = [['Tax Summary (ESTIMATE ONLY — not tax advice)'],
        ['Generated', new Date().toLocaleDateString('en-GB')],[],
        ['Revenue (paid)', totalRev.toFixed(2)],
        ['Allowable expenses', totalExp.toFixed(2)],
        ['Mileage claim', (sum(mileage,m=>m.claim)).toFixed(2)],
        ['Taxable profit', profit.toFixed(2)],
        ['Income tax (est. @20%)', incomeTax.toFixed(2)],
        ['National Insurance (est.)', nic.toFixed(2)],
        ['Total estimated tax', (incomeTax+nic).toFixed(2)]]
      return ['soloops-tax-summary.csv', rows]
    }},
  ]

  return (
    <div style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px', gap:'12px', flexWrap:'wrap' }}>
        <div style={{fontWeight:700}}>Reports</div>
        <button style={btnPri} onClick={async () => {
          try {
            const zip = new window.JSZip()
            reports.forEach(r => { const [fn, rows] = r.build(); zip.file(fn, rows.map(row => row.map(c => {
              const s = String(c ?? ''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s
            }).join(',')).join('\n')) })
            const blob = await zip.generateAsync({ type:'blob' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
            a.download = 'soloops-accountant-pack-' + new Date().toISOString().slice(0,10) + '.zip'; a.click()
            setMsg('Accountant pack downloaded (all reports zipped)'); setTimeout(()=>setMsg(''), 3000)
          } catch (e) { setMsg('Could not build pack: ' + (e.message||'')); setTimeout(()=>setMsg(''), 4000) }
        }}>⬇ Accountant export pack</button>
      </div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Generate and download reports from your data (CSV — opens in Excel/Sheets). The accountant pack zips them all together.</div>
      {msg && <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--green)', marginBottom:'14px' }}>✓ {msg}</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
        {reports.map(r => (
          <div key={r.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'12px' }}>
            <div>
              <div style={{ fontWeight:700, fontSize:'14px' }}>{r.name}</div>
              <div style={{ fontSize:'12px', color:'var(--text3)' }}>{r.desc}</div>
            </div>
            <button style={{...btnSec, whiteSpace:'nowrap'}} onClick={()=>{ const [fn,rows]=r.build(); download(fn,rows) }}>Download</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- DOCUMENTS ----------
function Documents({ uid, invoices, expenses }) {
  const [q, setQ] = React.useState('')
  const [files, setFiles] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [docType, setDocType] = React.useState('Statement')
  const [err, setErr] = React.useState('')

  const load = () => {
    setLoading(true)
    window.sb.from('soloops_documents').select('*').order('uploaded_at',{ascending:false})
      .then(({ data }) => { setFiles(data||[]); setLoading(false) })
  }
  React.useEffect(load, [])

  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true); setErr('')
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${uid}/${crypto.randomUUID()}-${safe}`
      const { error: upErr } = await window.sb.storage.from('soloops-files').upload(path, f)
      if (upErr) throw upErr
      await window.sb.from('soloops_documents').insert({
        user_id: uid, type: docType, name: f.name, storage_path: path, size_bytes: f.size
      })
      load()
    } catch (e) { setErr(e.message || 'Upload failed') }
    setBusy(false)
  }

  const download = async (path, name) => {
    try {
      const { data, error } = await window.sb.storage.from('soloops-files').createSignedUrl(path, 60)
      if (error) throw error
      const a = document.createElement('a'); a.href = data.signedUrl; a.download = name || 'file'; a.target = '_blank'; a.click()
    } catch (e) { setErr(e.message || 'Could not get download link') }
  }

  const remove = async (id, path) => {
    setBusy(true)
    try {
      await window.sb.storage.from('soloops-files').remove([path])
      await window.sb.from('soloops_documents').delete().eq('id', id)
      load()
    } catch (e) { setErr(e.message || 'Could not delete') }
    setBusy(false)
  }

  const kb = b => b ? (b/1024 < 1024 ? Math.round(b/1024)+' KB' : (b/1048576).toFixed(1)+' MB') : '—'
  const filtered = files.filter(d => !q || (d.name+' '+d.type).toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px', gap:'12px', flexWrap:'wrap' }}>
        <div style={{fontWeight:700}}>Documents</div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <input style={{...inp, width:'180px', padding:'8px 12px'}} placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          <select style={{...inp, width:'auto', padding:'8px 10px'}} value={docType} onChange={e=>setDocType(e.target.value)}>
            <option>Statement</option><option>Invoice</option><option>Receipt</option><option>Report</option><option>Other</option>
          </select>
          <label style={{...btnPri, cursor:'pointer', opacity:busy?.7:1}}>
            {busy ? 'Uploading…' : 'Upload'}
            <input type="file" onChange={upload} disabled={busy} style={{ display:'none' }} />
          </label>
        </div>
      </div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Securely stored, searchable, downloadable. Files are private to your account.</div>
      {err && <ErrBox m={err} />}
      {loading ? <div style={{color:'var(--text2)',padding:'14px'}}>Loading…</div>
      : filtered.length===0 ? <Empty msg={q ? 'No documents match your search.' : 'No files yet. Use Upload to add statements, invoices or receipts — or attach receipts from the Receipts tab.'} />
      : <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><Th cols={['Type','Name','Uploaded','Size','']} /></thead>
        <tbody>{filtered.map(d => (
          <tr key={d.id}>
            <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{d.type}</span></Td>
            <Td>{d.name}</Td>
            <Td muted mono>{(d.uploaded_at||'').slice(0,10)}</Td>
            <Td muted mono>{kb(d.size_bytes)}</Td>
            <Td right>
              <button style={{...btnSec, padding:'6px 12px', marginRight:'6px'}} onClick={()=>download(d.storage_path, d.name)}>Download</button>
              <button style={{ background:'none', border:'1px solid var(--border)', color:'var(--text3)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'13px' }} onClick={()=>remove(d.id, d.storage_path)}>✕</button>
            </Td>
          </tr>))}</tbody>
      </table>}
    </div>
  )
}

// ---------- RECEIPT MATCHING ----------
function Receipts({ uid, expenses, onMatched }) {
  const [fileObj, setFileObj] = React.useState(null)
  const [fileName, setFileName] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [date, setDate] = React.useState('')
  const [suggestions, setSuggestions] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const withReceipt = expenses.filter(e => e.has_receipt)
  const withoutReceipt = expenses.filter(e => !e.has_receipt)

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (f) { setFileObj(f); setFileName(f.name); setErr(''); setSuggestions(null) }
  }

  const daysBetween = (a, b) => {
    const d1 = new Date(a), d2 = new Date(b)
    if (isNaN(d1) || isNaN(d2)) return 999
    return Math.abs((d1 - d2) / 86400000)
  }

  const findMatches = () => {
    if (!amount) { setErr('Enter the receipt amount so we can find matching expenses.'); return }
    setErr('')
    const amt = parseFloat(amount)
    const scored = withoutReceipt
      .map(e => {
        const amtDiff = Math.abs(Number(e.amount) - amt)
        const dayDiff = date ? daysBetween(e.spent_on, date) : 0
        return { e, amtDiff, dayDiff }
      })
      .filter(s => s.amtDiff < 0.01 || (s.amtDiff <= 1 && s.dayDiff <= 3))
      .sort((a,b) => (a.amtDiff - b.amtDiff) || (a.dayDiff - b.dayDiff))
      .slice(0, 5)
    setSuggestions(scored)
  }

  const attach = async (expenseId) => {
    setBusy(true); setErr('')
    try {
      let storagePath = null
      // Upload the actual file to Storage (if one was chosen)
      if (fileObj) {
        const safe = fileObj.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        storagePath = `${uid}/${crypto.randomUUID()}-${safe}`
        const { error: upErr } = await window.sb.storage
          .from('soloops-files').upload(storagePath, fileObj)
        if (upErr) throw upErr
        // record it in the documents index
        await window.sb.from('soloops_documents').insert({
          user_id: uid, type: 'Receipt', name: fileObj.name,
          storage_path: storagePath, size_bytes: fileObj.size, expense_id: expenseId
        })
      }
      // flag the expense as having a receipt
      const { error } = await window.sb.from('soloops_expenses')
        .update({ has_receipt: true, receipt_name: fileName || 'receipt' })
        .eq('id', expenseId)
      if (error) throw error
      setFileObj(null); setFileName(''); setAmount(''); setDate(''); setSuggestions(null)
      onMatched && onMatched()
    } catch (e) { setErr(e.message || 'Could not attach receipt') }
    setBusy(false)
  }

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'16px' }}>
        <KPI label="Expenses with receipt" value={withReceipt.length} color="var(--green)" />
        <KPI label="Missing a receipt" value={withoutReceipt.length} color="var(--amber)" />
        <KPI label="Total expenses" value={expenses.length} />
      </div>

      <div style={card}>
        <div style={{fontWeight:700, marginBottom:'4px'}}>Match a receipt</div>
        <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Upload your receipt and enter its amount &amp; date — we'll find the matching expense to attach it to.</div>
        {err && <ErrBox m={err} />}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr auto', gap:'12px', alignItems:'end' }}>
          <div>
            <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Receipt file</div>
            <label style={{...inp, display:'flex', alignItems:'center', cursor:'pointer', color: fileName?'var(--text)':'var(--text3)' }}>
              {fileName || 'Choose a file…'}
              <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display:'none' }} />
            </label>
          </div>
          <div>
            <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Amount (£)</div>
            <input style={inp} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Date (optional)</div>
            <input style={inp} type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <button style={btnPri} onClick={findMatches}>Find match</button>
        </div>

        {suggestions && (
          <div style={{ marginTop:'20px' }}>
            {suggestions.length === 0 ? (
              <div style={{ color:'var(--text3)', fontSize:'13.5px', padding:'14px', background:'var(--surface2)', borderRadius:'10px' }}>
                No matching expense found for that amount. Check the amount, or add the expense first (it may not be recorded yet).
              </div>
            ) : (
              <>
                <div style={{ fontSize:'13px', color:'var(--text2)', marginBottom:'10px' }}>Suggested matches — click to attach the receipt:</div>
                {suggestions.map((s,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px', marginBottom:'8px' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'14px' }}>{s.e.merchant}</div>
                      <div style={{ fontSize:'12px', color:'var(--text3)' }}>{s.e.spent_on} · {s.e.category} {s.amtDiff < 0.01 ? '· exact amount' : '· close match'}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <span className="mono" style={{ fontWeight:600 }}>{gbp(s.e.amount)}</span>
                      <button style={{...btnPri, padding:'7px 14px', opacity:busy?.7:1}} disabled={busy} onClick={()=>attach(s.e.id)}>Attach</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{...card, marginTop:'16px'}}>
        <div style={{fontWeight:700, marginBottom:'4px'}}>Expenses missing a receipt</div>
        <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Good to attach these for your records / HMRC</div>
        {withoutReceipt.length === 0 ? <Empty msg="Every expense has a receipt attached. Nice." />
        : <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><Th cols={['Date','Merchant','Category','Amount']} /></thead>
          <tbody>{withoutReceipt.slice(0,15).map(e => (
            <tr key={e.id}>
              <Td muted mono>{e.spent_on}</Td><Td>{e.merchant}</Td>
              <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{e.category}</span></Td>
              <Td mono right>{gbp(e.amount)}</Td>
            </tr>))}</tbody>
        </table>}
      </div>
    </>
  )
}

// ---------- RECURRING / SUBSCRIPTION DETECTION ----------
function Recurring({ expenses }) {
  // normalise a merchant name so "ADOBE UK" and "ADOBE *SUB" group together
  const norm = (m) => (m||'')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')      // strip punctuation
    .replace(/\b(LTD|LIMITED|UK|USA|COM|SUBSCRIPTION|SUB|PAYMENT|DD|BACS|CARD|LONDON)\b/g, '')
    .replace(/\s+/g, ' ').trim()
    .split(' ').slice(0, 2).join(' ')  // first two significant words

  // group expenses by normalised merchant
  const groups = {}
  expenses.forEach(e => {
    const key = norm(e.merchant)
    if (!key) return
    if (!groups[key]) groups[key] = { label: e.merchant, category: e.category, items: [] }
    groups[key].items.push(e)
  })

  // a group is "recurring" if it appears 2+ times
  const recurring = Object.values(groups)
    .filter(g => g.items.length >= 2)
    .map(g => {
      const amounts = g.items.map(i => Number(i.amount) || 0)
      const avg = amounts.reduce((a,b)=>a+b,0) / amounts.length
      const dates = g.items.map(i => i.spent_on).filter(Boolean).sort()
      return {
        label: g.label,
        category: g.category,
        count: g.items.length,
        monthly: avg,            // treat the typical charge as the monthly cost
        annual: avg * 12,
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
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'16px' }}>
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

// ---------- BANK CSV IMPORT ----------
function BankImport({ uid, existingExpenses, onImported }) {
  const [stage, setStage] = React.useState('upload') // upload | map | review | done
  const [rows, setRows] = React.useState([])
  const [headers, setHeaders] = React.useState([])
  const [map, setMap] = React.useState({ date:'', desc:'', amount:'', debit:'', credit:'' })
  const [items, setItems] = React.useState([])
  const [rules, setRules] = React.useState([])
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  // load the user's merchant rules so we can auto-categorise
  React.useEffect(() => {
    window.sb.from('soloops_rules').select('*').then(({ data }) => setRules(data || []))
  }, [])

  const guess = (cands, hs) => hs.find(h => cands.some(c => h.toLowerCase().includes(c))) || ''

  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setErr('')
    window.Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        if (!res.data.length) { setErr('That file looks empty.'); return }
        const hs = res.meta.fields || Object.keys(res.data[0])
        setHeaders(hs); setRows(res.data)
        // auto-detect columns
        setMap({
          date:   guess(['date'], hs),
          desc:   guess(['description','desc','reference','memo','details','narrative','payee'], hs),
          amount: guess(['amount','value'], hs),
          debit:  guess(['debit','paid out','money out','withdraw','out'], hs),
          credit: guess(['credit','paid in','money in','deposit','in'], hs),
        })
        setStage('map')
      },
      error: () => setErr('Could not read that CSV file.')
    })
  }

  const categorise = (desc) => {
    const up = (desc||'').toUpperCase()
    const hit = rules.find(r => up.includes((r.pattern||'').toUpperCase()))
    return hit ? hit.category : 'Other'
  }

  // turn mapped rows into review items (debits = expenses)
  const buildReview = () => {
    if (!map.date || !map.desc || (!map.amount && !map.debit)) {
      setErr('Please choose at least Date, Description, and an Amount (or Debit) column.'); return
    }
    setErr('')
    const existKeys = new Set((existingExpenses||[]).map(e => `${e.spent_on}|${Number(e.amount).toFixed(2)}`))
    const out = []
    rows.forEach((r, i) => {
      const desc = (r[map.desc]||'').trim()
      let amt = 0
      if (map.debit && r[map.debit]) amt = Math.abs(parseFloat(String(r[map.debit]).replace(/[^0-9.\-]/g,''))) || 0
      else if (map.amount && r[map.amount]) {
        const v = parseFloat(String(r[map.amount]).replace(/[^0-9.\-]/g,'')) || 0
        amt = v < 0 ? Math.abs(v) : 0   // negative = money out = expense
      }
      if (amt <= 0 || !desc) return  // skip income/blank rows
      // normalise date to YYYY-MM-DD where possible
      let d = (r[map.date]||'').trim()
      const dt = new Date(d)
      if (!isNaN(dt)) d = dt.toISOString().slice(0,10)
      const dupKey = `${d}|${amt.toFixed(2)}`
      out.push({
        i, include: true, merchant: desc, category: categorise(desc),
        amount: amt, spent_on: d, duplicate: existKeys.has(dupKey)
      })
    })
    if (!out.length) { setErr('No expense (money-out) rows found with these columns. Check your mapping.'); return }
    setItems(out); setStage('review')
  }

  const setItem = (idx, patch) => setItems(items.map((it,k) => k===idx ? {...it, ...patch} : it))

  const doImport = async () => {
    const chosen = items.filter(it => it.include)
    if (!chosen.length) { setErr('Tick at least one row to import.'); return }
    setBusy(true); setErr('')
    try {
      const payload = chosen.map(it => ({
        user_id: uid, merchant: it.merchant, category: it.category,
        amount: it.amount, spent_on: it.spent_on || null, source: 'import'
      }))
      const { error } = await window.sb.from('soloops_expenses').insert(payload)
      if (error) throw error
      // learn rules from confirmed categorisations (first word of merchant)
      const ruleRows = chosen
        .filter(it => it.category && it.category !== 'Other')
        .map(it => ({ user_id: uid, pattern: (it.merchant.split(' ')[0]||'').toUpperCase(), category: it.category }))
      if (ruleRows.length) {
        await window.sb.from('soloops_rules').upsert(ruleRows, { onConflict:'user_id,pattern', ignoreDuplicates:true }).then(()=>{}).catch(()=>{})
      }
      setStage('done')
      onImported && onImported()
    } catch (e) { setErr(e.message || 'Import failed') }
    setBusy(false)
  }

  const reset = () => { setStage('upload'); setRows([]); setItems([]); setErr('') }

  const sel = { ...inp, padding:'8px 10px' }

  return (
    <div style={card}>
      <div style={{fontWeight:700, marginBottom:'4px'}}>Bank statement import</div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Upload a CSV from your bank. We auto-detect the columns and pre-categorise using your rules — you confirm before anything is saved.</div>
      {err && <ErrBox m={err} />}

      {stage==='upload' && (
        <label style={{ display:'block', border:'2px dashed var(--border-light)', borderRadius:'14px', padding:'40px', textAlign:'center', cursor:'pointer' }}>
          <div style={{ fontSize:'15px', fontWeight:700, marginBottom:'6px' }}>Choose a CSV file</div>
          <div style={{ fontSize:'13px', color:'var(--text3)' }}>Works with most UK bank exports</div>
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display:'none' }} />
        </label>
      )}

      {stage==='map' && (
        <div>
          <div style={{ fontSize:'13.5px', color:'var(--text2)', marginBottom:'14px' }}>We detected these columns — fix any that look wrong, then continue. ({rows.length} rows found)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px', marginBottom:'18px' }}>
            {[['date','Date'],['desc','Description'],['amount','Amount (signed)'],['debit','Debit / money out'],['credit','Credit / money in']].map(([k,label]) => (
              <div key={k}>
                <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>{label}</div>
                <select style={sel} value={map[k]} onChange={e=>setMap({...map,[k]:e.target.value})}>
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button style={btnSec} onClick={reset}>Cancel</button>
            <button style={btnPri} onClick={buildReview}>Continue</button>
          </div>
        </div>
      )}

      {stage==='review' && (
        <div>
          <div style={{ fontSize:'13.5px', color:'var(--text2)', marginBottom:'14px' }}>
            {items.length} expense rows found. Untick anything you don't want, adjust categories, then import.
            {items.some(it=>it.duplicate) && <span style={{color:'var(--amber)'}}> Possible duplicates are flagged.</span>}
          </div>
          <div style={{ maxHeight:'380px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'10px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['','Date','Merchant','Category','Amount'].map((h,i)=>(
                  <th key={i} style={{ textAlign:i===4?'right':'left', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text3)', fontWeight:700, padding:'10px 14px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--surface)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((it,idx) => (
                  <tr key={idx} style={{ opacity: it.include?1:0.45 }}>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)'}}>
                      <input type="checkbox" checked={it.include} onChange={e=>setItem(idx,{include:e.target.checked})} />
                    </td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:'13px', color:'var(--text3)', fontFamily:'Fira Code, monospace'}}>{it.spent_on}</td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:'13px'}}>
                      {it.merchant}{it.duplicate && <span style={{ marginLeft:'8px', fontSize:'10.5px', color:'var(--amber)', border:'1px solid rgba(245,158,11,.4)', borderRadius:'20px', padding:'1px 7px' }}>dup?</span>}
                    </td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)'}}>
                      <select style={{...sel, padding:'6px 8px'}} value={it.category} onChange={e=>setItem(idx,{category:e.target.value})}>
                        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:'13px', textAlign:'right', fontFamily:'Fira Code, monospace'}}>{gbp(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', gap:'10px', marginTop:'16px', alignItems:'center' }}>
            <button style={btnSec} onClick={reset}>Start over</button>
            <button style={{...btnPri, opacity:busy?.7:1}} disabled={busy} onClick={doImport}>
              {busy ? 'Importing…' : `Import ${items.filter(i=>i.include).length} selected`}
            </button>
          </div>
        </div>
      )}

      {stage==='done' && (
        <div style={{ textAlign:'center', padding:'30px 20px' }}>
          <div style={{ fontSize:'18px', fontWeight:800, marginBottom:'8px' }}>✓ Imported</div>
          <div style={{ color:'var(--text2)', fontSize:'14px', marginBottom:'18px' }}>Your transactions were added as expenses and your category rules were updated.</div>
          <button style={btnSec} onClick={reset}>Import another file</button>
        </div>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
