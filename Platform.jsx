// ============================================================
//  Alzaro — Platform Admin (unified, all verticals)
//  Loaded by platform.html.
//  Security: reads v_platform_users + product_members, both
//  gated by is_platform_admin() RLS. A non-admin session gets
//  no rows and is shown "Access denied". No service key here.
// ============================================================
const { useState, useEffect } = React

const VERTICALS = {
  tyreops:     { label: 'TyreOps',     color: 'var(--amber)' },
  garageops:   { label: 'GarageOps',   color: 'var(--orange)' },
  soloops:     { label: 'SoloOps',     color: 'var(--orange-light)' },
  serviceops:  { label: 'ServiceOps',  color: 'var(--blue)' },
  propertyops: { label: 'PropertyOps', color: 'var(--green)' },
}

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—'
const fmtDateTime = d => d ? new Date(d).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'22px' }
const btnSec = { background:'var(--surface2)', color:'var(--text)', fontWeight:700, fontSize:'13px', padding:'9px 14px', borderRadius:'10px', border:'1px solid var(--border-light)', cursor:'pointer' }
const td = { padding:'13px 14px', borderBottom:'1px solid var(--border)', fontSize:'13.5px', verticalAlign:'middle' }

function Platform() {
  const [session, setSession] = useState(undefined)
  const [allowed, setAllowed] = useState(undefined) // undefined=checking, false=denied, true=admin
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null) // user_id currently toggling
  const [planBusy, setPlanBusy] = useState(null) // user_id+product currently saving plan
  const [expanded, setExpanded] = useState(null) // user_id currently expanded

  // call the admin-users edge function with the current session token
  const callFn = async (body) => {
    const { data: { session } } = await window.sb.auth.getSession()
    const res = await fetch(`${window.SB_FN_URL}/admin-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body || {}),
    })
    return res.json()
  }

  // login form state
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    window.sb.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data: sub } = window.sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // verify admin + load all users
  useEffect(() => {
    if (session === undefined) return
    if (session === null) { setAllowed(undefined); setLoading(false); return }
    const run = async () => {
      setLoading(true)
      const { data: isAdmin, error } = await window.sb.rpc('is_platform_admin')
      if (error || !isAdmin) { setAllowed(false); setLoading(false); return }
      setAllowed(true)
      await loadUsers()
      setLoading(false)
    }
    run()
  }, [session])

  const loadUsers = async () => {
    const res = await callFn({ action: 'list' })
    if (res && res.users) setUsers(res.users)
    else if (res && res.error) console.error('load failed:', res.error)
  }

  const doLogin = async () => {
    setLoginErr(''); setLoggingIn(true)
    const { error } = await window.sb.auth.signInWithPassword({ email: email.trim(), password: pw })
    setLoggingIn(false)
    if (error) setLoginErr(error.message)
  }

  const signOut = async () => { await window.sb.auth.signOut(); setUsers([]); setAllowed(undefined) }

  // toggle disable/enable via edge function (real ban + status flag)
  const toggleDisabled = async (u) => {
    const disable = !u.is_disabled
    if (disable && !confirm(`Disable ${u.email}? They will be blocked from logging in to all Alzaro products. This is reversible.`)) return
    setBusy(u.user_id)
    const res = await callFn({ action: disable ? 'disable' : 'enable', user_id: u.user_id })
    setBusy(null)
    if (res && res.error) { alert('Failed: ' + res.error); return }
    await loadUsers()
  }

  // update tier/status for one vertical
  const setPlan = async (u, product, patch) => {
    setPlanBusy(u.user_id + product)
    const res = await callFn({ action: 'set-plan', user_id: u.user_id, product, ...patch })
    setPlanBusy(null)
    if (res && res.error) { alert('Failed: ' + res.error); return }
    await loadUsers()
  }

  // ---------- render states ----------

  if (session === undefined || (session && loading))
    return <Center>Loading platform…</Center>

  // not logged in → login form
  if (session === null) {
    return (
      <Center>
        <div style={{ width:'100%', maxWidth:'360px' }} className="fade-in">
          <div style={{ fontSize:'22px', fontWeight:800, marginBottom:'4px' }}>
            Alzaro <span style={{color:'var(--orange)'}}>Platform</span>
          </div>
          <div style={{ color:'var(--text3)', fontSize:'13px', marginBottom:'22px' }}>Admin access only</div>
          <Field label="Email" value={email} onChange={setEmail} type="email" onEnter={doLogin} />
          <Field label="Password" value={pw} onChange={setPw} type="password" onEnter={doLogin} />
          {loginErr && <div style={{ color:'var(--red)', fontSize:'13px', margin:'4px 0 12px' }}>{loginErr}</div>}
          <button onClick={doLogin} disabled={loggingIn}
            style={{ width:'100%', background:'linear-gradient(135deg, var(--orange), var(--amber))', color:'#fff', fontWeight:800, fontSize:'14px', padding:'12px', borderRadius:'10px', border:'none', cursor:'pointer', marginTop:'6px', opacity: loggingIn?0.6:1 }}>
            {loggingIn ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </Center>
    )
  }

  // logged in but not a platform admin
  if (allowed === false)
    return (
      <Center>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'18px', fontWeight:800, marginBottom:'8px' }}>Access denied</div>
          <div style={{ color:'var(--text2)', fontSize:'14px', marginBottom:'18px' }}>
            {session.user.email} is not a platform admin.
          </div>
          <button onClick={signOut} style={btnSec}>Sign out</button>
        </div>
      </Center>
    )

  // ---------- admin view ----------
  const total = users.length
  const disabledCount = users.filter(u => u.is_disabled).length
  const perVertical = Object.keys(VERTICALS).reduce((acc, k) => {
    acc[k] = users.filter(u => (u.verticals || '').includes(k)).length
    return acc
  }, {})

  const shown = filter === 'all'
    ? users
    : users.filter(u => (u.verticals || '').includes(filter))

  return (
    <div style={{ maxWidth:'1180px', margin:'0 auto', padding:'28px' }} className="fade-in">
      {/* header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ fontSize:'22px', fontWeight:800 }}>Alzaro <span style={{color:'var(--orange)'}}>Platform</span> · Admin</div>
          <div style={{ color:'var(--text3)', fontSize:'13px' }}>{session.user.email}</div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={loadUsers} style={btnSec}>↻ Refresh</button>
          <button onClick={signOut} style={btnSec}>Sign out</button>
        </div>
      </div>

      {/* stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'16px', marginBottom:'16px' }}>
        <Stat label="Total users" value={total} />
        <Stat label="Disabled" value={disabledCount} color={disabledCount? 'var(--red)':'var(--text)'} />
        {Object.entries(VERTICALS).map(([k,v]) =>
          <Stat key={k} label={v.label} value={perVertical[k]} color={v.color} />
        )}
      </div>

      {/* filter chips */}
      <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' }}>
        <Chip active={filter==='all'} onClick={()=>setFilter('all')}>All ({total})</Chip>
        {Object.entries(VERTICALS).map(([k,v]) =>
          <Chip key={k} active={filter===k} onClick={()=>setFilter(k)} color={v.color}>
            {v.label} ({perVertical[k]})
          </Chip>
        )}
      </div>

      {/* users table */}
      <div style={card}>
        <div style={{ fontWeight:700, marginBottom:'16px' }}>
          {filter==='all' ? 'All users' : VERTICALS[filter].label + ' users'}
        </div>
        {shown.length===0 ? (
          <div style={{ color:'var(--text3)', padding:'24px', textAlign:'center' }}>No users.</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'720px' }}>
              <thead><tr>
                {['','Email','Verticals','Joined','Status',''].map((h,i)=>(
                  <th key={i} style={{ textAlign:'left', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text3)', fontWeight:700, padding:'0 14px 12px', borderBottom:'1px solid var(--border)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {shown.map(u => {
                  const open = expanded === u.user_id
                  return (
                  <React.Fragment key={u.user_id}>
                  <tr
                    onClick={()=>setExpanded(open ? null : u.user_id)}
                    style={{ opacity: u.is_disabled ? 0.55 : 1, cursor:'pointer', background: open ? 'var(--surface2)' : 'transparent' }}>
                    <td style={{...td, width:'30px', color:'var(--text3)'}}>{open ? '▾' : '▸'}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>
                      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                        {(u.verticals||'').split(', ').filter(Boolean).map(v => {
                          const meta = VERTICALS[v] || { label:v, color:'var(--text3)' }
                          return <span key={v} style={{ fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'6px', background:'var(--surface2)', color:meta.color, border:'1px solid var(--border-light)' }}>{meta.label}</span>
                        })}
                      </div>
                    </td>
                    <td style={{...td, color:'var(--text3)'}}>{fmtDate(u.created_at)}</td>
                    <td style={td}>
                      {u.is_disabled
                        ? <span style={{ color:'var(--red)', fontWeight:700, fontSize:'12px' }}>● Disabled</span>
                        : <span style={{ color:'var(--green)', fontWeight:700, fontSize:'12px' }}>● Active</span>}
                    </td>
                    <td style={{...td, textAlign:'right'}}>
                      <button
                        onClick={(e)=>{ e.stopPropagation(); toggleDisabled(u) }}
                        disabled={busy===u.user_id}
                        style={{
                          ...btnSec, padding:'7px 13px',
                          color: u.is_disabled ? 'var(--green)' : 'var(--red)',
                          borderColor: u.is_disabled ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)',
                          opacity: busy===u.user_id ? 0.5 : 1
                        }}>
                        {busy===u.user_id ? '…' : (u.is_disabled ? 'Enable' : 'Disable')}
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6} style={{ padding:'0 14px 18px', background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:'14px', marginBottom:'16px' }}>
                          <Detail label="Joined" value={fmtDate(u.created_at)} />
                          <Detail label="Last logged in" value={u.last_sign_in_at ? fmtDateTime(u.last_sign_in_at) : 'Never'} />
                          <Detail label="Email confirmed" value={u.email_confirmed_at ? fmtDate(u.email_confirmed_at) : 'No'} />
                          <Detail label="Account" value={u.is_disabled ? 'Disabled' : 'Active'} color={u.is_disabled?'var(--red)':'var(--green)'} />
                        </div>
                        <div style={{ fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.6px', color:'var(--text3)', fontWeight:700, marginBottom:'10px' }}>Products ({(u.memberships||[]).length})</div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'10px' }}>
                          {(u.memberships||[]).map((m,i) => {
                            const meta = VERTICALS[m.product] || { label:m.product, color:'var(--text3)' }
                            return (
                              <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'12px', padding:'14px' }}>
                                <div style={{ fontWeight:800, color:meta.color, marginBottom:'10px' }}>{meta.label}</div>
                                <Row k="Company" v={m.company_name || '—'} />
                                <Row k="Trial ends" v={m.trial_ends ? fmtDate(m.trial_ends) : '—'} />
                                <div style={{ marginTop:'10px', display:'grid', gap:'8px' }}>
                                  <PlanSelect label="Tier" value={m.tier || 'bronze'} options={['bronze','silver','gold']}
                                    disabled={planBusy===u.user_id+m.product}
                                    onChange={val=>setPlan(u, m.product, { tier: val })} />
                                  <PlanSelect label="Status" value={m.status || 'trial'} options={['trial','active','suspended','disabled']}
                                    disabled={planBusy===u.user_id+m.product}
                                    onChange={val=>setPlan(u, m.product, { status: val })} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- small components ----------
function Center({children}) { return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)',padding:'20px'}}>{children}</div> }
function Stat({label,value,color}) { return <div style={{...card, padding:'18px'}}><div style={{fontSize:'11px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.6px',fontWeight:600}}>{label}</div><div style={{fontSize:'24px',fontWeight:600,marginTop:'6px',letterSpacing:'-0.5px',color:color||'var(--orange-light)',fontFamily:'Fira Code, monospace'}}>{value}</div></div> }
function Detail({label,value,color}) { return <div><div style={{fontSize:'11px',color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.5px',fontWeight:600,marginBottom:'3px'}}>{label}</div><div style={{fontSize:'14px',fontWeight:600,color:color||'var(--text)'}}>{value}</div></div> }
function Row({k,v}) { return <div style={{display:'flex',justifyContent:'space-between',fontSize:'12.5px',padding:'3px 0'}}><span style={{color:'var(--text3)'}}>{k}</span><span style={{color:'var(--text2)',fontWeight:600}}>{v}</span></div> }
function PlanSelect({label,value,options,onChange,disabled}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}>
      <span style={{fontSize:'12px',color:'var(--text3)',fontWeight:600}}>{label}</span>
      <select value={value} disabled={disabled}
        onChange={e=>onChange(e.target.value)}
        style={{ flex:'0 0 110px', background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border-light)', borderRadius:'8px', padding:'6px 8px', fontSize:'12.5px', fontWeight:600, cursor:disabled?'wait':'pointer', opacity:disabled?0.5:1, textTransform:'capitalize' }}>
        {options.map(o => <option key={o} value={o} style={{textTransform:'capitalize'}}>{o}</option>)}
      </select>
    </div>
  )
}
function Chip({children,active,onClick,color}) { return <button onClick={onClick} style={{ fontSize:'13px', fontWeight:700, padding:'8px 14px', borderRadius:'10px', cursor:'pointer', background: active?'var(--surface3)':'var(--surface)', color: active?(color||'var(--text)'):'var(--text2)', border:'1px solid '+(active?'var(--border-light)':'var(--border)') }}>{children}</button> }
function Field({label,value,onChange,type,onEnter}) {
  return (
    <div style={{ marginBottom:'14px' }}>
      <label style={{ display:'block', fontSize:'12px', color:'var(--text3)', fontWeight:600, marginBottom:'6px' }}>{label}</label>
      <input
        type={type||'text'} value={value}
        onChange={e=>onChange(e.target.value)}
        onKeyDown={e=>{ if(e.key==='Enter' && onEnter) onEnter() }}
        style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border-light)', borderRadius:'10px', padding:'11px 13px', color:'var(--text)', fontSize:'14px', fontFamily:'Manrope, sans-serif' }}
      />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<Platform />)
