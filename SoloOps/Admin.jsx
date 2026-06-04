// ============================================================
//  Alzaro SoloOps — Admin Panel
//  Loaded by admin.html. Secure: relies on Supabase RLS +
//  soloops_is_admin(). A non-admin session simply gets no rows
//  (and is bounced out). No service key in the browser.
// ============================================================
const { useState, useEffect } = React

const gbp = n => '£' + (Number(n)||0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'22px' }
const grad = 'linear-gradient(135deg, var(--orange), var(--amber))'
const btnSec = { background:'var(--surface2)', color:'var(--text)', fontWeight:700, fontSize:'13px', padding:'9px 14px', borderRadius:'10px', border:'1px solid var(--border-light)', cursor:'pointer' }
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'

function Admin() {
  const [session, setSession] = useState(undefined)
  const [allowed, setAllowed] = useState(undefined) // undefined=checking, false=denied, true=admin
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [mileage, setMileage] = useState([])
  const [selected, setSelected] = useState(null) // a profile to drill into

  useEffect(() => {
    window.sb.auth.getSession().then(({ data }) => setSession(data.session || null))
  }, [])

  // verify admin via the DB function, then load everything
  useEffect(() => {
    if (session === undefined) return
    if (session === null) { window.location.href = '/soloops/login'; return }
    const run = async () => {
      // ask the DB whether this user is an admin
      const { data: isAdmin, error } = await window.sb.rpc('soloops_is_admin')
      if (error || !isAdmin) { setAllowed(false); return }
      setAllowed(true)
      // admin RLS lets these reads return ALL rows
      const [p, i, e, m] = await Promise.all([
        window.sb.from('soloops_access').select('*').order('signed_up_at',{ascending:false}),
        window.sb.from('soloops_invoices').select('*'),
        window.sb.from('soloops_expenses').select('*'),
        window.sb.from('soloops_mileage').select('*'),
      ])
      setProfiles(p.data||[]); setInvoices(i.data||[]); setExpenses(e.data||[]); setMileage(m.data||[])
      setLoading(false)
    }
    run()
  }, [session])

  const signOut = async () => { await window.sb.auth.signOut(); window.location.href = '/soloops/login' }

  if (allowed === undefined)
    return <Center>Verifying admin access…</Center>
  if (allowed === false)
    return <Center>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:'18px',fontWeight:800,marginBottom:'8px'}}>Access denied</div>
        <div style={{color:'var(--text2)',fontSize:'14px',marginBottom:'18px'}}>This account is not a SoloOps admin.</div>
        <a href="/soloops/dashboard" style={{...btnSec, textDecoration:'none'}}>Go to dashboard</a>
      </div>
    </Center>
  if (loading) return <Center>Loading all SoloOps data…</Center>

  // ---- totals across ALL users ----
  const totalRevenue = invoices.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.total||0),0)
  const totalExp = expenses.reduce((s,e)=>s+Number(e.amount||0),0)
  const totalMiles = mileage.reduce((s,m)=>s+Number(m.miles||0),0)

  // per-user aggregates
  const userAgg = (uid) => ({
    revenue: invoices.filter(i=>i.user_id===uid && i.status==='paid').reduce((s,i)=>s+Number(i.total||0),0),
    invoices: invoices.filter(i=>i.user_id===uid).length,
    expenses: expenses.filter(e=>e.user_id===uid).reduce((s,e)=>s+Number(e.amount||0),0),
    expenseCount: expenses.filter(e=>e.user_id===uid).length,
    miles: mileage.filter(m=>m.user_id===uid).reduce((s,m)=>s+Number(m.miles||0),0),
  })

  return (
    <div style={{ maxWidth:'1100px', margin:'0 auto', padding:'28px' }} className="fade-in">
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <div style={{ fontSize:'22px', fontWeight:800 }}>Alzaro <span style={{color:'var(--orange)'}}>SoloOps</span> · Admin</div>
          <div style={{ color:'var(--text3)', fontSize:'13px' }}>{session.user.email}</div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <a href="/soloops/dashboard" style={{...btnSec, textDecoration:'none'}}>My dashboard</a>
          <button onClick={signOut} style={btnSec}>Sign out</button>
        </div>
      </div>

      {/* totals */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'16px' }}>
        <Stat label="SoloOps users" value={profiles.length} />
        <Stat label="Total revenue (paid)" value={gbp(totalRevenue)} />
        <Stat label="Total expenses" value={gbp(totalExp)} color="var(--text)" />
        <Stat label="Total miles logged" value={totalMiles.toLocaleString('en-GB')} />
      </div>

      {selected ? (
        // ---- per-user drill-down ----
        <div style={card}>
          <button onClick={()=>setSelected(null)} style={{...btnSec, marginBottom:'18px'}}>← Back to all users</button>
          <div style={{ fontSize:'18px', fontWeight:800 }}>{selected.business_name || '(no business name)'}</div>
          <div style={{ color:'var(--text2)', fontSize:'13px', marginBottom:'4px' }}>{selected.email}</div>
          <div style={{ color:'var(--text3)', fontSize:'12px', marginBottom:'20px' }}>Joined {fmtDate(selected.signed_up_at)}</div>
          {(() => { const a = userAgg(selected.user_id); return (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px' }}>
              <MiniStat label="Revenue (paid)" v={gbp(a.revenue)} />
              <MiniStat label="Invoices" v={a.invoices} />
              <MiniStat label="Expenses" v={gbp(a.expenses)} />
              <MiniStat label="Expense entries" v={a.expenseCount} />
              <MiniStat label="Miles" v={a.miles.toLocaleString('en-GB')} />
              <MiniStat label="Profit (paid - exp)" v={gbp(a.revenue - a.expenses)} />
            </div>
          )})()}
        </div>
      ) : (
        // ---- all users table ----
        <div style={card}>
          <div style={{ fontWeight:700, marginBottom:'16px' }}>All SoloOps users</div>
          {profiles.length===0 ? <div style={{color:'var(--text3)',padding:'20px',textAlign:'center'}}>No SoloOps users yet.</div> : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['Business','Email','Joined','Revenue','Expenses',''].map((h,i)=>(
                  <th key={i} style={{ textAlign: (i>=3&&i<5)?'right':'left', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text3)', fontWeight:700, padding:'0 14px 12px', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {profiles.map(p => { const a = userAgg(p.user_id); return (
                  <tr key={p.user_id}>
                    <td style={td}>{p.business_name || '—'}</td>
                    <td style={{...td, color:'var(--text2)'}}>{p.email}</td>
                    <td style={{...td, color:'var(--text3)'}}>{fmtDate(p.signed_up_at)}</td>
                    <td style={{...td, textAlign:'right', fontFamily:'Fira Code, monospace'}}>{gbp(a.revenue)}</td>
                    <td style={{...td, textAlign:'right', fontFamily:'Fira Code, monospace'}}>{gbp(a.expenses)}</td>
                    <td style={{...td, textAlign:'right'}}><button onClick={()=>setSelected(p)} style={{...btnSec, padding:'6px 12px'}}>View</button></td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

const td = { padding:'14px', borderBottom:'1px solid var(--border)', fontSize:'13.5px' }
function Center({children}) { return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)',padding:'20px'}}>{children}</div> }
function Stat({label,value,color}) { return <div style={{...card, padding:'20px'}}><div style={{fontSize:'12px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.6px',fontWeight:600}}>{label}</div><div style={{fontSize:'26px',fontWeight:600,marginTop:'6px',letterSpacing:'-0.5px',color:color||'var(--orange-light)',fontFamily:'Fira Code, monospace'}}>{value}</div></div> }
function MiniStat({label,v}) { return <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'12px',padding:'16px'}}><div style={{fontSize:'11px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:600}}>{label}</div><div style={{fontSize:'20px',fontWeight:600,marginTop:'4px',fontFamily:'Fira Code, monospace'}}>{v}</div></div> }

ReactDOM.createRoot(document.getElementById('root')).render(<Admin />)
