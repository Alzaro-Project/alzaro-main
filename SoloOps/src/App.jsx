import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  getSession, onAuthChange, signOut as dbSignOut, getAccess,
  loadInvoices, loadExpenses, loadMileage, loadClients, loadItems, deleteInvoice, updateInvoice,
  deleteExpense,
  updateUser, loadSettings, getMember, joinProduct, getStaffMapping, loadCategories,
  uploadFile, insertDocument, updateExpenseReceipt,
} from './lib/db.js'
import TrialGuard from './components/TrialGuard.jsx'
import SendInvoice from './components/SendInvoice.jsx'
import ReceiptViewer from './components/ReceiptViewer.jsx'
import { NAV, TIER_ORDER, gbp, fmtDate, card, inp, btnPri, btnSec, KPI, Empty, Th, Td, Status, Line, Check, PAY_LABEL } from './components/UI.jsx'
import { ExpenseForm, InvoiceForm } from './components/forms/Forms.jsx'

import Dashboard from './pages/Dashboard.jsx'
import Items from './pages/Items.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Support from './pages/Support.jsx'
import SupportBanner from './components/SupportBanner.jsx'

const VALID_VIEWS = NAV.map(n => n[0])

function Shell() {
  const navigate = useNavigate()
  const { view: routeView } = useParams()
  // Clients now lives inside the Items page, and Receipts inside Expenses —
  // keep old /clients and /receipts links working.
  const aliased = routeView === 'clients' ? 'items'
    : routeView === 'tax' ? 'reports'
    : routeView === 'receipts' ? 'expenses'
    : routeView
  const view = VALID_VIEWS.includes(aliased) ? aliased : 'dashboard'
  // An unknown view (/soloops/<garbage>) still renders the dashboard; correct
  // the URL to match rather than leaving a stale/invalid path in the bar.
  useEffect(() => {
    // Correct the URL to whatever actually rendered: the alias target for an
    // old link (/clients → /items, /receipts → /expenses), the dashboard for
    // genuine garbage. Previously every alias was bounced to the dashboard,
    // which defeated the point of keeping the old links alive.
    if (routeView && !VALID_VIEWS.includes(routeView)) navigate('/' + view, { replace: true })
  }, [routeView, view, navigate])
  const setView = (v) => navigate(`/${v}`)

  const [session, setSession] = useState(undefined)
  const [yearFilter, setYearFilter] = useState('all')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [invoices, setInvoices] = useState([])
  const [expenses, setExpenses] = useState([])
  const [items, setItems] = useState([])
  const [mileage, setMileage] = useState([])
  const [clients, setClients] = useState([])
  const [bizName, setBizName] = useState('')
  const [settings, setSettings] = useState(null)
  // Subscription membership row (product_members, product='soloops').
  // undefined = not loaded yet (gate rendering); null = no row.
  const [member, setMember] = useState(undefined)
  // Staff mode: set when this login is a staff seat on someone else's Gold
  // workspace — { owner_id, permissions } or null for a normal owner.
  const [staff, setStaff] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  // Set when a data load fails transiently (network/5xx). Distinct from "no
  // account": we show a retry screen instead of signing the user out or
  // silently downgrading their tier.
  const [loadError, setLoadError] = useState(false)
  const [modal, setModal] = useState(null)
  const [editInvoice, setEditInvoice] = useState(null)
  const [sendInvoice, setSendInvoice] = useState(null)
  const [editExpense, setEditExpense] = useState(null)
  const [incFilter, setIncFilter] = useState('all')
  const [incSearch, setIncSearch] = useState('')
  const [expSearch, setExpSearch] = useState('')
  const [expFilter, setExpFilter] = useState('all')
  // Receipt filter on the Expenses page: 'all' | 'with' | 'without'. This is
  // what the old Receipts tab was really for — finding the gaps before filing.
  const [expReceipt, setExpReceipt] = useState('all')
  const [attaching, setAttaching] = useState(null)
  const [categories, setCategories] = useState([])
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useState(() => {
    // Light is the default; dark only when the person chose it. Anyone who
    // already picked dark keeps it — this only changes the no-preference case.
    try { return localStorage.getItem('soloops-theme') || 'light' } catch (e) { return 'light' }
  })
  const [viewReceipt, setViewReceipt] = useState(null)
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

  // Lock body scroll behind the mobile drawer or an open modal so the page
  // underneath doesn't scroll away under the overlay.
  useEffect(() => {
    const locked = mobileNav || !!modal
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileNav, modal])

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
    setLoading(true); setLoadError(false)
    const sess = await getSession()
    const uid = sess?.user?.id
    if (uid) {
      // Staff seat? Then this login works inside the OWNER's workspace: reads
      // and writes land on the owner's data (RLS grants them), tier gating
      // follows the owner's plan, and this user has no soloops_access row of
      // their own — so this check must run before the no-access bounce below.
      // getStaffMapping fails open to null (e.g. migration not run yet).
      const mapping = await getStaffMapping(uid)
      setStaff(mapping)
      if (mapping) {
        const ws = mapping.owner_id
        const { data: access, error: accessErr } = await getAccess(ws)
        if (accessErr) { setLoadError(true); setLoading(false); return }
        let nm = access?.business_name || ''
        try {
          const st = await loadSettings(ws)   // read-only for staff (RLS)
          if (st) setSettings(st)
          if (st && st.business_name) nm = st.business_name
        } catch (_) {}
        setBizName(nm)
        // The OWNER's tier drives gating; staff never joinProduct (that would
        // start a personal SoloOps trial on a staff-only login).
        const { data: mem, error: memErr } = await getMember(ws)
        if (memErr) { setLoadError(true); setLoading(false); return }
        setMember(mem || null)
        // Fall through to the shared data loads — RLS scopes them to the
        // owner's rows for this staff login.
        const [invR, expR, milR, cliR, itmR, catR] = await Promise.all([
          loadInvoices(), loadExpenses(), loadMileage(), loadClients(), loadItems(), loadCategories(),
        ])
        if (invR.error || expR.error || milR.error || cliR.error) {
          setLoadError(true); setLoading(false); return
        }
        setInvoices(invR.data || []); setExpenses(expR.data || [])
        setMileage(milR.data || []); setClients(cliR.data || [])
        setItems(itmR.error ? [] : (itmR.data || []))
        setCategories(catR.data || [])
        setLoading(false)
        return
      }
      const { data: access, error: accessErr } = await getAccess(uid)
      if (accessErr) {
        // Transient failure (network/5xx/expired-mid-request) — do NOT sign out
        // on a blip. Show a retry screen and keep the session intact.
        setLoadError(true); setLoading(false)
        return
      }
      if (!access) {
        // Genuinely no access row: this login isn't a SoloOps account.
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
      const { data: mem, error: memErr } = await getMember(uid)
      if (memErr) {
        // Don't downgrade a paying user to 'basic' (which locks their paid
        // pages) just because this read failed transiently.
        setLoadError(true); setLoading(false)
        return
      }
      setMember(mem || null)
    }
    const [invR, expR, milR, cliR, itmR, catR] = await Promise.all([
      loadInvoices(), loadExpenses(), loadMileage(), loadClients(), loadItems(), loadCategories(),
    ])
    // Items are deliberately NOT part of the hard-fail check: if the
    // soloops_items migration hasn't run yet, the rest of the app must still
    // load — the Items page and quick-picks just come up empty.
    if (invR.error || expR.error || milR.error || cliR.error) {
      // A failed load must not render as an empty account — surface a retry.
      setLoadError(true); setLoading(false)
      return
    }
    setInvoices(invR.data || [])
    setExpenses(expR.data || [])
    setMileage(milR.data || [])
    setClients(cliR.data || [])
    setItems(itmR.error ? [] : (itmR.data || []))
    setCategories(catR.data || [])
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
  // Open the send modal for an invoice. The client record supplies the
  // prefilled recipient; matched by name, same as the PDF endpoint does.
  //
  // Re-read settings first: `settings` is loaded once at login, but the user may
  // have configured their email since (Settings only pushes the business NAME
  // back up via onBizChange). Without this, a trader who sets up email and comes
  // straight here would still be told to set up email.
  const onSendInvoice = async (inv) => {
    try {
      const st = await loadSettings(uid)
      if (st) setSettings(st)
    } catch (_) { /* fall back to whatever we already have */ }
    setSendInvoice(inv); setModal('send')
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
  // Attach a receipt to an existing expense, straight from its row. This
  // replaces the old Receipts tab's guess-by-amount matching: you pick the
  // expense yourself, so there's nothing to get wrong.
  const onAttachReceipt = async (exp, file) => {
    if (!file || !exp?.id) return
    setAttaching(exp.id)
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${uid}/${crypto.randomUUID()}-${safe}`
      const { error: upErr } = await uploadFile(storagePath, file)
      if (upErr) throw upErr
      const { error: docErr } = await insertDocument({
        user_id: uid, type:'Receipt', name:file.name,
        storage_path:storagePath, size_bytes:file.size, expense_id:exp.id
      })
      if (docErr) throw docErr
      const { error } = await updateExpenseReceipt(exp.id, file.name)
      if (error) throw error
      loadAll(); flash('Receipt attached')
    } catch (err) { flash(err?.message || 'Could not attach the receipt') }
    setAttaching(null)
  }
  const signOut = async () => { await dbSignOut(); window.location.href = '/soloops/login' }

  const [taxRate, setTaxRate] = useState(session?.user?.user_metadata?.tax_rate ?? 20)
  const [nicRate, setNicRate] = useState(session?.user?.user_metadata?.nic_rate ?? 9)
  const [allowance, setAllowance] = useState(session?.user?.user_metadata?.tax_allowance ?? 12570)

  // These three initialise from user_metadata, but on first mount `session` is
  // still undefined (it resolves asynchronously below), so the initialisers
  // above capture the 20/9/12570 defaults and useState never re-runs them.
  // Sync from user_metadata once the user is known so a user's SAVED rates
  // actually drive the Tax page and the dashboard "Est. tax" KPI after reload.
  useEffect(() => {
    const md = session?.user?.user_metadata
    if (!md) return
    if (md.tax_rate != null) setTaxRate(md.tax_rate)
    if (md.nic_rate != null) setNicRate(md.nic_rate)
    if (md.tax_allowance != null) setAllowance(md.tax_allowance)
  }, [session?.user?.id])

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
  // The REPORTING PERIOD slice. Deliberately scoped to the Reports/Tax page
  // only: the Income and Expenses lists always show everything, so a range
  // picked over on Reports can't silently hide rows on another page.
  const fInvoices = invoices.filter(i=>inYear(i.issue_date))
  const fExpenses = expenses.filter(e=>inYear(e.spent_on))
  const fMileage  = mileage.filter(m=>inYear(m.journey_date))
  const periodLabel = yearFilter === 'all' ? 'All time'
    : yearFilter === 'custom'
      ? (rangeFrom || rangeTo ? `${rangeFrom ? fmtDate(rangeFrom) : 'the start'} – ${rangeTo ? fmtDate(rangeTo) : 'today'}` : 'Custom range')
      : yearFilter

  const revenue = fInvoices.filter(i => i.status === 'paid').reduce((s,i)=>s+Number(i.total||0),0)
  const totalExp = fExpenses.reduce((s,e)=>s+Number(e.amount||0),0)
  const profit = revenue - totalExp
  const taxable = Math.max(0, profit - Number(allowance||0))
  const estTax = Math.max(0, taxable * (Number(taxRate||0)/100) + taxable * (Number(nicRate||0)/100))


  // Which sections can this login see? Owners: everything. Staff: only the
  // sections the owner ticked — and never Settings (billing, SMTP, plan).
  // The database enforces the same map through RLS; this only shapes the UI.
  const staffAllows = (k) => !staff || (k !== 'settings' && staff.permissions?.[k] === true)
  const staffHome = staff ? (NAV.find(([k]) => staffAllows(k))?.[0] || null) : null
  useEffect(() => {
    if (staff && !staffAllows(view)) {
      if (staffHome) navigate('/' + staffHome, { replace: true })
    }
  }, [staff, view])

  if (session === undefined)
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}>Loading…</div>

  if (session === null) {
    window.location.href = '/soloops/login'
    return null
  }

  // A load failed transiently — offer a retry rather than bouncing to login or
  // rendering a wrongly-downgraded/empty account.
  if (loadError)
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
        <div style={{ ...card, maxWidth:'420px', textAlign:'center' }}>
          <div style={{ fontSize:'40px', marginBottom:'10px' }}>⚠️</div>
          <div style={{ fontSize:'18px', fontWeight:800, marginBottom:'8px' }}>Couldn’t load your account</div>
          <div style={{ color:'var(--text2)', fontSize:'14px', marginBottom:'18px' }}>Something went wrong reaching the server — your session is still active. Check your connection and try again.</div>
          <div style={{ display:'flex', gap:'10px', justifyContent:'center', flexWrap:'wrap' }}>
            <button style={btnPri} onClick={()=>loadAll()}>Try again</button>
            <button style={btnSec} onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    )

  // Wait for the membership row before rendering, so gating uses the real tier
  // rather than briefly showing 'basic' and locking pages.
  if (member === undefined)
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text2)'}}>Loading…</div>

  // Workspace id: whose rows we read and write. Own id for owners; the
  // owner's id for staff — every page and form receives this as `uid`, so
  // staff-created records land in the owner's workspace automatically.
  const uid = staff?.owner_id || session.user.id

  if (staff && !staffHome)
    return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',textAlign:'center',color:'var(--text2)'}}>
      Your access to this workspace has no sections enabled yet — ask the account owner to tick some in Settings → Users.
    </div>

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
            clients.forEach(c => { if ((c.name||'').toLowerCase().includes(q)) hits.push({ type:'Client', label:c.name, view:'items' }) })
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
          {NAV.filter(([k]) => staffAllows(k)).map(([k,label,,min,icon]) => {
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
          <h1 style={{ fontSize:'20px', fontWeight:800, display:'flex', alignItems:'center', gap:'10px' }}>
            {NAV.find(n=>n[0]===view)[1]}
            {staff && <span title={'Staff access to '+(bizName||'this workspace')} style={{ fontSize:'10.5px', fontWeight:800, letterSpacing:'.5px', textTransform:'uppercase', color:'var(--orange-light)', background:'var(--orange-subtle)', border:'1px solid rgba(249,115,22,.35)', borderRadius:'6px', padding:'3px 8px' }}>Staff</span>}
          </h1>
          <div className="solo-header-actions" style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
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
            const rows = invoices.filter(i =>
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
                {rows.length===0 ? <Empty msg={invoices.length===0 ? "No income yet. Click “+ Income” to add one." : "No income matches this filter."} />
                : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><Th cols={['Reference','Client','Issued','Total','Paid via','Status','Actions']} /></thead>
                  <tbody>{rows.map(i => (
                    <tr key={i.id}>
                      <Td mono>{i.number||'—'}</Td><Td>{i.client_name||'—'}</Td>
                      <Td muted>{fmtDate(i.issue_date)}</Td><Td mono right>{gbp(i.total)}</Td>
                      <Td muted>{PAY_LABEL[i.paid_method] && i.paid_method ? PAY_LABEL[i.paid_method] : '—'}</Td>
                      <Td><Status s={i.status}/></Td>
                      <Td right>
                        <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                          <button style={actBtn} onClick={()=>onSendInvoice(i)}>Send</button>
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

          {view==='items' && (
            <Items uid={uid} items={items} clients={clients} invoices={invoices} expenses={expenses} categories={categories} onChange={loadAll} flash={flash} />
          )}

          {view==='expenses' && (() => {
            const q = expSearch.trim().toLowerCase()
            const cats = ['all', ...[...new Set(expenses.map(e=>e.category).filter(Boolean))].sort()]
            const missing = expenses.filter(e => !e.has_receipt).length
            const rows = expenses.filter(e =>
              (expFilter==='all' || e.category===expFilter) &&
              (expReceipt==='all' || (expReceipt==='with' ? !!e.has_receipt : !e.has_receipt)) &&
              (!q || (`${e.merchant||''} ${e.category||''} ${e.notes||''}`).toLowerCase().includes(q))
            )
            return (
            <div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px', alignItems:'center' }}>
                {[['all','All receipts'],['with','Has receipt'],['without',`Missing receipt${missing?` (${missing})`:''}`]].map(([v,label]) => (
                  <button key={v} onClick={()=>setExpReceipt(v)} style={{
                    background: expReceipt===v ? 'var(--orange-subtle)' : 'transparent',
                    color: expReceipt===v ? 'var(--orange-light)' : 'var(--text3)',
                    border:'1px solid '+(expReceipt===v?'rgba(249,115,22,.35)':'var(--border)'),
                    borderRadius:'999px', padding:'6px 14px', fontSize:'12.5px', fontWeight:700, cursor:'pointer'
                  }}>{label}</button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'14px' }}>
                {cats.map(c => (
                  <button key={c} onClick={()=>setExpFilter(c)} style={{
                    background: expFilter===c ? 'var(--surface2)' : 'transparent',
                    color: expFilter===c ? 'var(--text)' : 'var(--text3)',
                    border:'1px solid '+(expFilter===c?'var(--border-light)':'transparent'),
                    borderRadius:'10px', padding:'7px 16px', fontSize:'13px', fontWeight:700,
                    textTransform: c==='all' ? 'capitalize' : 'none', cursor:'pointer'
                  }}>{c==='all' ? 'All' : c}</button>
                ))}
              </div>
              <input style={{ ...inp, marginBottom:'16px' }} placeholder="Search merchant, category, notes…" value={expSearch} onChange={e=>setExpSearch(e.target.value)} />
            <div style={card}>
              {rows.length===0 ? <Empty msg={expenses.length===0 ? "No expenses yet. Click “+ Expense” to add one." : "No expenses match this filter."} />
              : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><Th cols={['Date','Merchant','Category','Amount','Paid via','Actions']} /></thead>
                <tbody>{rows.map(e => (
                  <tr key={e.id}>
                    <Td muted mono>{fmtDate(e.spent_on)}</Td><Td>{e.merchant} {e.has_receipt && <span onClick={()=>setViewReceipt(e)} title="View receipt" style={{ fontSize:'10.5px', color:'var(--green)', border:'1px solid rgba(34,197,94,.4)', borderRadius:'20px', padding:'1px 7px', marginLeft:'6px', cursor:'pointer' }}>receipt</span>}{e.notes && <div style={{ fontSize:'11.5px', color:'var(--text3)', marginTop:'2px' }}>{e.notes}</div>}</Td>
                    <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{e.category}</span></Td>
                    <Td mono right>{gbp(e.amount)}</Td>
                    <Td muted>{PAY_LABEL[e.paid_method] && e.paid_method ? PAY_LABEL[e.paid_method] : '—'}</Td>
                    <Td right>
                      <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                        {e.has_receipt
                          ? <button style={actBtn} onClick={()=>setViewReceipt(e)}>View receipt</button>
                          : <label style={{ ...actBtn, display:'inline-flex', alignItems:'center', opacity: attaching===e.id ? .6 : 1 }} title="Attach a receipt to this expense">
                              {attaching===e.id ? 'Uploading…' : '📎 Receipt'}
                              <input type="file" accept="image/*,.pdf" disabled={attaching===e.id}
                                onChange={ev=>{ const f=ev.target.files?.[0]; ev.target.value=''; if(f) onAttachReceipt(e, f) }}
                                style={{ display:'none' }} />
                            </label>}
                        <button style={actBtn} onClick={()=>onEditExpense(e)}>Edit</button>
                        <button style={actBtnDanger} onClick={()=>onDeleteExpense(e)}>Delete</button>
                      </div>
                    </Td>
                  </tr>))}</tbody>
              </table>}
            </div>
            </div>
            )
          })()}

          {view==='reports' && (
            <>
            <Reports invoices={fInvoices} expenses={fExpenses} mileage={fMileage} canGold={tierAllows('gold')} taxRate={taxRate} nicRate={nicRate} allowance={allowance}
              period={{ yearFilter, setYearFilter, rangeFrom, setRangeFrom, rangeTo, setRangeTo, availableYears, periodLabel }} />
            {tierAllows('gold') ? (
              <div style={{ marginTop:'16px' }}>
            <div style={{ background:'var(--amber-soft, rgba(245,158,11,0.1))', border:'1px solid rgba(245,158,11,0.3)', borderRadius:'12px', padding:'14px 18px', marginBottom:'16px', fontSize:'13px', color:'var(--text2)', lineHeight:1.6 }}>
              <strong style={{color:'var(--amber)'}}>⚠ Estimate only — not tax advice.</strong> These figures are a rough guide based on simplified UK rates and your recorded income and expenses. They are not a substitute for professional advice or an official HMRC calculation. Always confirm your actual liability with an accountant or HMRC before filing.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
              <div style={card}>
                <div style={{fontWeight:700, marginBottom:'4px'}}>Estimated tax</div>
                <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Using your own rates — adjust below · <span style={{color:'var(--orange-light)'}}>{periodLabel}</span></div>
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
                <button style={btnSec} onClick={async()=>{ if(Number(taxRate)<0||Number(nicRate)<0||Number(allowance)<0){ flash('Rates and allowance cannot be negative'); return } const { error } = await updateUser({ data:{ tax_rate:Number(taxRate), nic_rate:Number(nicRate), tax_allowance:Number(allowance) } }); flash(error ? 'Could not save your rates — please try again' : 'Tax rates saved') }}>Save my rates</button>
                <div style={{ borderTop:'1px solid var(--border)', margin:'16px 0' }} />
                <div style={{fontWeight:700, marginBottom:'12px'}}>Self Assessment readiness</div>
                <Check ok={invoices.length>0} t="Income recorded" />
                <Check ok={expenses.length>0} t="Expenses recorded" />
                <Check ok={mileage.length>0} t="Mileage logged" />
              </div>
            </div>
              </div>
            ) : (
              <div style={{ ...card, marginTop:'16px', textAlign:'center', color:'var(--text2)', fontSize:'13.5px' }}>
                🔒 The tax estimate is a Gold feature. <span onClick={()=>navigate('/settings#billing')} style={{ color:'var(--orange)', cursor:'pointer', fontWeight:600 }}>View plans</span>
              </div>
            )}
            </>
          )}

          {view==='settings' && (
            <Settings session={session} member={member} signOut={signOut} flash={flash} onBizChange={(n)=>setBizName(n)} />
          )}

          </>}
        </div>
      </div>

      {modal==='expense' && <ExpenseForm onClose={()=>{setModal(null);setEditExpense(null)}} onSaved={(r)=>{const wasEdit=editExpense;setModal(null);setEditExpense(null);loadAll();flash(wasEdit?'Expense updated':(r&&r.addedClient?`Expense added · ${r.addedClient} added to Clients`:'Expense added'))}} uid={uid} expenses={expenses} categories={categories} clients={clients} edit={editExpense} />}
      {modal==='send' && sendInvoice && (
        <SendInvoice
          invoice={sendInvoice}
          client={clients.find(c => (c.name||'').toLowerCase() === (sendInvoice.client_name||'').toLowerCase())}
          settings={settings}
          onClose={()=>{ setModal(null); setSendInvoice(null) }}
          goToEmailSettings={()=>navigate('/settings#email')}
          onSent={async ()=>{
            const inv = sendInvoice
            setModal(null); setSendInvoice(null)
            // Only a draft becomes 'sent'. An invoice that's already paid (or
            // overdue) must not be demoted just because a copy was re-sent.
            if (inv.status === 'draft') {
              const { error } = await updateInvoice(inv.id, { status: 'sent' })
              if (error) { flash('Sent — but the status could not be updated'); loadAll(); return }
            }
            loadAll()
            flash('Invoice sent')
          }}
        />
      )}

      {modal==='invoice' && <InvoiceForm items={items} onClose={()=>{setModal(null);setEditInvoice(null)}} onSaved={(r)=>{const wasEdit=editInvoice;setModal(null);setEditInvoice(null);loadAll();flash(wasEdit?'Income updated':(r&&r.addedClient?`Income added · ${r.addedClient} added to Clients`:'Income added'))}} uid={uid} invoices={invoices} clients={clients} edit={editInvoice} settings={settings} />}

      {viewReceipt && <ReceiptViewer expense={viewReceipt} onClose={()=>setViewReceipt(null)} />}

      {toast && <div style={{ position:'fixed', bottom:'24px', right:'24px', maxWidth:'calc(100vw - 48px)', background:'var(--surface2)', border:'1px solid var(--border-light)', borderLeft:'3px solid var(--orange)', borderRadius:'12px', padding:'14px 18px', fontSize:'13.5px', boxShadow:'0 14px 40px rgba(0,0,0,.5)', zIndex:200 }}>✓ {toast}</div>}
    </div>
   </TrialGuard>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/soloops">
      {/* Renders only inside an admin support session; null otherwise. */}
      <SupportBanner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Navigate to="/login?tab=register" replace />} />
        {/* Must sit above /:view — that route matches any single segment. */}
        <Route path="/support" element={<Support />} />
        <Route path="/:view" element={<Shell />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
