import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  getSession, onAuthChange, signOut as dbSignOut, getAccess,
  loadInvoices, loadExpenses, loadMileage, loadClients, deleteInvoice, updateInvoice,
  deleteExpense, deleteMileage,
  updateUser, loadSettings, getMember, joinProduct,
} from './lib/db.js'
import TrialGuard from './components/TrialGuard.jsx'
import { NAV, TIER_ORDER, gbp, fmtDate, card, inp, btnPri, btnSec, KPI, Empty, Th, Td, Status, Line, Check } from './components/UI.jsx'
import { ExpenseForm, InvoiceForm, MileageForm } from './components/forms/Forms.jsx'

import Dashboard from './pages/Dashboard.jsx'
import Clients from './pages/Clients.jsx'
import BankImport from './pages/BankImport.jsx'
import Recurring from './pages/Recurring.jsx'
import Receipts from './pages/Receipts.jsx'
import Reports from './pages/Reports.jsx'
import Documents from './pages/Documents.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'

const VALID_VIEWS = NAV.map(n => n[0])

function Shell() {
  const navigate = useNavigate()
  const { view: routeView } = useParams()
  const view = VALID_VIEWS.includes(routeView) ? routeView : 'dashboard'
  // An unknown view (/soloops/<garbage>) still renders the dashboard; correct
  // the URL to match rather than leaving a stale/invalid path in the bar.
  useEffect(() => {
    if (routeView && !VALID_VIEWS.includes(routeView)) navigate('/dashboard', { replace: true })
  }, [routeView, navigate])
  const setView = (v) => navigate(`/${v}`)

  const [session, setSession] = useState(undefined)
  const [yearFilter, setYearFilter] = useState('all')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [mileage, setMileage] = useState([])
  const [clients, setClients] = useState([])
  const [bizName, setBizName] = useState('')
  const [settings, setSettings] = useState(null)
  // Subscription membership row (product_members, product='soloops').
  // undefined = not loaded yet (gate rendering); null = no row.
  const [member, setMember] = useState(undefined)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editInvoice, setEditInvoice] = useState(null)
  const [editExpense, setEditExpense] = useState(null)
  const [editMileage, setEditMileage] = useState(null)
  const [incFilter, setIncFilter] = useState('all')
  const [incSearch, setIncSearch] = useState('')
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('soloops-theme') || 'dark' } catch (e) { return 'dark' }
  })
  const [mobileNav, setMobileNav] = useState(false)

  // Close the mobile nav drawer whenever the view changes or on Escape.
  useEffect(() => {
    if (!mobileNav) return
    const onKey = (e) => { if (e.key === 'Escape') setMobileNav(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNav])

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    try { localStorage.setItem('soloops-theme', theme) } catch (e) { /* storage unavailable */ }
  }, [theme])

  useEffect(() => {
    getSession().then((s) => setSession(s || null))
    const sub = onAuthChange((event, s) => {
      // Ignore TOKEN_REFRESHED — it fires on tab-refocus and would otherwise
      // hand us a new session object every time, forcing a full data reload.
      if (event === 'TOKEN_REFRESHED') return
      setSession(s)
    })
    return () => sub?.unsubscribe?.()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const sess = await getSession()
    const uid = sess?.user?.id
    if (uid) {
      const access = await getAccess(uid)
      if (!access) {
        await dbSignOut()
        window.location.href = '/soloops/login'
        return
      }
      // Source of truth for the business name is soloops_settings (what the
      // Settings page writes). Fall back to soloops_access for users who
      // haven't saved settings yet.
      let nm = access.business_name || ''
      try {
        const st = await loadSettings(uid)
        if (st) setSettings(st)
        if (st && st.business_name) nm = st.business_name
      } catch (_) {}
      setBizName(nm)
      // Ensure a product_members row exists (idempotent), then load the
      // subscription tier/status from it — the source of truth, kept in sync
      // by the Stripe webhook. Covers new, backfilled, and restored sessions.
      try { await joinProduct(nm) } catch (_) {}
      try { setMember((await getMember(uid)) || null) } catch (_) { setMember(null) }
    }
    const [inv, exp, mil, cli] = await Promise.all([
      loadInvoices(), loadExpenses(), loadMileage(), loadClients(),
    ])
    setInvoices(inv || [])
    setExpenses(exp || [])
    setMileage(mil || [])
    setClients(cli || [])
    setLoading(false)
  }
  // Reload only when the logged-in USER changes (real login/logout),
  // not on every new session object (e.g. token refresh on tab-refocus).
  useEffect(() => { if (session?.user?.id) loadAll() }, [session?.user?.id])

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const actBtn = { background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border-light)', borderRadius:'7px', padding:'5px 10px', fontSize:'12px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }
  const actBtnDanger = { ...actBtn, color:'#f87171', borderColor:'rgba(248,113,113,.3)' }

  const onEditInvoice = (inv) => { setEditInvoice(inv); setModal('invoice') }
  const onDeleteInvoice = async (inv) => {
    if(!window.confirm(`Delete income ${inv.number||''} (${inv.client_name||''})? This cannot be undone.`)) return
    const { error } = await deleteInvoice(inv.id)
    if(error){ flash('Delete failed'); return }
    loadAll(); flash('Income deleted')
  }
  const onDownloadPdf = async (inv) => {
    try {
      const sess = await getSession()
      const res = await fetch('/api/invoice-pdf', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${sess?.access_token||''}` },
        body: JSON.stringify({ invoice_id: inv.id }),
      })
      if(!res.ok){ const e=await res.json().catch(()=>({})); flash(e.error||'Could not generate PDF'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${inv.number||'invoice'}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
    } catch(e){ flash('Could not generate PDF') }
  }
  const onMarkPaid = async (inv) => {
    const { error } = await updateInvoice(inv.id, { status:'paid' })
    if(error){ flash('Update failed'); return }
    loadAll(); flash('Marked as paid')
  }
  const onEditExpense = (e) => { setEditExpense(e); setModal('expense') }
  const onDeleteExpense = async (e) => {
    if(!window.confirm(`Delete expense ${e.merchant||''} (${gbp(e.amount)})? This cannot be undone.`)) return
    const { error } = await deleteExpense(e.id)
    if(error){ flash('Delete failed'); return }
    loadAll(); flash('Expense deleted')
  }
  const onEditMileage = (m) => { setEditMileage(m); setModal('mileage') }
  const onDeleteMileage = async (m) => {
    if(!window.confirm(`Delete journey ${m.start_loc||''} → ${m.end_loc||''} (${m.miles} mi)? This cannot be undone.`)) return
    const { error } = await deleteMileage(m.id)
    if(error){ flash('Delete failed'); return }
    loadAll(); flash('Journey deleted')
  }
  const signOut = async () => { await dbSignOut(); window.location.href = '/soloops/login' }

  const [taxRate, setTaxRate] = useState(session?.user?.user_metadata?.tax_rate ?? 20)
  const [nicRate, setNicRate] = useState(session?.user?.user_metadata?.nic_rate ?? 9)
  const [allowance, setAllowance] = useState(session?.user?.user_metadata?.tax_allowance ?? 12570)

  const yOf = d => (d||'').slice(0,4)
  const availableYears = [...new Set([
    ...invoices.map(i=>yOf(i.issue_date)),
    ...expenses.map(e=>yOf(e.spent_on)),
    ...mileage.map(m=>yOf(m.journey_date)),
  ].filter(Boolean))].sort().reverse()
  const inYear = (d) => {
    if (!d) return false
    if (yearFilter === 'custom') {
      if (rangeFrom && d < rangeFrom) return false
      if (rangeTo && d > rangeTo) return false
      return true
    }
    return yearFilter==='all' || yOf(d)===yearFilter
  }
  const fInvoices = invoices.filter(i=>inYear(i.issue_date))
  const fExpenses = expenses.filter(e=>inYear(e.spent_on))
  const fMileage  = mileage.filter(m=>inYear(m.journey_date))

  const revenue = fInvoices.filter(i => i.status === 'paid').reduce((s,i)=>s+Number(i.total||0),0)
  const totalExp = fExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
  const profit = revenue - totalExp
  const taxable = Math.max(0, profit - Number(allowance||0))
  const estTax = Math.max(0, taxable * (Number(taxRate||0)/100) + taxable * (Number(nicRate||0)/100))

  if (session === undefined)
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}>Loading…</div>

  if (session === null) {
    window.location.href = '/soloops/login'
    return null
  }

  // Wait for the membership row before rendering, so gating uses the real tier
  // rather than briefly showing 'basic' and locking pages.
  if (member === undefined)
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}>Loading…</div>

  const uid = session.user.id

  // Subscription tier + gating. Source of truth: product_members (synced by the
  // Stripe webhook). Fail closed to 'basic' if there's no row yet. join_product
  // already writes tier='gold' for new trial rows, so trials get full Gold
  // access with no extra client-side grant needed.
  const tier = (member?.tier || 'basic').toLowerCase()
  // Detect a genuinely live trial purely to annotate the badge ("gold · trial")
  // so it isn't mistaken for a paid plan. Mirrors TrialGuard's midnight compare.
  const onLiveTrial = (() => {
    if (member?.status !== 'trial' || !member?.trial_ends) return false
    const trialEnd = new Date(member.trial_ends); trialEnd.setHours(0, 0, 0, 0)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return today <= trialEnd
  })()
  const userTierIdx = Math.max(0, TIER_ORDER.indexOf(tier))
  const tierAllows = (min) => userTierIdx >= TIER_ORDER.indexOf(min || 'basic')
  const navMin = (k) => { const n = NAV.find(x => x[0] === k); return n ? n[3] : 'basic' }
  const viewLocked = !tierAllows(navMin(view))

  return (
   <TrialGuard memberId={member?.id}>
    <div className={"solo-shell" + (mobileNav ? " nav-open" : "")} style={{ display:'grid', gridTemplateColumns:'230px 1fr', minHeight:'100vh' }}>

      {/* Backdrop shown behind the drawer on mobile */}
      <div className="solo-backdrop" onClick={()=>setMobileNav(false)} />

      <aside className="solo-sidebar" style={{ background:'var(--surface)', borderRight:'1px solid var(--border)', padding:'22px 16px', position:'sticky', top:0, height:'100vh', display:'flex', flexDirection:'column', gap:'4px' }}>
        <div style={{ fontSize:'20px', fontWeight:800, letterSpacing:'-0.5px', padding:'6px 12px 4px', flexShrink:0 }}>Alzaro <span style={{color:'var(--orange)'}}>SoloOps</span></div>
        <div style={{ fontSize:'11px', color:'var(--text3)', padding:'0 12px 14px', flexShrink:0 }}>Self-employed accounts</div>

        {(() => {
          const TIER_META = {
            basic:  { icon:'⚪', color:'#6b7280', bg:'rgba(107,114,128,0.12)', border:'rgba(107,114,128,0.25)' },
            bronze: { icon:'🥉', color:'#b36b1a', bg:'rgba(180,100,30,0.12)', border:'rgba(180,100,30,0.25)' },
            silver: { icon:'🥈', color:'#9ca3af', bg:'rgba(100,100,120,0.12)', border:'rgba(100,100,120,0.25)' },
            gold:   { icon:'👑', color:'#f59e0b', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.25)' },
          }
          const name = bizName || session.user.user_metadata?.business_name || session.user.email.split('@')[0]
          const tm = TIER_META[tier] || TIER_META.basic
          return (
            <div style={{ padding:'0 12px 14px', borderBottom:'1px solid var(--border)', marginBottom:'12px', flexShrink:0 }}>
              <div style={{ fontSize:'14px', fontWeight:700, marginBottom:'7px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
              <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 9px', borderRadius:'20px', fontSize:'10px', fontWeight:700, fontFamily:'Fira Code, monospace', textTransform:'uppercase', letterSpacing:'0.5px', background:tm.bg, color:tm.color, border:`1px solid ${tm.border}` }}>
                <span>{tm.icon}</span>{tier}{onLiveTrial && ' · trial'}
              </span>
            </div>
          )
        })()}

        <div style={{ position:'relative', padding:'0 4px 12px', flexShrink:0 }}>
          <input
            value={search}
            onChange={e=>setSearch(e.target.value)}
            placeholder="🔍  Search…"
            style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px', padding:'10px 12px', color:'var(--text)', fontSize:'13px', outline:'none' }}
          />
          {search.trim().length >= 2 && (() => {
            const q = search.trim().toLowerCase()
            const hits = []
            clients.forEach(c => { if ((c.name||'').toLowerCase().includes(q)) hits.push({ type:'Client', label:c.name, view:'clients' }) })
            invoices.forEach(i => { if ((`${i.client_name||''} ${i.number||''}`).toLowerCase().includes(q)) hits.push({ type:'Invoice', label:`${i.number||'—'} · ${i.client_name||''}`, view:'income' }) })
            expenses.forEach(e => { if ((`${e.merchant||''} ${e.category||''}`).toLowerCase().includes(q)) hits.push({ type:'Expense', label:`${e.merchant} · ${gbp(e.amount)}`, view:'expenses' }) })
            // Never surface hits that lead to a tier-locked page (e.g. expense
            // hits at Basic) — clicking would just bounce off the lock screen.
            const top = hits.filter(h => tierAllows(navMin(h.view))).slice(0, 8)
            return (
              <div style={{ position:'absolute', left:'4px', right:'4px', top:'46px', zIndex:50, background:'var(--surface)', border:'1px solid var(--border-light)', borderRadius:'12px', boxShadow:'0 14px 40px rgba(0,0,0,.5)', overflow:'hidden', maxHeight:'340px', overflowY:'auto' }}>
                {top.length === 0
                  ? <div style={{ padding:'14px', fontSize:'12.5px', color:'var(--text3)' }}>No matches for “{search}”.</div>
                  : top.map((h, idx) => (
                    <div key={idx} onClick={()=>{ setView(h.view); setSearch('') }} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px', padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:'13px' }}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.label}</span>
                      <span style={{ flexShrink:0, fontSize:'10px', color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h.type}</span>
                    </div>
                  ))
                }
              </div>
            )
          })()}
        </div>

        <div className="solo-nav" style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'4px', margin:'0 -4px', padding:'0 4px' }}>
          {NAV.map(([k,label,,min,icon]) => {
            const locked = !tierAllows(min)
            const active = view===k
            return (
            <div key={k} data-nav className={"solo-nav-item"+(active?" active":"")} onClick={()=>{ setView(k); setMobileNav(false) }} style={{
              padding:'11px 14px', borderRadius:'10px', fontSize:'14px', fontWeight:600, cursor:'pointer', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px',
              color: active ? 'var(--text)' : 'var(--text2)',
              background: active ? 'var(--surface3)' : 'transparent',
              border: active ? '1px solid var(--border-light)' : '1px solid transparent',
              opacity: locked ? 0.55 : 1
            }}>
              <span style={{ display:'flex', alignItems:'center', gap:'11px', minWidth:0 }}>
                <i className={`ti ${icon}`} style={{ fontSize:'18px', width:'20px', textAlign:'center', flexShrink:0, color: active ? 'var(--orange)' : 'var(--text3)' }} aria-hidden="true" />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
              </span>
              {locked && <span style={{ fontSize:'12px', flexShrink:0 }} title={`Upgrade to ${min.charAt(0).toUpperCase()+min.slice(1)}`}>🔒</span>}
            </div>
          )})}
        </div>
        <div style={{ fontSize:'12px', color:'var(--text3)', padding:'12px 12px 8px', wordBreak:'break-all', flexShrink:0 }}>{session.user.email}</div>
        <button onClick={()=>setTheme(theme==='dark'?'light':'dark')} style={{...btnSec, width:'100%', marginBottom:'8px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}>
          {theme==='dark' ? '☀ Light mode' : '🌙 Dark mode'}
        </button>
        <button onClick={signOut} style={{...btnSec, width:'100%', flexShrink:0}}>Sign out</button>
      </aside>

      <div style={{ minWidth:0 }}>

        {/* Mobile top bar — hamburger + brand. Hidden on desktop via CSS. */}
        <div className="solo-topbar">
          <button className="solo-burger" aria-label="Open menu" onClick={()=>setMobileNav(true)}>
            <span/><span/><span/>
          </button>
          <div style={{ fontSize:'17px', fontWeight:800, letterSpacing:'-0.5px' }}>Alzaro <span style={{color:'var(--orange)'}}>SoloOps</span></div>
        </div>

        <div className="solo-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px', flexWrap:'wrap', padding:'18px 28px', borderBottom:'1px solid var(--border)' }}>
          <h1 style={{ fontSize:'20px', fontWeight:800 }}>{NAV.find(n=>n[0]===view)[1]}</h1>
          <div className="solo-header-actions" style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
            {!['clients','settings','documents'].includes(view) && <select value={yearFilter} onChange={e=>setYearFilter(e.target.value)} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'9px 12px', color:'var(--text)', fontSize:'13px', outline:'none', cursor:'pointer' }}>
              <option value="all">All years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              <option value="custom">Custom range…</option>
            </select>}
            {!['clients','settings','documents'].includes(view) && yearFilter==='custom' && (
              <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                <input type="date" value={rangeFrom} onChange={e=>setRangeFrom(e.target.value)} title="From" style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'8px 10px', color:'var(--text)', fontSize:'13px', outline:'none' }} />
                <span style={{ color:'var(--text3)', fontSize:'13px' }}>→</span>
                <input type="date" value={rangeTo} onChange={e=>setRangeTo(e.target.value)} title="To" style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'8px 10px', color:'var(--text)', fontSize:'13px', outline:'none' }} />
              </div>
            )}
            {['income','expenses'].includes(view) && <>
              {tierAllows('bronze') && <button style={btnSec} onClick={()=>setModal('expense')}>+ Expense</button>}
              <button style={btnPri} onClick={()=>setModal("invoice")}>+ Income</button>
            </>}
          </div>
        </div>

        <div style={{ padding:'28px' }} className="fade-in">
          {loading ? <div style={{color:'var(--text2)'}}>Loading your data…</div> : viewLocked ? (
            <div style={{ minHeight:'50vh', display:'flex', alignItems:'center', justifyContent:'center', textAlign:'center' }}>
              <div style={{ ...card, maxWidth:'420px' }}>
                <div style={{ fontSize:'40px', marginBottom:'10px' }}>🔒</div>
                <div style={{ fontSize:'18px', fontWeight:800, marginBottom:'8px' }}>{NAV.find(n=>n[0]===view)[1]} is a {navMin(view).charAt(0).toUpperCase()+navMin(view).slice(1)} feature</div>
                <div style={{ color:'var(--text2)', fontSize:'14px', marginBottom:'18px' }}>Upgrade your plan to unlock this and more.</div>
                <button onClick={()=>navigate('/settings#billing')} style={{...btnPri}}>View plans</button>
              </div>
            </div>
          ) : <>

          {view==='dashboard' && (
            <Dashboard
              invoices={invoices} expenses={expenses} clients={clients} mileage={mileage}
              bizName={bizName} uid={uid}
              setView={setView} setModal={setModal} tierAllows={tierAllows}
              taxRate={taxRate} nicRate={nicRate} allowance={allowance}
            />
          )}

          {view==='income' && (() => {
            const TABS = ['all','draft','sent','paid','overdue']
            const q = incSearch.trim().toLowerCase()
            const rows = fInvoices.filter(i =>
              (incFilter==='all' || i.status===incFilter) &&
              (!q || (`${i.client_name||''} ${i.number||''}`).toLowerCase().includes(q))
            )
            return (
            <div>
              <div style={{ marginBottom:'18px' }}>
                <h1 style={{ fontSize:'26px', fontWeight:800, margin:0 }}>Income</h1>
                <div style={{ color:'var(--text3)', fontSize:'14px', marginTop:'4px' }}>Create, send and track customer income</div>
              </div>

              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'14px' }}>
                {TABS.map(t => (
                  <button key={t} onClick={()=>setIncFilter(t)} style={{
                    background: incFilter===t ? 'var(--surface2)' : 'transparent',
                    color: incFilter===t ? 'var(--text)' : 'var(--text3)',
                    border:'1px solid '+(incFilter===t?'var(--border-light)':'transparent'),
                    borderRadius:'10px', padding:'7px 16px', fontSize:'13px', fontWeight:700,
                    textTransform:'capitalize', cursor:'pointer'
                  }}>{t}</button>
                ))}
              </div>

              <input style={{ ...inp, marginBottom:'16px' }} placeholder="Search clients, reference…" value={incSearch} onChange={e=>setIncSearch(e.target.value)} />

              <div style={card}>
                <div style={{ fontSize:'11px', fontWeight:800, letterSpacing:'.08em', color:'var(--text3)', marginBottom:'14px' }}>INCOME LIST</div>
                {rows.length===0 ? <Empty msg={fInvoices.length===0 ? "No income yet. Click “+ Income” to add one." : "No income matches this filter."} />
                : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><Th cols={['Reference','Client','Issued','Total','Status','Actions']} /></thead>
                  <tbody>{rows.map(i => (
                    <tr key={i.id}>
                      <Td mono>{i.number||'—'}</Td><Td>{i.client_name||'—'}</Td>
                      <Td muted>{fmtDate(i.issue_date)}</Td><Td mono right>{gbp(i.total)}</Td>
                      <Td><Status s={i.status}/></Td>
                      <Td right>
                        <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                          <button style={actBtn} onClick={()=>onDownloadPdf(i)}>PDF</button>
                          <button style={actBtn} onClick={()=>onEditInvoice(i)}>Edit</button>
                          {i.status!=='paid' && <button style={actBtn} onClick={()=>onMarkPaid(i)}>Mark paid</button>}
                          <button style={actBtnDanger} onClick={()=>onDeleteInvoice(i)}>Delete</button>
                        </div>
                      </Td>
                    </tr>))}</tbody>
                </table>}
              </div>
            </div>
            )
          })()}

          {view==='clients' && (
            <Clients uid={uid} clients={clients} invoices={invoices} expenses={expenses} onChange={loadAll} flash={flash} />
          )}

          {view==='expenses' && (
            <div style={card}>
              {fExpenses.length===0 ? <Empty msg="No expenses yet. Click “+ Expense” to add one." />
              : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><Th cols={['Date','Merchant','Category','Amount','Actions']} /></thead>
                <tbody>{fExpenses.map(e => (
                  <tr key={e.id}>
                    <Td muted mono>{fmtDate(e.spent_on)}</Td><Td>{e.merchant} {e.has_receipt && <span style={{ fontSize:'10.5px', color:'var(--green)', border:'1px solid rgba(34,197,94,.4)', borderRadius:'20px', padding:'1px 7px', marginLeft:'6px' }}>receipt</span>}</Td>
                    <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{e.category}</span></Td>
                    <Td mono right>{gbp(e.amount)}</Td>
                    <Td right>
                      <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                        <button style={actBtn} onClick={()=>onEditExpense(e)}>Edit</button>
                        <button style={actBtnDanger} onClick={()=>onDeleteExpense(e)}>Delete</button>
                      </div>
                    </Td>
                  </tr>))}</tbody>
              </table>}
            </div>
          )}

          {view==='banking' && (
            <BankImport uid={uid} existingExpenses={expenses} onImported={()=>{loadAll();flash('Transactions imported')}} />
          )}

          {view==='recurring' && (
            <Recurring expenses={expenses} />
          )}

          {view==='receipts' && (
            <Receipts uid={uid} expenses={expenses} onMatched={()=>{loadAll();flash('Receipt attached')}} />
          )}

          {view==='reports' && (
            <Reports invoices={invoices} expenses={expenses} mileage={mileage} canGold={tierAllows('gold')} taxRate={taxRate} nicRate={nicRate} allowance={allowance} />
          )}

          {view==='documents' && (
            <Documents uid={uid} invoices={invoices} expenses={expenses} />
          )}

          {view==='mileage' && (() => {
            const totalMiles = fMileage.reduce((s,m)=>s+(Number(m.miles)||0),0)
            const first = Math.min(totalMiles, 10000)
            const over = Math.max(0, totalMiles - 10000)
            const claim = first * 0.45 + over * 0.25
            const downloadReport = () => {
              const rows = [['Date','From','To','Purpose','Miles']]
              fMileage.forEach(m => rows.push([m.journey_date||'', m.start_loc||'', m.end_loc||'', (m.purpose||'').replace(/,/g,' '), m.miles||0]))
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
                    {fMileage.length>0 && <button style={btnSec} onClick={downloadReport}>Download HMRC report</button>}
                    <button style={btnPri} onClick={()=>setModal('mileage')}>+ Log journey</button>
                  </div>
                </div>
                {fMileage.length===0 ? <Empty msg="No journeys logged yet. Click “+ Log journey” to add one." />
                : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><Th cols={['Date','From','To','Purpose','Miles','Claim','Actions']} /></thead>
                  <tbody>{fMileage.map(m => (
                    <tr key={m.id}>
                      <Td muted mono>{fmtDate(m.journey_date)}</Td><Td>{m.start_loc}</Td><Td>{m.end_loc}</Td>
                      <Td muted>{m.purpose}</Td><Td mono right>{m.miles}</Td>
                      <Td mono right style={{color:'var(--green)'}}>{gbp(m.claim)}</Td>
                      <Td right>
                        <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                          <button style={actBtn} onClick={()=>onEditMileage(m)}>Edit</button>
                          <button style={actBtnDanger} onClick={()=>onDeleteMileage(m)}>Delete</button>
                        </div>
                      </Td>
                    </tr>))}</tbody>
                </table>}
              </div>
            </>
            )
          })()}

          {view==='tax' && (
            <>
            <div style={{ background:'var(--amber-soft, rgba(245,158,11,0.1))', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'12px', padding:'14px 18px', marginBottom:'16px', fontSize:'13px', color:'var(--text2)', lineHeight:1.6 }}>
              <strong style={{color:'var(--amber)'}}>⚠ Estimate only — not tax advice.</strong> These figures are a rough guide based on simplified UK rates and your recorded income and expenses. They are not a substitute for professional advice or an official HMRC calculation. Always confirm your actual liability with an accountant or HMRC before filing.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div style={card}>
                <div style={{fontWeight:700, marginBottom:'4px'}}>Estimated tax</div>
                <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Using your own rates — adjust below</div>
                <Line label="Taxable profit (after allowance)" v={gbp(taxable)} />
                <Line label={`Income tax (est. @ ${taxRate}%)`} v={gbp(taxable*(Number(taxRate||0)/100))} />
                <Line label={`National Insurance (est. @ ${nicRate}%)`} v={gbp(taxable*(Number(nicRate||0)/100))} />
                <div style={{ borderTop:'1px solid var(--border)', marginTop:'10px', paddingTop:'12px' }}>
                  <Line label="Total estimated" v={gbp(estTax)} bold />
                </div>
              </div>
              <div style={card}>
                <div style={{fontWeight:700, marginBottom:'16px'}}>Your tax rates</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
                  <div>
                    <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Income tax %</div>
                    <input style={inp} type="number" value={taxRate} onChange={e=>setTaxRate(e.target.value)} />
                  </div>
                  <div>
                    <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>NIC %</div>
                    <input style={inp} type="number" value={nicRate} onChange={e=>setNicRate(e.target.value)} />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Tax-free allowance (£)</div>
                    <input style={inp} type="number" value={allowance} onChange={e=>setAllowance(e.target.value)} />
                  </div>
                </div>
                <button style={btnSec} onClick={async()=>{ if(Number(taxRate)<0||Number(nicRate)<0||Number(allowance)<0){ flash('Rates and allowance cannot be negative'); return } await updateUser({ data:{ tax_rate:Number(taxRate), nic_rate:Number(nicRate), tax_allowance:Number(allowance) } }); flash('Tax rates saved') }}>Save my rates</button>
                <div style={{ borderTop:'1px solid var(--border)', margin:'16px 0' }} />
                <div style={{fontWeight:700, marginBottom:'12px'}}>Self Assessment readiness</div>
                <Check ok={invoices.length>0} t="Income recorded" />
                <Check ok={expenses.length>0} t="Expenses recorded" />
                <Check ok={mileage.length>0} t="Mileage logged" />
              </div>
            </div>
            </>
          )}

          {view==='settings' && (
            <Settings session={session} signOut={signOut} flash={flash} onBizChange={(n)=>setBizName(n)} />
          )}

          </>}
        </div>
      </div>

      {modal==='expense' && <ExpenseForm onClose={()=>{setModal(null);setEditExpense(null)}} onSaved={(r)=>{const wasEdit=editExpense;setModal(null);setEditExpense(null);loadAll();flash(wasEdit?'Expense updated':(r&&r.addedClient?`Expense added · ${r.addedClient} added to Clients`:'Expense added'))}} uid={uid} expenses={expenses} edit={editExpense} />}
      {modal==='invoice' && <InvoiceForm onClose={()=>{setModal(null);setEditInvoice(null)}} onSaved={(r)=>{const wasEdit=editInvoice;setModal(null);setEditInvoice(null);loadAll();flash(wasEdit?'Income updated':(r&&r.addedClient?`Income added · ${r.addedClient} added to Clients`:'Income added'))}} uid={uid} invoices={invoices} clients={clients} edit={editInvoice} settings={settings} />}
      {modal==='mileage' && <MileageForm onClose={()=>{setModal(null);setEditMileage(null)}} onSaved={()=>{const wasEdit=editMileage;setModal(null);setEditMileage(null);loadAll();flash(wasEdit?'Journey updated':'Journey logged')}} uid={uid} mileage={mileage} edit={editMileage} />}

      {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', background:'var(--surface2)', border:'1px solid var(--border-light)', borderLeft:'3px solid var(--orange)', borderRadius:'12px', padding:'14px 18px', fontSize:'13.5px', boxShadow:'0 14px 40px rgba(0,0,0,.5)', zIndex:200 }}>✓ {toast}</div>}
    </div>
   </TrialGuard>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/soloops">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Navigate to="/login?tab=register" replace />} />
        <Route path="/:view" element={<Shell />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
