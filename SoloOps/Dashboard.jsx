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
  ['mileage','Mileage'], ['tax','Tax'], ['settings','Settings']
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
  const signOut = async () => { await window.sb.auth.signOut(); window.location.href = 'login.html' }

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
    window.location.href = 'login.html'
    return null
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'230px 1fr', minHeight:'100vh' }}>
      {/* SIDEBAR */}
      <aside style={{ background:'var(--surface)', borderRight:'1px solid var(--border)', padding:'22px 16px', position:'sticky', top:0, height:'100vh', display:'flex', flexDirection:'column', gap:'4px' }}>
        <div style={{ fontSize:'20px', fontWeight:800, letterSpacing:'-0.5px', padding:'6px 12px 22px' }}>Alzaro <span style={{color:'var(--orange)'}}>SoloOps</span></div>
        {NAV.map(([k,label]) => (
          <div key={k} onClick={()=>setView(k)} style={{
            padding:'11px 14px', borderRadius:'10px', fontSize:'14px', fontWeight:600, cursor:'pointer',
            color: view===k ? 'var(--text)' : 'var(--text2)',
            background: view===k ? 'var(--surface3)' : 'transparent',
            border: view===k ? '1px solid var(--border-light)' : '1px solid transparent'
          }}>{label}</div>
        ))}
        <div style={{ flex:1 }} />
        <div style={{ fontSize:'12px', color:'var(--text3)', padding:'0 12px 8px', wordBreak:'break-all' }}>{session.user.email}</div>
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
              <KPI label="Revenue (paid)" value={gbp(revenue)} />
              <KPI label="Expenses" value={gbp(totalExp)} />
              <KPI label="Profit" value={gbp(profit)} color={profit>=0?'var(--green)':'var(--red)'} />
              <KPI label="Est. tax" value={gbp(estTax)} color="var(--amber)" sub="estimate only" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div style={card}>
                <div style={{fontWeight:700, marginBottom:'4px'}}>Expense breakdown</div>
                <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>By category</div>
                {catRows.length===0 ? <Empty msg="No expenses yet — add your first one." />
                  : catRows.map(([c,v]) => (
                  <div key={c} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px', fontSize:'13px' }}>
                    <span style={{ width:'11px', height:'11px', borderRadius:'3px', background: CAT_COLORS[c]||'#68635d' }} />
                    <span style={{ flex:1, color:'var(--text2)' }}>{c}</span>
                    <span className="mono" style={{ fontWeight:600 }}>{gbp(v)}</span>
                  </div>
                ))}
              </div>
              <div style={card}>
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
                    <Td muted mono>{e.spent_on}</Td><Td>{e.merchant}</Td>
                    <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{e.category}</span></Td>
                    <Td mono right>{gbp(e.amount)}</Td>
                  </tr>))}</tbody>
              </table>}
            </div>
          )}

          {/* ===== MILEAGE ===== */}
          {view==='mileage' && (
            <div style={card}>
              {mileage.length===0 ? <Empty msg="No journeys logged yet." />
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
          )}

          {/* ===== TAX ===== */}
          {view==='tax' && (
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

      {/* TOAST */}
      {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'var(--surface2)', border:'1px solid var(--border-light)', borderLeft:'3px solid var(--orange)', borderRadius:'12px', padding:'14px 18px', fontSize:'13.5px', boxShadow:'0 14px 40px rgba(0,0,0,.5)', zIndex:200 }}>✓ {toast}</div>}
    </div>
  )
}

// ---------- small components ----------
function KPI({label,value,color,sub}) {
  return <div style={{...card, padding:'20px'}}>
    <div style={{ fontSize:'12px', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:600 }}>{label}</div>
    <div className="mono" style={{ fontSize:'26px', fontWeight:600, marginTop:'6px', letterSpacing:'-0.5px', color: color||'var(--text)' }}>{value}</div>
    {sub && <div style={{ fontSize:'12px', color:'var(--text3)', marginTop:'6px' }}>{sub}</div>}
  </div>
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
