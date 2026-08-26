import React, { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { sb } from './lib/supabase.js'

// =============================================================================
// Alzaro Accountant Portal — stage 3: login, set-password, client list.
//
// An accountant is an ordinary auth user whose accountant_links rows (created
// when a client invites them) point at their user id. Everything this portal
// can read is governed by the RLS in migrations/015: the links themselves via
// accountant_links_acct_select, and (stage 4) client data via accountant_can().
// There are no write policies for accountants anywhere — the portal is a
// window, not a door.
// =============================================================================

// ---- tiny style kit (self-contained; dark, neutral, deliberately not any
// vertical's brand — the portal is cross-vertical) ----------------------------
// Neutrals are CSS variables so the whole portal can flip between dark and
// light with one attribute on <html>. Accent / green / red stay literal hex:
// they read fine on both themes AND the code builds alpha shades by hex
// concatenation (`${C.accent}44`), which a var() reference can't do.
const C = {
  bg: 'var(--acct-bg)', surface: 'var(--acct-surface)', surface2: 'var(--acct-surface2)',
  border: 'var(--acct-border)', text: 'var(--acct-text)', text2: 'var(--acct-text2)',
  text3: 'var(--acct-text3)', accent: '#f59e0b',
  green: '#22c55e', red: '#ef4444',
}

// Theme: 'dark' (default) or 'light', persisted per browser. Applied as
// data-theme on <html> so the CSS variables below re-resolve everywhere,
// inline styles included.
const THEME_KEY = 'alzaro-accountant-theme'
function applyTheme(t) {
  document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark'
}
if (typeof document !== 'undefined') {
  let saved = null
  try { saved = window.localStorage.getItem(THEME_KEY) } catch (e) {}
  applyTheme(saved === 'light' ? 'light' : 'dark')
}
const page = { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Manrope, sans-serif' }
const inp = { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '11px 14px', color: C.text, fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' }
const btn = { background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '11px 18px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', width: '100%' }
const PRODUCT_LABEL = { soloops: 'SoloOps', tyreops: 'TyreOps', garageops: 'GarageOps', serviceops: 'ServiceOps', propertyops: 'PropertyOps' }

// Responsive rules for the auth screens (login / set-password). Inline styles
// can't hold media queries, so the handful the card needs are injected once:
// it fills the viewport and centres on laptop, and on phones it scales down,
// keeps ≥44px tap targets, uses 16px inputs (no iOS auto-zoom), and never
// scrolls sideways.
if (typeof document !== 'undefined' && !document.getElementById('acct-auth-css')) {
  const st = document.createElement('style')
  st.id = 'acct-auth-css'
  st.textContent = `
    :root, [data-theme="dark"] {
      --acct-bg: #0f1115; --acct-surface: #171a21; --acct-surface2: #1e222b;
      --acct-border: #2a2f3a; --acct-text: #e8eaf0; --acct-text2: #aab0be;
      --acct-text3: #7a8194;
      color-scheme: dark;
    }
    [data-theme="light"] {
      --acct-bg: #f4f5f7; --acct-surface: #ffffff; --acct-surface2: #eef0f4;
      --acct-border: #d9dde5; --acct-text: #1b1e26; --acct-text2: #4b5263;
      --acct-text3: #737a8c;
      color-scheme: light;
    }
    html, body { margin: 0; padding: 0; background: var(--acct-bg); }
    input::placeholder { color: var(--acct-text3); }
    /* Tables already sit in overflow-x wrappers; make touch scrolling smooth
       and keep tap targets comfortable on phones. */
    table { -webkit-overflow-scrolling: touch; }
    @media (max-width: 640px) {
      main { padding-left: 14px !important; padding-right: 14px !important; }
      header > div { padding-left: 14px !important; padding-right: 14px !important; }
      table { font-size: 13px; }
    }
    .acct-theme-fab {
      position: fixed; right: 16px; bottom: 16px; z-index: 50;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--acct-surface); color: var(--acct-text);
      border: 1px solid var(--acct-border);
      font-size: 18px; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(0,0,0,.25);
    }
    .acct-auth-wrap { min-height: 100vh; min-height: 100dvh; box-sizing: border-box; }
    .acct-auth-card { box-sizing: border-box; }
    .acct-auth-card input, .acct-auth-card button { min-height: 44px; box-sizing: border-box; }
    @media (max-width: 480px) {
      .acct-auth-wrap { padding: 16px !important; align-items: flex-start !important; padding-top: 7vh !important; }
      .acct-auth-card { padding: 24px 20px !important; border-radius: 14px !important; }
      .acct-auth-card input, .acct-auth-card button { font-size: 16px !important; }
    }
  `
  document.head.appendChild(st)
}

function Brand({ sub }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '22px' }}>
      <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>
        Alzaro <span style={{ color: C.accent }}>Accountant</span>
      </div>
      {sub && <div style={{ color: C.text2, fontSize: '13px', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function CardShell({ children }) {
  return (
    <div className="acct-auth-wrap" style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box' }}>
      <div className="acct-auth-card" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '18px', padding: '36px', width: '420px', maxWidth: '100%' }}>
        {children}
      </div>
    </div>
  )
}

// ---- Login ------------------------------------------------------------------
function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  const signIn = async () => {
    setErr('')
    if (!email.trim() || !password) { setErr('Enter your email and password'); return }
    setBusy(true)
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) { setErr(error.message || 'Could not sign in'); return }
    navigate('/clients')
  }

  const forgot = async () => {
    setErr('')
    if (!email.trim()) { setErr('Enter your email first, then click "Forgotten password"'); return }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://alzaro.co.uk/accountant/reset-password',
    })
    if (error) { setErr(error.message || 'Could not send the reset email'); return }
    setSent(true)
  }

  return (
    <CardShell>
      <Brand sub="Sign in to view your clients' books" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={inp} type="password" placeholder="Password" value={password}
          onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && signIn()} />
        {err && <div style={{ color: C.red, fontSize: '12.5px' }}>{err}</div>}
        {sent && <div style={{ color: C.green, fontSize: '12.5px' }}>Reset email sent — check your inbox.</div>}
        <button style={btn} disabled={busy} onClick={signIn}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button onClick={forgot} style={{ background: 'none', border: 'none', color: C.text3, fontSize: '12.5px', cursor: 'pointer', padding: '2px' }}>
          Forgotten password?
        </button>
      </div>
      <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: `1px solid ${C.border}`, color: C.text3, fontSize: '12px', lineHeight: 1.55 }}>
        No account? Access is by invitation — ask your client to add you from their
        Alzaro Settings, and you'll receive an email to set up your login.
      </div>
    </CardShell>
  )
}

// ---- Set / reset password (invite emails land here) -------------------------
function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [accountEmail, setAccountEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    let sub
    const check = async () => {
      const { data } = await sb.auth.getSession()
      const session = data.session || null
      if (session) { setReady(true); setAccountEmail(session.user?.email || '') }
      else {
        const { data: d } = sb.auth.onAuthStateChange((event, s) => {
          if (s || event === 'PASSWORD_RECOVERY') setReady(true)
          if (s?.user?.email) setAccountEmail(s.user.email)
        })
        sub = d.subscription
      }
      setChecking(false)
    }
    check()
    return () => sub?.unsubscribe?.()
  }, [])

  const submit = async () => {
    if (!password || !confirm) return setErr('Enter and confirm your new password')
    if (password.length < 8) return setErr('Password needs at least 8 characters')
    if (password !== confirm) return setErr('Passwords do not match')
    setBusy(true); setErr(''); setOk('')
    const { error } = await sb.auth.updateUser({ password })
    setBusy(false)
    if (error) { setErr(error.message || 'Could not set the password'); return }
    setOk('Password set! Taking you to your clients…')
    setTimeout(() => navigate('/clients'), 1400)
  }

  return (
    <CardShell>
      <Brand sub={accountEmail ? `Set a password for ${accountEmail}` : 'Set your password'} />
      {checking ? (
        <div style={{ color: C.text3, fontSize: '13px', textAlign: 'center' }}>Checking your link…</div>
      ) : !ready ? (
        <div style={{ color: C.text2, fontSize: '13px', lineHeight: 1.6 }}>
          This link has expired or was already used. Go to the{' '}
          <a href="/accountant/login" style={{ color: C.accent }}>sign-in page</a> and use
          “Forgotten password” to get a fresh one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input style={inp} type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} />
          <input style={inp} type="password" placeholder="Confirm password" value={confirm}
            onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          {err && <div style={{ color: C.red, fontSize: '12.5px' }}>{err}</div>}
          {ok && <div style={{ color: C.green, fontSize: '12.5px' }}>{ok}</div>}
          <button style={btn} disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Set password'}</button>
        </div>
      )}
    </CardShell>
  )
}

// ---- Client list ------------------------------------------------------------
function Clients() {
  const navigate = useNavigate()
  const [session, setSession] = useState(undefined) // undefined=checking
  const [links, setLinks] = useState(null)          // null=loading

  useEffect(() => {
    let sub
    sb.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null))
    sub = data.subscription
    return () => sub?.unsubscribe?.()
  }, [])

  const load = useCallback(async () => {
    // RLS (accountant_links_acct_select) scopes this to rows pointing at us.
    const { data: u } = await sb.auth.getUser()
    // Only links where I'm the ACCOUNTANT. RLS also (correctly) lets a CLIENT
    // read their own links, so without this filter someone signing into the
    // portal with their business login would see themselves listed as if they
    // were the accountant.
    const { data, error } = await sb
      .from('accountant_links')
      .select('id, client_id, product, client_name, permissions, status, created_at')
      .eq('accountant_user_id', u?.user?.id || '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: true })
    setLinks(error ? [] : (data || []))
  }, [])
  useEffect(() => { if (session) load() }, [session, load])

  const signOut = async () => { await sb.auth.signOut(); navigate('/login') }

  if (session === undefined) return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 }}>Loading…</div>
  if (session === null) return <Navigate to="/login" replace />

  return (
    <div style={page}>
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.3px' }}>
            Alzaro <span style={{ color: C.accent }}>Accountant</span>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.text3, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '2px 9px' }}>View only</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: C.text3, wordBreak: 'break-all' }}>{session.user?.email}</span>
            <button onClick={signOut} style={{ background: 'transparent', color: C.text2, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '7px 14px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>Your clients</div>
        <div style={{ fontSize: '13px', color: C.text3, marginBottom: '22px' }}>
          Businesses that have granted you view-only access to their books.
        </div>

        {links === null && <div style={{ color: C.text3, fontSize: '13px' }}>Loading…</div>}

        {links !== null && links.length === 0 && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '26px', color: C.text2, fontSize: '13.5px', lineHeight: 1.6, maxWidth: '560px' }}>
            No clients yet. When a business adds you as their accountant from their Alzaro
            Settings, they'll appear here automatically — nothing to set up on your side.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(links || []).map(l => {
            const visible = Object.entries(l.permissions || {}).filter(([, v]) => v === true).map(([k]) => k)
            return (
              <div key={l.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800 }}>
                    {l.client_name || 'Client'}
                    <span style={{ marginLeft: '10px', fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.accent, border: `1px solid ${C.accent}44`, background: `${C.accent}1a`, borderRadius: '20px', padding: '2px 9px', verticalAlign: 'middle' }}>
                      {PRODUCT_LABEL[l.product] || l.product}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: C.text3, marginTop: '5px' }}>
                    {visible.length
                      ? 'You can see: ' + visible.join(', ')
                      : 'No sections shared yet — ask your client to tick some in their Settings.'}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <button onClick={() => navigate('/clients/' + l.id)}
                    style={{ background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 800, cursor: 'pointer' }}>
                    Open books
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}

// ---- Read-only books view ---------------------------------------------------
// Everything here is a SELECT as the accountant; the accountant_can() RLS from
// migration 015 decides row by row what's visible, and there are no write
// policies — so this whole surface is physically incapable of changing data.
const gbp = (n) => '£' + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtD = (d) => d ? new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB') : '—'

function dlCsv(filename, rows) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const csv = rows.map(r => r.map(esc).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function ClientBooks() {
  const { linkId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(undefined)
  const [link, setLink] = useState(undefined)      // undefined=loading, null=not found
  const [tab, setTab] = useState(null)
  const [inv, setInv] = useState([])
  const [exp, setExp] = useState([])
  const [mil, setMil] = useState([])
  const [year, setYear] = useState('all')
  const [receiptBusy, setReceiptBusy] = useState(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let sub
    sb.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s || null))
    sub = data.subscription
    return () => sub?.unsubscribe?.()
  }, [])

  useEffect(() => {
    if (!session) return
    ;(async () => {
      const { data: u } = await sb.auth.getUser()
      const { data, error } = await sb
        .from('accountant_links')
        .select('id, client_id, product, client_name, permissions, status')
        .eq('id', linkId)
        .eq('accountant_user_id', u?.user?.id || '00000000-0000-0000-0000-000000000000')
        .maybeSingle()
      if (error || !data) { setLink(null); return }
      setLink(data)
      // SoloOps loads its tables here (user-scoped). Other verticals render a
      // dedicated books component that loads its own data — bail before the
      // SoloOps-specific queries so we don't fire them for another product.
      if (data.product !== 'soloops') return
      const p = data.permissions || {}
      const first = ['dashboard', 'income', 'expenses', 'reports'].find(k => p[k] === true)
      setTab(first || null)
      // Load what the visibility allows; RLS enforces regardless — these
      // checks just avoid firing queries that would return nothing.
      const cid = data.client_id
      if (p.income === true || p.dashboard === true || p.reports === true) {
        const { data: d } = await sb.from('soloops_invoices')
          .select('id, number, client_name, issue_date, due_date, status, total, paid_method')
          .eq('user_id', cid).order('issue_date', { ascending: false })
        setInv(d || [])
      }
      if (p.expenses === true || p.dashboard === true || p.reports === true) {
        const { data: d } = await sb.from('soloops_expenses')
          .select('id, spent_on, merchant, category, amount, notes, has_receipt, receipt_name')
          .eq('user_id', cid).order('spent_on', { ascending: false })
        setExp(d || [])
        const { data: m } = await sb.from('soloops_mileage')
          .select('id, journey_date, miles, purpose').eq('user_id', cid)
        setMil(m || [])
      }
    })()
  }, [session, linkId])

  if (session === undefined || (session && link === undefined)) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 }}>Loading…</div>
  }
  if (session === null) return <Navigate to="/login" replace />
  if (link === null) return <Navigate to="/clients" replace />

  // Per-vertical books view. SoloOps stays inline below (byte-identical);
  // TyreOps/GarageOps are account-scoped with computed VAT, so each has its own
  // component.
  if (link.product === 'tyreops') return <TyreOpsBooks link={link} onBack={() => navigate('/clients')} />
  if (link.product === 'garageops') return <GarageOpsBooks link={link} onBack={() => navigate('/clients')} />
  if (link.product === 'serviceops') return <ServiceOpsBooks link={link} onBack={() => navigate('/clients')} />
  if (link.product === 'propertyops') return <PropertyOpsBooks link={link} onBack={() => navigate('/clients')} />

  const perms = link.permissions || {}
  const TABS = [
    ['dashboard', 'Overview'], ['income', 'Income'], ['expenses', 'Expenses'], ['reports', 'Reports'],
  ].filter(([k]) => perms[k] === true)

  // Period filter over both datasets
  const years = [...new Set([...inv.map(i => String(i.issue_date || '').slice(0, 4)), ...exp.map(e => String(e.spent_on || '').slice(0, 4))])].filter(y => /^\d{4}$/.test(y)).sort().reverse()
  const inY = (d) => year === 'all' || String(d || '').startsWith(year)
  const fInv = inv.filter(i => inY(i.issue_date))
  const fExp = exp.filter(e => inY(e.spent_on))
  const revenue = fInv.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total || 0), 0)
  const outstanding = fInv.filter(i => i.status !== 'paid').reduce((s, i) => s + Number(i.total || 0), 0)
  const totalExp = fExp.reduce((s, e) => s + Number(e.amount || 0), 0)

  const viewReceipt = async (e) => {
    setNote('')
    setReceiptBusy(e.id)
    try {
      const { data: docs } = await sb.from('soloops_documents')
        .select('storage_path').eq('expense_id', e.id).limit(1)
      const path = docs?.[0]?.storage_path
      if (!path) { setNote('This receipt was recorded before file storage — only the name was saved.'); return }
      const { data: s, error } = await sb.storage.from('soloops-files').createSignedUrl(path, 600)
      if (error || !s?.signedUrl) { setNote('Could not open the receipt — the file may have been removed.'); return }
      window.open(s.signedUrl, '_blank', 'noopener')
    } finally {
      setReceiptBusy(null)
    }
  }

  const th = { textAlign: 'left', fontSize: '10.5px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.text3, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }
  const td = { fontSize: '13px', padding: '9px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }
  const kpi = (label, val) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 18px', minWidth: '160px', flex: '1 1 160px' }}>
      <div style={{ fontSize: '11px', color: C.text3, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{val}</div>
    </div>
  )

  const byCat = {}
  fExp.forEach(e => { const k = e.category || 'Other'; byCat[k] = (byCat[k] || 0) + Number(e.amount || 0) })

  return (
    <div style={page}>
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/clients')} style={{ background: 'none', border: 'none', color: C.text2, fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Clients</button>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>{link.client_name || 'Client'}</div>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.accent, border: `1px solid ${C.accent}44`, background: `${C.accent}1a`, borderRadius: '20px', padding: '2px 9px' }}>{PRODUCT_LABEL[link.product] || link.product}</span>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.text3, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '2px 9px' }}>View only</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={year} onChange={e => setYear(e.target.value)}
              style={{ ...inp, width: 'auto', padding: '7px 10px', fontSize: '12.5px' }}>
              <option value="all">All time</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: tab === k ? `${C.accent}1a` : 'transparent',
              color: tab === k ? C.accent : C.text3,
              border: `1px solid ${tab === k ? C.accent + '55' : C.border}`,
              borderRadius: '999px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 20px' }}>
        {TABS.length === 0 && (
          <div style={{ color: C.text2, fontSize: '13.5px' }}>
            No sections are shared with you yet — ask your client to tick some in their Settings.
          </div>
        )}

        {note && <div style={{ color: C.text2, fontSize: '12.5px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>{note}</div>}

        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '22px' }}>
              {kpi('Revenue (paid)', gbp(revenue))}
              {kpi('Outstanding', gbp(outstanding))}
              {kpi('Expenses', gbp(totalExp))}
              {kpi('Net', gbp(revenue - totalExp))}
            </div>
            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              Figures follow the period selector above. Income and Expenses tabs hold the detail.
            </div>
          </div>
        )}

        {tab === 'income' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
              <thead><tr>
                <th style={th}>Reference</th><th style={th}>Client</th><th style={th}>Issued</th>
                <th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Total</th>
              </tr></thead>
              <tbody>
                {fInv.length === 0 && <tr><td style={td} colSpan={5}><span style={{ color: C.text3 }}>No income in this period.</span></td></tr>}
                {fInv.map(i => (
                  <tr key={i.id}>
                    <td style={td}>{i.number || '—'}</td>
                    <td style={td}>{i.client_name || '—'}</td>
                    <td style={td}>{fmtD(i.issue_date)}</td>
                    <td style={td}>
                      <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px',
                        color: i.status === 'paid' ? C.green : i.status === 'overdue' ? C.red : C.text2 }}>{i.status}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{gbp(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'expenses' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
              <thead><tr>
                <th style={th}>Date</th><th style={th}>Merchant</th><th style={th}>Category</th>
                <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={{ ...th, textAlign: 'right' }}>Receipt</th>
              </tr></thead>
              <tbody>
                {fExp.length === 0 && <tr><td style={td} colSpan={5}><span style={{ color: C.text3 }}>No expenses in this period.</span></td></tr>}
                {fExp.map(e => (
                  <tr key={e.id}>
                    <td style={td}>{fmtD(e.spent_on)}</td>
                    <td style={td}>{e.merchant || '—'}{e.notes && <div style={{ fontSize: '11.5px', color: C.text3, marginTop: '2px' }}>{e.notes}</div>}</td>
                    <td style={td}>{e.category || 'Other'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{gbp(e.amount)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {e.has_receipt
                        ? <button onClick={() => viewReceipt(e)} disabled={receiptBusy === e.id}
                            style={{ background: 'transparent', color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: receiptBusy === e.id ? .6 : 1 }}>
                            {receiptBusy === e.id ? 'Opening…' : 'View'}
                          </button>
                        : <span style={{ color: C.text3, fontSize: '12px' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '620px' }}>
            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              CSV downloads over the selected period ({year === 'all' ? 'All time' : year}) — open in Excel/Sheets.
            </div>
            {[
              ['Profit & loss', () => {
                const rows = [['Profit & Loss'], ['Client', link.client_name || ''], ['Period', year === 'all' ? 'All time' : year], [],
                  ['Revenue (paid)', revenue.toFixed(2)], ['Outstanding', outstanding.toFixed(2)],
                  ['Expenses', totalExp.toFixed(2)], ['Net profit', (revenue - totalExp).toFixed(2)]]
                dlCsv('profit-loss.csv', rows)
              }],
              ['Income report', () => {
                const rows = [['Income Report'], ['Period', year === 'all' ? 'All time' : year], [],
                  ['Invoice', 'Client', 'Issued', 'Status', 'Total'],
                  ...fInv.map(i => [i.number || '', i.client_name || '', i.issue_date || '', i.status || '', Number(i.total || 0).toFixed(2)])]
                dlCsv('income-report.csv', rows)
              }],
              ['Expense report (by category)', () => {
                const rows = [['Expense Report by Category'], ['Period', year === 'all' ? 'All time' : year], [],
                  ['Category', 'Total'], ...Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v.toFixed(2)]),
                  [], ['All expenses'], ['Date', 'Merchant', 'Category', 'Amount'],
                  ...fExp.map(e => [e.spent_on || '', e.merchant || '', e.category || 'Other', Number(e.amount || 0).toFixed(2)])]
                dlCsv('expense-report.csv', rows)
              }],
              ['Mileage log', () => {
                const rows = [['Mileage Log'], ['Period', year === 'all' ? 'All time' : year], [],
                  ['Date', 'Miles', 'Purpose'],
                  ...mil.filter(m => inY(m.journey_date)).map(m => [m.journey_date || '', m.miles || 0, m.purpose || ''])]
                dlCsv('mileage-log.csv', rows)
              }],
            ].map(([label, fn]) => (
              <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{label}</div>
                <button onClick={fn} style={{ marginLeft: 'auto', background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}>Download</button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// =============================================================================
// TyreOps books — read-only, account-scoped.
//
// TyreOps core tables are scoped by account_id (= product_members.id), while the
// portal only holds the client's user_id (link.client_id). So we FIRST resolve
// the client's tyreops member row (account_id + tier), then query everything by
// account_id. Every query is a SELECT and fails open (empty / defaults) so a
// missing RLS grant degrades to blank tables, never a white screen.
//
// Money is never a stored column here — invoice totals are computed from
// invoice_lines and depend on the VAT scheme. Two faithful replicas live below:
//   * calcInvoiceVat / invoiceTotal — mirror TyreOps/src/pages/Invoices.jsx so
//     the Invoices tab matches the client's invoice list.
//   * computeVatReport — mirrors TyreOps/src/pages/VATReport.jsx so the VAT tab
//     matches the client's own VAT return (incl. margin VAT = margin ÷ 6, and
//     Input VAT on stock SOLD, not purchased).
// Follow-ups is intentionally not surfaced in the portal yet (even if its
// permission key is ticked).
// =============================================================================

// Per-line + per-invoice VAT, byte-for-byte the same formula as TyreOps'
// Invoices.jsx calcVAT (margin scheme uses margin × 0.2 there — deliberately
// different from the VAT report's margin ÷ 6).
function calcInvoiceVat(lines, scheme, flatRate, tier) {
  let vat = 0
  ;(lines || []).forEach(l => {
    const lt = l.qty * l.unit
    const margin = l.qty * (l.unit - (l.cost || 0))
    if (l.lineType === 'used' && l.marginScheme && tier === 'gold') vat += margin * 0.2
    else if (scheme === 'standard') vat += lt * 0.2
    else if (scheme === 'flatrate') vat += lt * (flatRate / 100)
  })
  return vat
}
const invoiceSubtotal = (lines) => (lines || []).reduce((a, l) => a + l.qty * l.unit, 0)
const invoiceTotal = (inv, flatRate, tier) =>
  invoiceSubtotal(inv.lines) + calcInvoiceVat(inv.lines, inv.vatScheme, flatRate, tier)

// Faithful replica of TyreOps/src/pages/VATReport.jsx's period computation.
// isGold gates the margin scheme; flatRate feeds the flat-rate branch; batches
// supply the real stock cost for Input VAT. Returns the same figures the client
// sees on their own VAT Report screen.
function computeVatReport(invoices, batches, { flatRate, isGold, inPeriod }) {
  let totalSales = 0, vatOnSales = 0, stockCostSold = 0, serviceCosts = 0
  let marginSales = 0, marginCosts = 0, marginVAT = 0
  ;(invoices || []).forEach(inv => {
    if (inv.status === 'paid' || inv.status === 'sent') {
      if (inPeriod(inv.date)) {
        ;(inv.lines || []).forEach(l => {
          const lineTotal = l.qty * l.unit
          totalSales += lineTotal
          if (l.lineType === 'used' && l.marginScheme && isGold) {
            const margin = l.qty * (l.unit - (l.cost || 0))
            marginSales += lineTotal
            marginCosts += l.qty * (l.cost || 0)
            marginVAT += margin / 6
          } else if (inv.vatScheme === 'standard') {
            vatOnSales += lineTotal * 0.2
          } else if (inv.vatScheme === 'flatrate') {
            vatOnSales += lineTotal * ((flatRate || 8.5) / 100)
          }
          if (l.lineType === 'new' && l.batchId) {
            const batch = batches.find(b => b.id === l.batchId)
            if (batch) stockCostSold += l.qty * batch.cost
            else stockCostSold += l.qty * (l.cost || 0)
          } else if (l.lineType === 'new' && l.cost) {
            stockCostSold += l.qty * l.cost
          } else if (l.lineType === 'service') {
            serviceCosts += l.qty * (l.cost || 0)
          }
        })
      }
    }
  })
  const vatOnPurchases = stockCostSold * 0.2
  const totalVAT = vatOnSales + marginVAT
  const vatDue = totalVAT - vatOnPurchases
  return { totalSales, vatOnSales, stockCostSold, serviceCosts, marginSales, marginCosts, marginVAT, vatOnPurchases, totalVAT, vatDue }
}

const TYRE_QMONTHS = { Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12] }
function currentQuarterYear() {
  const now = new Date()
  const m = now.getMonth() + 1
  const q = m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4'
  return { quarter: q, year: String(now.getFullYear()) }
}

function TyreOpsBooks({ link, onBack }) {
  const perms = link.permissions || {}
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState(null)
  const [tier, setTier] = useState(null)
  const [flatRate, setFlatRate] = useState(8.5)
  const [invoices, setInvoices] = useState([])
  const [batches, setBatches] = useState([])
  const [skus, setSkus] = useState([])
  const [usedTyres, setUsedTyres] = useState([])
  const [customers, setCustomers] = useState([])
  const [note, setNote] = useState('')
  const [fileBusy, setFileBusy] = useState(null)

  // VAT tab period (quarterly, like the client's VAT Report)
  const cur = currentQuarterYear()
  const [quarter, setQuarter] = useState(cur.quarter)
  const [year, setYear] = useState(cur.year)

  // Follow-ups is intentionally not shown in the portal yet.
  const TABS = [
    ['dashboard', 'Overview'], ['invoices', 'Invoices'], ['inventory', 'Inventory'],
    ['purchases', 'Purchases'], ['customers', 'Customers'], ['vat', 'VAT'],
  ].filter(([k]) => perms[k] === true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Resolve account_id + tier from the client's tyreops membership. RLS must
      // let the accountant read this one row; if it can't, fail open to empty.
      let accountId = null, memberTier = null
      try {
        const { data: m } = await sb.from('product_members')
          .select('id, tier').eq('user_id', link.client_id).eq('product', 'tyreops').maybeSingle()
        accountId = m?.id || null
        memberTier = m?.tier || null
      } catch { /* fail open */ }
      if (!alive) return
      setTier(memberTier)
      setTab(TABS[0]?.[0] || null)
      if (!accountId) { setReady(true); return }

      // Flat rate only matters for the flat-rate scheme; default 8.5 like the app.
      try {
        const { data: s } = await sb.from('product_settings')
          .select('flat_rate').eq('user_id', link.client_id).eq('product', 'tyreops').maybeSingle()
        if (alive && s?.flat_rate != null) setFlatRate(Number(s.flat_rate))
      } catch { /* keep default */ }

      const p = perms
      const needInvoices = p.invoices === true || p.dashboard === true || p.vat === true
      const needBatches = p.vat === true || p.inventory === true || p.purchases === true || p.dashboard === true

      if (needInvoices) {
        try {
          const { data: invs } = await sb.from('invoices')
            .select('id, cust_name, cust_email, reg, date, due, status, vat_scheme, payment_method, paid_at')
            .eq('account_id', accountId).is('deleted_at', null).order('date', { ascending: false })
          const ids = (invs || []).map(i => i.id)
          const linesByInv = {}
          if (ids.length) {
            const { data: lines } = await sb.from('invoice_lines')
              .select('invoice_id, line_desc, qty, unit, cost, batch_id, used_id, line_type, margin_scheme')
              .in('invoice_id', ids)
            ;(lines || []).forEach(l => {
              ;(linesByInv[l.invoice_id] || (linesByInv[l.invoice_id] = [])).push({
                desc: l.line_desc, qty: Number(l.qty) || 0, unit: Number(l.unit) || 0, cost: Number(l.cost) || 0,
                batchId: l.batch_id, usedId: l.used_id, lineType: l.line_type, marginScheme: l.margin_scheme === true,
              })
            })
          }
          const mapped = (invs || []).map(i => ({
            id: i.id, custName: i.cust_name, custEmail: i.cust_email, reg: i.reg,
            date: i.date, due: i.due, status: i.status, vatScheme: i.vat_scheme,
            paymentMethod: i.payment_method, paidAt: i.paid_at, lines: linesByInv[i.id] || [],
          }))
          if (alive) setInvoices(mapped)
        } catch { /* fail open */ }
      }

      if (needBatches) {
        try {
          const { data: b } = await sb.from('batches')
            .select('id, sku_id, date, qty, remaining, cost, supplier, ref, invoice_url, damaged')
            .eq('account_id', accountId).is('deleted_at', null).order('date', { ascending: false })
          if (alive) setBatches((b || []).map(x => ({ ...x, cost: Number(x.cost) || 0, skuId: x.sku_id, invoiceUrl: x.invoice_url })))
        } catch { /* fail open */ }
      }

      if (p.inventory === true) {
        try {
          const { data: s } = await sb.from('skus')
            .select('id, brand, model, w, p, r, sell, season').eq('account_id', accountId).is('deleted_at', null).order('brand')
          if (alive) setSkus(s || [])
        } catch { /* fail open */ }
        try {
          const { data: u } = await sb.from('used_tyres')
            .select('id, brand, model, w, p, r, cost, sell, source_cust, date, sold')
            .eq('account_id', accountId).is('deleted_at', null).order('date', { ascending: false })
          if (alive) setUsedTyres(u || [])
        } catch { /* fail open */ }
      }

      if (p.customers === true) {
        try {
          const { data: c } = await sb.from('customers')
            .select('id, name, email, phone, reg, vehicle').eq('account_id', accountId).is('deleted_at', null).order('name')
          if (alive) setCustomers(c || [])
        } catch { /* fail open */ }
      }

      if (alive) setReady(true)
    })()
    return () => { alive = false }
  }, [link])

  const isGold = (tier || '').toLowerCase() === 'gold'

  // ---- derived ----
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + invoiceTotal(i, flatRate, tier), 0)
  const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + invoiceTotal(i, flatRate, tier), 0)
  const stockValue = batches.reduce((s, b) => s + (Number(b.remaining) || 0) * (Number(b.cost) || 0), 0)

  // Stock-on-hand per SKU (sum of remaining across its batches)
  const stockBySku = {}
  batches.forEach(b => { if (b.skuId) stockBySku[b.skuId] = (stockBySku[b.skuId] || 0) + (Number(b.remaining) || 0) })

  // VAT period predicate — same quarter/year model as the client's VAT Report
  const [mFrom, mTo] = TYRE_QMONTHS[quarter] || [10, 12]
  const inPeriod = (dateStr) => {
    const d = new Date(dateStr)
    if (isNaN(d)) return false
    const mm = d.getMonth() + 1
    return d.getFullYear() === parseInt(year, 10) && mm >= mFrom && mm <= mTo
  }
  const vat = computeVatReport(invoices, batches, { flatRate, isGold, inPeriod })
  const currentYear = new Date().getFullYear()
  const vatYears = [currentYear, currentYear - 1, currentYear - 2].map(String)

  const th = { textAlign: 'left', fontSize: '10.5px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.text3, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }
  const td = { fontSize: '13px', padding: '9px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }
  const kpi = (label, val) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 18px', minWidth: '160px', flex: '1 1 160px' }}>
      <div style={{ fontSize: '11px', color: C.text3, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{val}</div>
    </div>
  )
  const sizeOf = (t) => [t.w, t.p, t.r].filter(v => v != null && v !== '').length ? `${t.w || '—'}/${t.p || '—'}R${t.r || '—'}` : '—'

  const viewPurchaseFile = async (b) => {
    setNote('')
    setFileBusy(b.id)
    try {
      let path = b.invoiceUrl
      if (!path) { setNote('No purchase invoice file was saved for this batch.'); return }
      const marker = '/purchase-invoices/'
      const idx = path.indexOf(marker)
      if (idx !== -1) path = path.slice(idx + marker.length)
      const { data: s, error } = await sb.storage.from('purchase-invoices').createSignedUrl(path, 300)
      if (error || !s?.signedUrl) { setNote('Could not open the invoice file — it may have been removed.'); return }
      window.open(s.signedUrl, '_blank', 'noopener')
    } finally {
      setFileBusy(null)
    }
  }

  if (!ready) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 }}>Loading…</div>
  }

  return (
    <div style={page}>
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.text2, fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Clients</button>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>{link.client_name || 'Client'}</div>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.accent, border: `1px solid ${C.accent}44`, background: `${C.accent}1a`, borderRadius: '20px', padding: '2px 9px' }}>{PRODUCT_LABEL[link.product] || link.product}</span>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.text3, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '2px 9px' }}>View only</span>
        </div>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: tab === k ? `${C.accent}1a` : 'transparent',
              color: tab === k ? C.accent : C.text3,
              border: `1px solid ${tab === k ? C.accent + '55' : C.border}`,
              borderRadius: '999px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 20px' }}>
        {TABS.length === 0 && (
          <div style={{ color: C.text2, fontSize: '13.5px' }}>
            No sections are shared with you yet — ask your client to tick some in their Settings.
          </div>
        )}

        {note && <div style={{ color: C.text2, fontSize: '12.5px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>{note}</div>}

        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '22px' }}>
              {kpi('Revenue (paid)', gbp(revenue))}
              {kpi('Outstanding', gbp(outstanding))}
              {kpi('Stock value', gbp(stockValue))}
              {kpi('Invoices', String(invoices.length))}
            </div>
            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              Revenue and outstanding use each invoice's computed total (subtotal + VAT), matching the client's invoice list. The VAT tab holds the full VAT return.
            </div>
          </div>
        )}

        {tab === 'invoices' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
              <thead><tr>
                <th style={th}>Invoice</th><th style={th}>Customer</th><th style={th}>Reg</th><th style={th}>Date</th>
                <th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Subtotal</th>
                <th style={{ ...th, textAlign: 'right' }}>VAT</th><th style={{ ...th, textAlign: 'right' }}>Total</th>
              </tr></thead>
              <tbody>
                {invoices.length === 0 && <tr><td style={td} colSpan={8}><span style={{ color: C.text3 }}>No invoices.</span></td></tr>}
                {invoices.map(i => {
                  const sub = invoiceSubtotal(i.lines)
                  const v = calcInvoiceVat(i.lines, i.vatScheme, flatRate, tier)
                  return (
                    <tr key={i.id}>
                      <td style={td}>{i.id}</td>
                      <td style={td}>{i.custName || '—'}</td>
                      <td style={td}>{i.reg || '—'}</td>
                      <td style={td}>{fmtD(i.date)}</td>
                      <td style={td}>
                        <span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px',
                          color: i.status === 'paid' ? C.green : i.status === 'overdue' ? C.red : C.text2 }}>{i.status}</span>
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{gbp(sub)}</td>
                      <td style={{ ...td, textAlign: 'right', color: C.text2, fontVariantNumeric: 'tabular-nums' }}>{gbp(v)}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{gbp(sub + v)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'inventory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>New tyre stock</div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                  <thead><tr>
                    <th style={th}>Brand</th><th style={th}>Model</th><th style={th}>Size</th><th style={th}>Season</th>
                    <th style={{ ...th, textAlign: 'right' }}>Sell</th><th style={{ ...th, textAlign: 'right' }}>In stock</th>
                  </tr></thead>
                  <tbody>
                    {skus.length === 0 && <tr><td style={td} colSpan={6}><span style={{ color: C.text3 }}>No stock items.</span></td></tr>}
                    {skus.map(s => (
                      <tr key={s.id}>
                        <td style={td}>{s.brand || '—'}</td>
                        <td style={td}>{s.model || '—'}</td>
                        <td style={td}>{sizeOf(s)}</td>
                        <td style={td}>{s.season || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{s.sell != null ? gbp(s.sell) : '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stockBySku[s.id] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Used / part-ex tyres</div>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                  <thead><tr>
                    <th style={th}>Brand</th><th style={th}>Model</th><th style={th}>Size</th><th style={th}>Date</th>
                    <th style={{ ...th, textAlign: 'right' }}>Cost</th><th style={{ ...th, textAlign: 'right' }}>Sell</th><th style={th}>Sold</th>
                  </tr></thead>
                  <tbody>
                    {usedTyres.length === 0 && <tr><td style={td} colSpan={7}><span style={{ color: C.text3 }}>No used tyres.</span></td></tr>}
                    {usedTyres.map(u => (
                      <tr key={u.id}>
                        <td style={td}>{u.brand || '—'}</td>
                        <td style={td}>{u.model || '—'}</td>
                        <td style={td}>{sizeOf(u)}</td>
                        <td style={td}>{fmtD(u.date)}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.cost != null ? gbp(u.cost) : '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.sell != null ? gbp(u.sell) : '—'}</td>
                        <td style={td}>{u.sold ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === 'purchases' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead><tr>
                <th style={th}>Date</th><th style={th}>Supplier</th><th style={th}>Ref</th>
                <th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={{ ...th, textAlign: 'right' }}>Cost/tyre</th>
                <th style={{ ...th, textAlign: 'right' }}>Total cost</th><th style={{ ...th, textAlign: 'right' }}>VAT (20%)</th>
                <th style={{ ...th, textAlign: 'right' }}>Invoice</th>
              </tr></thead>
              <tbody>
                {batches.length === 0 && <tr><td style={td} colSpan={8}><span style={{ color: C.text3 }}>No purchases recorded.</span></td></tr>}
                {batches.map(b => {
                  const qty = Number(b.qty) || 0
                  const totalCost = qty * (Number(b.cost) || 0)
                  return (
                    <tr key={b.id}>
                      <td style={td}>{fmtD(b.date)}</td>
                      <td style={td}>{b.supplier || '—'}</td>
                      <td style={td}>{b.ref || '—'}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{qty}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{gbp(b.cost)}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{gbp(totalCost)}</td>
                      <td style={{ ...td, textAlign: 'right', color: C.green, fontVariantNumeric: 'tabular-nums' }}>{gbp(totalCost * 0.2)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {b.invoiceUrl
                          ? <button onClick={() => viewPurchaseFile(b)} disabled={fileBusy === b.id}
                              style={{ background: 'transparent', color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: fileBusy === b.id ? .6 : 1 }}>
                              {fileBusy === b.id ? 'Opening…' : 'View'}
                            </button>
                          : <span style={{ color: C.text3, fontSize: '12px' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'customers' && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}>
              <thead><tr>
                <th style={th}>Name</th><th style={th}>Email</th><th style={th}>Phone</th><th style={th}>Reg</th><th style={th}>Vehicle</th>
              </tr></thead>
              <tbody>
                {customers.length === 0 && <tr><td style={td} colSpan={5}><span style={{ color: C.text3 }}>No customers.</span></td></tr>}
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={td}>{c.name || '—'}</td>
                    <td style={td}>{c.email || '—'}</td>
                    <td style={td}>{c.phone || '—'}</td>
                    <td style={td}>{c.reg || '—'}</td>
                    <td style={td}>{c.vehicle || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'vat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>Quarter</div>
                <select value={quarter} onChange={e => setQuarter(e.target.value)} style={{ ...inp, width: 'auto', padding: '8px 10px', fontSize: '12.5px' }}>
                  <option value="Q1">Q1 (Jan–Mar)</option>
                  <option value="Q2">Q2 (Apr–Jun)</option>
                  <option value="Q3">Q3 (Jul–Sep)</option>
                  <option value="Q4">Q4 (Oct–Dec)</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>Year</div>
                <select value={year} onChange={e => setYear(e.target.value)} style={{ ...inp, width: 'auto', padding: '8px 10px', fontSize: '12.5px' }}>
                  {vatYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {kpi('Total sales (ex VAT)', gbp(vat.totalSales))}
              {kpi(vat.vatDue >= 0 ? 'Net VAT due to HMRC' : 'Net VAT refund', gbp(Math.abs(vat.vatDue)))}
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                <thead><tr>
                  <th style={th}>HMRC Box</th><th style={th}>Description</th><th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr></thead>
                <tbody>
                  {[
                    ['Box 1', 'VAT due on sales & outputs', vat.totalVAT],
                    ['Box 4', 'VAT reclaimed on purchases (stock sold)', vat.vatOnPurchases],
                    ['Box 5', `Net VAT to ${vat.vatDue >= 0 ? 'pay' : 'reclaim'}`, Math.abs(vat.vatDue)],
                    ['Box 6', 'Total value of sales (ex VAT)', vat.totalSales],
                    ['Box 7', 'Total value of purchases (ex VAT)', vat.stockCostSold],
                  ].map(([box, label, val]) => (
                    <tr key={box}>
                      <td style={{ ...td, fontWeight: 800, color: C.accent }}>{box}</td>
                      <td style={td}>{label}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{gbp(val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isGold && vat.marginSales > 0 && (
              <div style={{ fontSize: '12.5px', color: C.text3 }}>
                Includes margin-scheme used tyres: sales {gbp(vat.marginSales)}, cost {gbp(vat.marginCosts)}, VAT on margin {gbp(vat.marginVAT)} (margin ÷ 6).
              </div>
            )}

            <div>
              <button onClick={() => {
                const rows = [
                  ['VAT Return'], ['Client', link.client_name || ''], ['Period', `${quarter} ${year}`], [],
                  ['Box', 'Description', 'Amount'],
                  ['Box 1', 'VAT due on sales & outputs', vat.totalVAT.toFixed(2)],
                  ['Box 4', 'VAT reclaimed on purchases (stock sold)', vat.vatOnPurchases.toFixed(2)],
                  ['Box 5', `Net VAT to ${vat.vatDue >= 0 ? 'pay' : 'reclaim'}`, Math.abs(vat.vatDue).toFixed(2)],
                  ['Box 6', 'Total value of sales (ex VAT)', vat.totalSales.toFixed(2)],
                  ['Box 7', 'Total value of purchases (ex VAT)', vat.stockCostSold.toFixed(2)],
                ]
                dlCsv(`VAT-${quarter}-${year}.csv`, rows)
              }} style={{ background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}>
                Download VAT return (CSV)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// =============================================================================
// GarageOps books — read-only, account-scoped.
//
// GarageOps shares the account_id scoping and the invoices/invoice_lines/
// customers tables with TyreOps, and adds its own: parts, services,
// labour_rates (Items); vehicles, jobs (Database); part_batches (Purchases);
// jobs by booked date (Calendar). Resolve the client's product_members.id +
// tier first, then query by account_id. Every query is SELECT-only and fails
// open.
//
// Money replicas (kept faithful to each client screen):
//   * calcGarageInvoiceVat / garageInvoiceTotal — mirror GarageOps'
//     Invoices.jsx calcVAT (per-invoice vatScheme AND per-invoice vatRate).
//   * dashGarageInvoiceTotal — mirrors Dashboard.jsx invoiceTotal for the
//     Overview KPIs (no flat-rate branch there, on purpose).
//   * the Reports tab mirrors Reports.jsx: Revenue (ex VAT) / Cost of Sales /
//     Gross Profit / Margin over a date range, plus the same CSV exports
//     (Sales, P&L, VAT Summary, Customers) computed identically — including
//     that page's deliberately simplified flat-20% VAT summary.
// =============================================================================

// Invoice-list VAT + total — byte-for-byte GarageOps' Invoices.jsx calcVAT
// (uses the invoice's stored vatRate; margin scheme uses margin × 0.2).
function calcGarageInvoiceVat(lines, scheme, flatRate, tier, vatRate = 20) {
  const rate = (vatRate != null && Number.isFinite(Number(vatRate)) ? Number(vatRate) : 20) / 100
  let vat = 0
  ;(lines || []).forEach(l => {
    const lt = l.qty * l.unit
    const margin = l.qty * (l.unit - (l.cost || 0))
    if (l.lineType === 'used' && l.marginScheme && tier === 'gold') vat += margin * 0.2
    else if (scheme === 'standard') vat += lt * rate
    else if (scheme === 'flatrate') vat += lt * (flatRate / 100)
  })
  return vat
}
const garageInvoiceTotal = (inv, flatRate, tier) =>
  invoiceSubtotal(inv.lines) + calcGarageInvoiceVat(inv.lines, inv.vatScheme, flatRate, tier, inv.vatRate)

// Overview KPI total — mirrors GarageOps Dashboard.jsx invoiceTotal exactly
// (standard uses the stored rate; margin uses margin × 0.2; anything else adds
// no VAT — note there is no flat-rate branch here, matching the client).
function dashGarageInvoiceTotal(inv) {
  const rate = (inv.vatRate != null ? Number(inv.vatRate) : 20) / 100
  return (inv.lines || []).reduce((sum, l) => {
    const lineTotal = (l.qty || 0) * (l.unit || 0)
    const vat = l.lineType === 'used' && l.marginScheme
      ? (l.qty || 0) * ((l.unit || 0) - (l.cost || 0)) * 0.2
      : (inv.vatScheme === 'standard' ? lineTotal * rate : 0)
    return sum + lineTotal + vat
  }, 0)
}

// Replica of GarageOps Reports.jsx getDateRange (inclusive [from, to]).
function garageDateRange(preset, customFrom, customTo) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'week': { const s = new Date(today); s.setDate(today.getDate() - today.getDay()); return { from: s, to: today } }
    case 'month': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today }
    case 'quarter': { const qm = Math.floor(today.getMonth() / 3) * 3; return { from: new Date(today.getFullYear(), qm, 1), to: today } }
    case 'year': return { from: new Date(today.getFullYear(), 0, 1), to: today }
    case 'custom': return { from: customFrom ? new Date(customFrom) : today, to: customTo ? new Date(customTo) : today }
    default: return { from: today, to: today }
  }
}

function GarageOpsBooks({ link, onBack }) {
  const perms = link.permissions || {}
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState(null)
  const [tier, setTier] = useState(null)
  const [flatRate, setFlatRate] = useState(8.5)
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [parts, setParts] = useState([])
  const [partBatches, setPartBatches] = useState([])
  const [services, setServices] = useState([])
  const [labourRates, setLabourRates] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [jobs, setJobs] = useState([])
  const [note, setNote] = useState('')
  const [fileBusy, setFileBusy] = useState(null)

  // Reports tab date range
  const [datePreset, setDatePreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const TABS = [
    ['dashboard', 'Overview'], ['invoices', 'Invoices'], ['customers', 'Customers'],
    ['items', 'Items'], ['database', 'Database'], ['purchases', 'Purchases'],
    ['calendar', 'Calendar'], ['reports', 'Reports'],
  ].filter(([k]) => perms[k] === true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      let accountId = null, memberTier = null
      try {
        const { data: m } = await sb.from('product_members')
          .select('id, tier').eq('user_id', link.client_id).eq('product', 'garageops').maybeSingle()
        accountId = m?.id || null
        memberTier = m?.tier || null
      } catch { /* fail open */ }
      if (!alive) return
      setTier(memberTier)
      setTab(TABS[0]?.[0] || null)
      if (!accountId) { setReady(true); return }

      try {
        const { data: s } = await sb.from('product_settings')
          .select('flat_rate').eq('user_id', link.client_id).eq('product', 'garageops').maybeSingle()
        if (alive && s?.flat_rate != null) setFlatRate(Number(s.flat_rate))
      } catch { /* keep default */ }

      const p = perms
      const needInvoices = p.invoices === true || p.dashboard === true || p.reports === true
      const needCustomers = p.customers === true || p.reports === true
      const needPartBatches = p.items === true || p.purchases === true
      const needJobs = p.database === true || p.calendar === true

      if (needInvoices) {
        try {
          const { data: invs } = await sb.from('invoices')
            .select('id, cust_id, cust_name, cust_email, reg, date, due, status, vat_scheme, vat_rate, payment_method, paid_at')
            .eq('account_id', accountId).order('date', { ascending: false })
          const ids = (invs || []).map(i => i.id)
          const linesByInv = {}
          if (ids.length) {
            const { data: lines } = await sb.from('invoice_lines')
              .select('invoice_id, line_desc, qty, unit, cost, batch_id, used_id, line_type, margin_scheme')
              .in('invoice_id', ids)
            ;(lines || []).forEach(l => {
              ;(linesByInv[l.invoice_id] || (linesByInv[l.invoice_id] = [])).push({
                desc: l.line_desc, qty: Number(l.qty) || 0, unit: Number(l.unit) || 0, cost: Number(l.cost) || 0,
                batchId: l.batch_id, usedId: l.used_id, lineType: l.line_type, marginScheme: l.margin_scheme === true,
              })
            })
          }
          const mapped = (invs || []).map(i => ({
            id: i.id, custId: i.cust_id, custName: i.cust_name, custEmail: i.cust_email, reg: i.reg,
            date: i.date, due: i.due, status: i.status, vatScheme: i.vat_scheme,
            vatRate: i.vat_rate != null ? Number(i.vat_rate) : 20,
            paymentMethod: i.payment_method, paidAt: i.paid_at, lines: linesByInv[i.id] || [],
          }))
          if (alive) setInvoices(mapped)
        } catch { /* fail open */ }
      }

      if (needCustomers) {
        try {
          const { data: c } = await sb.from('customers')
            .select('id, name, email, phone, reg, vehicle').eq('account_id', accountId).order('name')
          if (alive) setCustomers(c || [])
        } catch { /* fail open */ }
      }

      if (p.items === true) {
        try {
          const { data: pr } = await sb.from('parts')
            .select('id, part_number, name, category, brand, sell_price').eq('account_id', accountId).order('name')
          if (alive) setParts((pr || []).map(x => ({ ...x, partNumber: x.part_number, sellPrice: x.sell_price })))
        } catch { /* fail open */ }
        try {
          const { data: sv } = await sb.from('services')
            .select('id, name, category, default_duration_min, default_price').eq('account_id', accountId).order('name')
          if (alive) setServices((sv || []).map(x => ({ ...x, durationMin: x.default_duration_min, defaultPrice: x.default_price })))
        } catch { /* fail open */ }
        try {
          const { data: lr } = await sb.from('labour_rates')
            .select('id, name, hourly_rate, is_default').eq('account_id', accountId).order('name')
          if (alive) setLabourRates((lr || []).map(x => ({ ...x, hourlyRate: x.hourly_rate, isDefault: x.is_default })))
        } catch { /* fail open */ }
      }

      if (needPartBatches) {
        try {
          const { data: b } = await sb.from('part_batches')
            .select('id, part_id, date, qty, remaining, cost, supplier, ref, invoice_url')
            .eq('account_id', accountId).order('date', { ascending: false })
          if (alive) setPartBatches((b || []).map(x => ({ ...x, partId: x.part_id, cost: Number(x.cost) || 0, invoiceUrl: x.invoice_url })))
        } catch { /* fail open */ }
      }

      if (p.database === true) {
        try {
          const { data: v } = await sb.from('vehicles')
            .select('id, customer_id, reg, make, model, year, colour, fuel_type, mot_due, tax_due')
            .eq('account_id', accountId).order('reg')
          if (alive) setVehicles((v || []).map(x => ({ ...x, fuelType: x.fuel_type, motDue: x.mot_due, taxDue: x.tax_due })))
        } catch { /* fail open */ }
      }

      if (needJobs) {
        try {
          const { data: j } = await sb.from('jobs')
            .select('id, cust_name, reg, status, booked_date, complete_date, mileage_in, mileage_out')
            .eq('account_id', accountId).order('booked_date', { ascending: false })
          if (alive) setJobs((j || []).map(x => ({ ...x, custName: x.cust_name, bookedDate: x.booked_date, completeDate: x.complete_date, mileageIn: x.mileage_in, mileageOut: x.mileage_out })))
        } catch { /* fail open */ }
      }

      if (alive) setReady(true)
    })()
    return () => { alive = false }
  }, [link])

  // ---- derived: Overview KPIs (dashInvoiceTotal, faithful to the client dash) ----
  const today0 = new Date(); today0.setHours(0, 0, 0, 0)
  const revenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + dashGarageInvoiceTotal(i), 0)
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft').reduce((s, i) => s + dashGarageInvoiceTotal(i), 0)
  const overdue = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft' && i.due && new Date(i.due) < today0).reduce((s, i) => s + dashGarageInvoiceTotal(i), 0)

  // Stock-on-hand per part (sum of remaining across its batches)
  const stockByPart = {}
  partBatches.forEach(b => { if (b.partId) stockByPart[b.partId] = (stockByPart[b.partId] || 0) + (Number(b.remaining) || 0) })

  // ---- Reports (mirror Reports.jsx) ----
  const { from: dateFrom, to: dateTo } = garageDateRange(datePreset, customFrom, customTo)
  const repInvoices = invoices.filter(inv => {
    if (inv.status === 'draft') return false
    const d = new Date(inv.date)
    return d >= dateFrom && d <= dateTo
  })
  const repRevenue = repInvoices.reduce((s, inv) => s + inv.lines.reduce((a, l) => a + l.qty * l.unit, 0), 0)
  const repCost = repInvoices.reduce((s, inv) => s + inv.lines.reduce((a, l) => a + l.qty * (l.cost || 0), 0), 0)
  const repProfit = repRevenue - repCost
  const repMargin = repRevenue > 0 ? Math.round((repProfit / repRevenue) * 100) : 0
  const rangeLabel = `${dateFrom.toLocaleDateString('en-GB')}–${dateTo.toLocaleDateString('en-GB')}`

  const exportSales = () => {
    const rows = [['Invoice #', 'Date', 'Customer', 'Vehicle Reg', 'Items', 'Subtotal', 'VAT', 'Total', 'Status', 'Payment Method']]
    repInvoices.forEach(inv => {
      const subtotal = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
      // Accurate per-invoice VAT (scheme / rate / margin / tier) — the same
      // calc the invoice list uses, not a flat 20%.
      const v = calcGarageInvoiceVat(inv.lines, inv.vatScheme, flatRate, tier, inv.vatRate)
      rows.push([inv.id, inv.date, inv.custName, inv.reg || '', inv.lines.length, subtotal.toFixed(2), v.toFixed(2), (subtotal + v).toFixed(2), inv.status, inv.paymentMethod || 'N/A'])
    })
    dlCsv(`Sales_Report_${rangeLabel}.csv`, rows)
  }
  const exportProfit = () => {
    const rows = [['Invoice #', 'Date', 'Customer', 'Revenue', 'Cost', 'Gross Profit', 'Margin %']]
    repInvoices.forEach(inv => {
      const rev = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
      const cost = inv.lines.reduce((a, l) => a + l.qty * (l.cost || 0), 0)
      const profit = rev - cost
      const m = rev > 0 ? Math.round((profit / rev) * 100) : 0
      rows.push([inv.id, inv.date, inv.custName, rev.toFixed(2), cost.toFixed(2), profit.toFixed(2), `${m}%`])
    })
    rows.push(['TOTAL', '', '', repRevenue.toFixed(2), repCost.toFixed(2), repProfit.toFixed(2), `${repMargin}%`])
    dlCsv(`Profit_Loss_Report_${rangeLabel}.csv`, rows)
  }
  const exportVat = () => {
    // Output VAT: accurate per-invoice calc (per-invoice vatScheme + vatRate,
    // margin scheme at gold, flat rate) — the same figure the invoice list
    // shows, NOT a flat 20% on every line. Input VAT stays the reclaim on stock
    // sold (new lines) at 20%, which is the only cost-VAT source available.
    let outputVAT = 0, inputVAT = 0
    repInvoices.forEach(inv => {
      outputVAT += calcGarageInvoiceVat(inv.lines, inv.vatScheme, flatRate, tier, inv.vatRate)
      inv.lines.forEach(l => { if (l.lineType === 'new' && l.cost) inputVAT += l.qty * l.cost * 0.2 })
    })
    const rows = [
      ['Category', 'Amount'],
      ['Total Sales (ex VAT)', repRevenue.toFixed(2)],
      ['Output VAT', outputVAT.toFixed(2)],
      ['Stock Cost Sold', repCost.toFixed(2)],
      ['Input VAT Reclaimable', inputVAT.toFixed(2)],
      ['Net VAT Due', (outputVAT - inputVAT).toFixed(2)],
    ]
    dlCsv(`VAT_Summary_Report_${rangeLabel}.csv`, rows)
  }
  const exportCustomers = () => {
    const rows = [['Name', 'Email', 'Phone', 'Vehicles', 'Total Invoices', 'Total Spent', 'Last Invoice']]
    customers.map(c => {
      const custInvs = invoices.filter(inv => inv.custId === c.id || inv.custName === c.name)
      const totalSpent = custInvs.reduce((sum, inv) => sum + inv.lines.reduce((a, l) => a + l.qty * l.unit, 0), 0)
      const lastInv = custInvs.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0]
      const veh = c.vehicles?.map(v => v.reg).join(', ') || c.reg || ''
      return [c.name, c.email || '', c.phone || '', veh, custInvs.length, totalSpent, lastInv?.date || 'Never']
    }).sort((a, b) => b[5] - a[5]).forEach(r => rows.push([r[0], r[1], r[2], r[3], r[4], Number(r[5]).toFixed(2), r[6]]))
    dlCsv(`Customer_Report_${rangeLabel}.csv`, rows)
  }

  const th = { textAlign: 'left', fontSize: '10.5px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.text3, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }
  const td = { fontSize: '13px', padding: '9px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }
  const numTd = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const kpi = (label, val) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 18px', minWidth: '160px', flex: '1 1 160px' }}>
      <div style={{ fontSize: '11px', color: C.text3, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{val}</div>
    </div>
  )
  const tableCard = (minWidth, children) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>{children}</table>
    </div>
  )
  const empty = (cols, msg) => <tr><td style={td} colSpan={cols}><span style={{ color: C.text3 }}>{msg}</span></td></tr>

  const viewPurchaseFile = async (b) => {
    setNote('')
    setFileBusy(b.id)
    try {
      let path = b.invoiceUrl
      if (!path) { setNote('No purchase invoice file was saved for this batch.'); return }
      const marker = '/purchase-invoices/'
      const idx = path.indexOf(marker)
      if (idx !== -1) path = path.slice(idx + marker.length)
      const { data: s, error } = await sb.storage.from('purchase-invoices').createSignedUrl(path, 300)
      if (error || !s?.signedUrl) { setNote('Could not open the invoice file — it may have been removed.'); return }
      window.open(s.signedUrl, '_blank', 'noopener')
    } finally {
      setFileBusy(null)
    }
  }

  const repBtn = { background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }

  if (!ready) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 }}>Loading…</div>
  }

  return (
    <div style={page}>
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.text2, fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Clients</button>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>{link.client_name || 'Client'}</div>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.accent, border: `1px solid ${C.accent}44`, background: `${C.accent}1a`, borderRadius: '20px', padding: '2px 9px' }}>{PRODUCT_LABEL[link.product] || link.product}</span>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.text3, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '2px 9px' }}>View only</span>
        </div>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: tab === k ? `${C.accent}1a` : 'transparent',
              color: tab === k ? C.accent : C.text3,
              border: `1px solid ${tab === k ? C.accent + '55' : C.border}`,
              borderRadius: '999px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 20px' }}>
        {TABS.length === 0 && (
          <div style={{ color: C.text2, fontSize: '13.5px' }}>
            No sections are shared with you yet — ask your client to tick some in their Settings.
          </div>
        )}

        {note && <div style={{ color: C.text2, fontSize: '12.5px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>{note}</div>}

        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '22px' }}>
              {kpi('Revenue (paid)', gbp(revenue))}
              {kpi('Outstanding', gbp(outstanding))}
              {kpi('Overdue', gbp(overdue))}
              {kpi('Invoices', String(invoices.length))}
            </div>
            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              Totals use each invoice's computed total, matching the client's dashboard. The Reports tab holds period reports and the VAT summary.
            </div>
          </div>
        )}

        {tab === 'invoices' && tableCard('720px', (
          <>
            <thead><tr>
              <th style={th}>Invoice</th><th style={th}>Customer</th><th style={th}>Reg</th><th style={th}>Date</th>
              <th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Subtotal</th>
              <th style={{ ...th, textAlign: 'right' }}>VAT</th><th style={{ ...th, textAlign: 'right' }}>Total</th>
            </tr></thead>
            <tbody>
              {invoices.length === 0 && empty(8, 'No invoices.')}
              {invoices.map(i => {
                const sub = invoiceSubtotal(i.lines)
                const v = calcGarageInvoiceVat(i.lines, i.vatScheme, flatRate, tier, i.vatRate)
                return (
                  <tr key={i.id}>
                    <td style={td}>{i.id}</td>
                    <td style={td}>{i.custName || '—'}</td>
                    <td style={td}>{i.reg || '—'}</td>
                    <td style={td}>{fmtD(i.date)}</td>
                    <td style={td}><span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: i.status === 'paid' ? C.green : i.status === 'overdue' ? C.red : C.text2 }}>{i.status}</span></td>
                    <td style={numTd}>{gbp(sub)}</td>
                    <td style={{ ...numTd, color: C.text2 }}>{gbp(v)}</td>
                    <td style={{ ...numTd, fontWeight: 700 }}>{gbp(sub + v)}</td>
                  </tr>
                )
              })}
            </tbody>
          </>
        ))}

        {tab === 'customers' && tableCard('680px', (
          <>
            <thead><tr>
              <th style={th}>Name</th><th style={th}>Email</th><th style={th}>Phone</th><th style={th}>Reg</th><th style={th}>Vehicle</th>
            </tr></thead>
            <tbody>
              {customers.length === 0 && empty(5, 'No customers.')}
              {customers.map(c => (
                <tr key={c.id}>
                  <td style={td}>{c.name || '—'}</td>
                  <td style={td}>{c.email || '—'}</td>
                  <td style={td}>{c.phone || '—'}</td>
                  <td style={td}>{c.reg || '—'}</td>
                  <td style={td}>{c.vehicle || '—'}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'items' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Parts</div>
              {tableCard('620px', (
                <>
                  <thead><tr>
                    <th style={th}>Part no.</th><th style={th}>Name</th><th style={th}>Category</th><th style={th}>Brand</th>
                    <th style={{ ...th, textAlign: 'right' }}>Sell</th><th style={{ ...th, textAlign: 'right' }}>In stock</th>
                  </tr></thead>
                  <tbody>
                    {parts.length === 0 && empty(6, 'No parts.')}
                    {parts.map(pt => (
                      <tr key={pt.id}>
                        <td style={td}>{pt.partNumber || '—'}</td>
                        <td style={td}>{pt.name || '—'}</td>
                        <td style={td}>{pt.category || '—'}</td>
                        <td style={td}>{pt.brand || '—'}</td>
                        <td style={numTd}>{pt.sellPrice != null ? gbp(pt.sellPrice) : '—'}</td>
                        <td style={numTd}>{stockByPart[pt.id] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Services</div>
              {tableCard('520px', (
                <>
                  <thead><tr>
                    <th style={th}>Name</th><th style={th}>Category</th>
                    <th style={{ ...th, textAlign: 'right' }}>Duration</th><th style={{ ...th, textAlign: 'right' }}>Price</th>
                  </tr></thead>
                  <tbody>
                    {services.length === 0 && empty(4, 'No services.')}
                    {services.map(s => (
                      <tr key={s.id}>
                        <td style={td}>{s.name || '—'}</td>
                        <td style={td}>{s.category || '—'}</td>
                        <td style={numTd}>{s.durationMin != null ? `${s.durationMin} min` : '—'}</td>
                        <td style={numTd}>{s.defaultPrice != null ? gbp(s.defaultPrice) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Labour rates</div>
              {tableCard('420px', (
                <>
                  <thead><tr>
                    <th style={th}>Name</th><th style={{ ...th, textAlign: 'right' }}>Hourly rate</th><th style={th}>Default</th>
                  </tr></thead>
                  <tbody>
                    {labourRates.length === 0 && empty(3, 'No labour rates.')}
                    {labourRates.map(r => (
                      <tr key={r.id}>
                        <td style={td}>{r.name || '—'}</td>
                        <td style={numTd}>{r.hourlyRate != null ? gbp(r.hourlyRate) : '—'}</td>
                        <td style={td}>{r.isDefault ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ))}
            </div>
          </div>
        )}

        {tab === 'database' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Vehicles</div>
              {tableCard('680px', (
                <>
                  <thead><tr>
                    <th style={th}>Reg</th><th style={th}>Make</th><th style={th}>Model</th><th style={th}>Year</th>
                    <th style={th}>Fuel</th><th style={th}>MOT due</th><th style={th}>Tax due</th>
                  </tr></thead>
                  <tbody>
                    {vehicles.length === 0 && empty(7, 'No vehicles.')}
                    {vehicles.map(v => (
                      <tr key={v.id}>
                        <td style={td}>{v.reg || '—'}</td>
                        <td style={td}>{v.make || '—'}</td>
                        <td style={td}>{v.model || '—'}</td>
                        <td style={td}>{v.year || '—'}</td>
                        <td style={td}>{v.fuelType || '—'}</td>
                        <td style={td}>{v.motDue ? fmtD(v.motDue) : '—'}</td>
                        <td style={td}>{v.taxDue ? fmtD(v.taxDue) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Jobs / workshop history</div>
              {tableCard('680px', (
                <>
                  <thead><tr>
                    <th style={th}>Customer</th><th style={th}>Reg</th><th style={th}>Status</th>
                    <th style={th}>Booked</th><th style={th}>Completed</th>
                    <th style={{ ...th, textAlign: 'right' }}>Miles in</th><th style={{ ...th, textAlign: 'right' }}>Miles out</th>
                  </tr></thead>
                  <tbody>
                    {jobs.length === 0 && empty(7, 'No jobs.')}
                    {jobs.map(j => (
                      <tr key={j.id}>
                        <td style={td}>{j.custName || '—'}</td>
                        <td style={td}>{j.reg || '—'}</td>
                        <td style={td}>{j.status || '—'}</td>
                        <td style={td}>{j.bookedDate ? fmtD(j.bookedDate) : '—'}</td>
                        <td style={td}>{j.completeDate ? fmtD(j.completeDate) : '—'}</td>
                        <td style={numTd}>{j.mileageIn != null ? j.mileageIn : '—'}</td>
                        <td style={numTd}>{j.mileageOut != null ? j.mileageOut : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ))}
            </div>
          </div>
        )}

        {tab === 'purchases' && tableCard('760px', (
          <>
            <thead><tr>
              <th style={th}>Date</th><th style={th}>Supplier</th><th style={th}>Ref</th>
              <th style={{ ...th, textAlign: 'right' }}>Qty</th><th style={{ ...th, textAlign: 'right' }}>Cost/ea</th>
              <th style={{ ...th, textAlign: 'right' }}>Total cost</th><th style={{ ...th, textAlign: 'right' }}>VAT (20%)</th>
              <th style={{ ...th, textAlign: 'right' }}>Invoice</th>
            </tr></thead>
            <tbody>
              {partBatches.length === 0 && empty(8, 'No purchases recorded.')}
              {partBatches.map(b => {
                const qty = Number(b.qty) || 0
                const totalCost = qty * (Number(b.cost) || 0)
                return (
                  <tr key={b.id}>
                    <td style={td}>{fmtD(b.date)}</td>
                    <td style={td}>{b.supplier || '—'}</td>
                    <td style={td}>{b.ref || '—'}</td>
                    <td style={numTd}>{qty}</td>
                    <td style={numTd}>{gbp(b.cost)}</td>
                    <td style={numTd}>{gbp(totalCost)}</td>
                    <td style={{ ...numTd, color: C.green }}>{gbp(totalCost * 0.2)}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      {b.invoiceUrl
                        ? <button onClick={() => viewPurchaseFile(b)} disabled={fileBusy === b.id}
                            style={{ background: 'transparent', color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: fileBusy === b.id ? .6 : 1 }}>
                            {fileBusy === b.id ? 'Opening…' : 'View'}
                          </button>
                        : <span style={{ color: C.text3, fontSize: '12px' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </>
        ))}

        {tab === 'calendar' && tableCard('620px', (
          <>
            <thead><tr>
              <th style={th}>Booked</th><th style={th}>Customer</th><th style={th}>Reg</th><th style={th}>Status</th><th style={th}>Completed</th>
            </tr></thead>
            <tbody>
              {jobs.length === 0 && empty(5, 'No bookings.')}
              {jobs.slice().sort((a, b) => new Date(b.bookedDate || 0) - new Date(a.bookedDate || 0)).map(j => (
                <tr key={j.id}>
                  <td style={td}>{j.bookedDate ? fmtD(j.bookedDate) : '—'}</td>
                  <td style={td}>{j.custName || '—'}</td>
                  <td style={td}>{j.reg || '—'}</td>
                  <td style={td}>{j.status || '—'}</td>
                  <td style={td}>{j.completeDate ? fmtD(j.completeDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['quarter', 'This Quarter'], ['year', 'This Year'], ['custom', 'Custom']].map(([k, lbl]) => (
                <button key={k} onClick={() => setDatePreset(k)} style={{
                  background: datePreset === k ? `${C.accent}1a` : 'transparent',
                  color: datePreset === k ? C.accent : C.text3,
                  border: `1px solid ${datePreset === k ? C.accent + '55' : C.border}`,
                  borderRadius: '8px', padding: '7px 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>{lbl}</button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>From</div>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...inp, width: 'auto', padding: '8px 10px', fontSize: '12.5px' }} /></div>
                <div><div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>To</div>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...inp, width: 'auto', padding: '8px 10px', fontSize: '12.5px' }} /></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {kpi('Revenue (ex VAT)', gbp(repRevenue))}
              {kpi('Cost of sales', gbp(repCost))}
              {kpi('Gross profit', gbp(repProfit))}
              {kpi('Margin', `${repMargin}%`)}
            </div>

            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              CSV exports over {datePreset === 'custom' ? (customFrom && customTo ? rangeLabel : 'the chosen range') : rangeLabel} — the same reports your client can export.
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button style={repBtn} onClick={exportSales}>Sales report</button>
              <button style={repBtn} onClick={exportProfit}>Profit &amp; loss</button>
              <button style={repBtn} onClick={exportVat}>VAT summary</button>
              <button style={repBtn} onClick={exportCustomers}>Customer report</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// =============================================================================
// ServiceOps books — read-only, USER-scoped (svc_* tables keyed by user_id, so
// query directly by link.client_id, same as SoloOps — no account_id hop).
//
// Money is a single stored `amount` per invoice/quote (VAT-inclusive gross);
// there are no line items or VAT schemes here. The Invoicing KPIs replicate
// ServiceOps' InvoicingPage exactly: Collected (Paid), Outstanding (Sent +
// Overdue), Overdue, and VAT-included estimate = round(collected − collected/1.2).
// ServiceOps' own Reports page shows sample/preview data only, so the portal's
// Reports tab instead surfaces the REAL invoice figures over a period + CSV.
// Every query is SELECT-only and fails open.
// =============================================================================
const SVC_DOC_BUCKET = 'svc-documents'

function svcDateRange(preset, customFrom, customTo) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (preset) {
    case 'month': return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today }
    case 'quarter': { const qm = Math.floor(today.getMonth() / 3) * 3; return { from: new Date(today.getFullYear(), qm, 1), to: today } }
    case 'year': return { from: new Date(today.getFullYear(), 0, 1), to: today }
    case 'custom': return { from: customFrom ? new Date(customFrom) : null, to: customTo ? new Date(customTo) : null }
    default: return { from: null, to: null } // 'all'
  }
}

// Collected / Outstanding / Overdue / VAT — byte-for-byte ServiceOps'
// InvoicingPage computation over a set of invoices (amount is VAT-inclusive).
function svcInvoiceStats(list) {
  const collected = list.filter(v => v.status === 'Paid').reduce((s, v) => s + (Number(v.amount) || 0), 0)
  const overdue = list.filter(v => v.status === 'Overdue').reduce((s, v) => s + (Number(v.amount) || 0), 0)
  const sent = list.filter(v => v.status === 'Sent').reduce((s, v) => s + (Number(v.amount) || 0), 0)
  const outstanding = sent + overdue
  const vat = Math.round(collected - collected / 1.2)
  return { collected, overdue, sent, outstanding, vat }
}

function ServiceOpsBooks({ link, onBack }) {
  const perms = link.permissions || {}
  const cid = link.client_id
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [quotes, setQuotes] = useState([])
  const [customers, setCustomers] = useState([])
  const [properties, setProperties] = useState([])
  const [bookings, setBookings] = useState([])
  const [certs, setCerts] = useState([])
  const [note, setNote] = useState('')
  const [fileBusy, setFileBusy] = useState(null)

  const [datePreset, setDatePreset] = useState('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const TABS = [
    ['dashboard', 'Overview'], ['invoicing', 'Invoicing'], ['quotes', 'Quotes'],
    ['customers', 'Customers'], ['diary', 'Diary'], ['certificates', 'Certificates'], ['reports', 'Reports'],
  ].filter(([k]) => perms[k] === true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const p = perms
      const needInvoices = p.invoicing === true || p.dashboard === true || p.reports === true
      if (needInvoices) {
        try {
          const { data } = await sb.from('svc_invoices')
            .select('id, ref, customer, site, amount, status, due_date, created_at')
            .eq('user_id', cid).order('created_at', { ascending: false })
          if (alive) setInvoices(data || [])
        } catch { /* fail open */ }
      }
      if (p.quotes === true) {
        try {
          const { data } = await sb.from('svc_quotes')
            .select('id, ref, customer, site, amount, status, quote_date')
            .eq('user_id', cid).order('created_at', { ascending: false })
          if (alive) setQuotes(data || [])
        } catch { /* fail open */ }
      }
      if (p.customers === true) {
        try {
          const { data: c } = await sb.from('svc_customers')
            .select('id, name, type, contact, email, area').eq('user_id', cid).order('name')
          if (alive) setCustomers(c || [])
        } catch { /* fail open */ }
        try {
          const { data: pr } = await sb.from('svc_properties')
            .select('id, customer, address, postcode, prop_type').eq('user_id', cid).order('created_at', { ascending: false })
          if (alive) setProperties(pr || [])
        } catch { /* fail open */ }
      }
      if (p.diary === true) {
        try {
          const { data } = await sb.from('svc_bookings')
            .select('id, title, customer, site, engineer, priority, booking_date, booking_time, status')
            .eq('user_id', cid).order('booking_date', { ascending: false })
          if (alive) setBookings(data || [])
        } catch { /* fail open */ }
      }
      if (p.certificates === true) {
        try {
          const { data } = await sb.from('svc_certificates')
            .select('id, cert_type, customer, site, ref, issue_date, expiry_date, file_path, file_name')
            .eq('user_id', cid).order('expiry_date', { ascending: true })
          if (alive) setCerts(data || [])
        } catch { /* fail open */ }
      }
      if (alive) { setTab(TABS[0]?.[0] || null); setReady(true) }
    })()
    return () => { alive = false }
  }, [link])

  const stats = svcInvoiceStats(invoices)

  // Reports period filter (by invoice created_at date)
  const { from: dFrom, to: dTo } = svcDateRange(datePreset, customFrom, customTo)
  const inRange = (v) => {
    if (!dFrom && !dTo) return true
    const d = new Date(v.created_at || v.due_date)
    if (isNaN(d)) return false
    if (dFrom && d < dFrom) return false
    if (dTo) { const end = new Date(dTo); end.setHours(23, 59, 59, 999); if (d > end) return false }
    return true
  }
  const repInvoices = invoices.filter(inRange)
  const repStats = svcInvoiceStats(repInvoices)
  const rangeLabel = datePreset === 'all' ? 'All time'
    : datePreset === 'custom' ? (customFrom && customTo ? `${customFrom}–${customTo}` : 'custom range')
    : datePreset.charAt(0).toUpperCase() + datePreset.slice(1)

  const th = { textAlign: 'left', fontSize: '10.5px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.text3, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }
  const td = { fontSize: '13px', padding: '9px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }
  const numTd = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const kpi = (label, val) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 18px', minWidth: '160px', flex: '1 1 160px' }}>
      <div style={{ fontSize: '11px', color: C.text3, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{val}</div>
    </div>
  )
  const tableCard = (minWidth, children) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>{children}</table>
    </div>
  )
  const empty = (cols, msg) => <tr><td style={td} colSpan={cols}><span style={{ color: C.text3 }}>{msg}</span></td></tr>
  const statusColor = (s) => s === 'Paid' ? C.green : s === 'Overdue' ? C.red : C.text2

  const viewCert = async (c) => {
    setNote('')
    setFileBusy(c.id)
    try {
      if (!c.file_path) { setNote('No file was attached to this certificate.'); return }
      const { data: s, error } = await sb.storage.from(SVC_DOC_BUCKET).createSignedUrl(c.file_path, 600)
      if (error || !s?.signedUrl) { setNote('Could not open the file — it may have been removed.'); return }
      window.open(s.signedUrl, '_blank', 'noopener')
    } finally {
      setFileBusy(null)
    }
  }

  const repBtn = { background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }
  const exportInvoices = () => {
    const rows = [['Reference', 'Customer', 'Site', 'Status', 'Due', 'Amount'],
      ...repInvoices.map(v => [v.ref || '', v.customer || '', v.site || '', v.status || '', v.due_date || '', (Number(v.amount) || 0).toFixed(2)])]
    dlCsv(`invoices-${rangeLabel.replace(/[^a-zA-Z0-9-]/g, '_')}.csv`, rows)
  }
  const exportSummary = () => {
    const rows = [
      ['Invoice summary'], ['Client', link.client_name || ''], ['Period', rangeLabel], [],
      ['Metric', 'Amount'],
      ['Collected (paid)', repStats.collected.toFixed(2)],
      ['Outstanding (sent + overdue)', repStats.outstanding.toFixed(2)],
      ['Overdue', repStats.overdue.toFixed(2)],
      ['VAT included in collected (est. @20%)', repStats.vat.toFixed(2)],
    ]
    dlCsv(`invoice-summary-${rangeLabel.replace(/[^a-zA-Z0-9-]/g, '_')}.csv`, rows)
  }

  if (!ready) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 }}>Loading…</div>
  }

  return (
    <div style={page}>
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.text2, fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Clients</button>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>{link.client_name || 'Client'}</div>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.accent, border: `1px solid ${C.accent}44`, background: `${C.accent}1a`, borderRadius: '20px', padding: '2px 9px' }}>{PRODUCT_LABEL[link.product] || link.product}</span>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.text3, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '2px 9px' }}>View only</span>
        </div>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: tab === k ? `${C.accent}1a` : 'transparent',
              color: tab === k ? C.accent : C.text3,
              border: `1px solid ${tab === k ? C.accent + '55' : C.border}`,
              borderRadius: '999px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 20px' }}>
        {TABS.length === 0 && (
          <div style={{ color: C.text2, fontSize: '13.5px' }}>
            No sections are shared with you yet — ask your client to tick some in their Settings.
          </div>
        )}

        {note && <div style={{ color: C.text2, fontSize: '12.5px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>{note}</div>}

        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '22px' }}>
              {kpi('Collected', gbp(stats.collected))}
              {kpi('Outstanding', gbp(stats.outstanding))}
              {kpi('Overdue', gbp(stats.overdue))}
              {kpi('VAT (est.)', gbp(stats.vat))}
            </div>
            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              Figures match the client's Invoicing page. Amounts are VAT-inclusive; the VAT estimate assumes 20% included. The Reports tab lets you filter by period and export.
            </div>
          </div>
        )}

        {tab === 'invoicing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {kpi('Collected', gbp(stats.collected))}
              {kpi('Outstanding', gbp(stats.outstanding))}
              {kpi('Overdue', gbp(stats.overdue))}
              {kpi('VAT (est.)', gbp(stats.vat))}
            </div>
            {tableCard('640px', (
              <>
                <thead><tr>
                  <th style={th}>Reference</th><th style={th}>Customer</th><th style={th}>Site</th>
                  <th style={th}>Status</th><th style={th}>Due</th><th style={{ ...th, textAlign: 'right' }}>Amount</th>
                </tr></thead>
                <tbody>
                  {invoices.length === 0 && empty(6, 'No invoices.')}
                  {invoices.map(v => (
                    <tr key={v.id}>
                      <td style={td}>{v.ref || '—'}</td>
                      <td style={td}>{v.customer || '—'}</td>
                      <td style={td}>{v.site || '—'}</td>
                      <td style={td}><span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: statusColor(v.status) }}>{v.status || '—'}</span></td>
                      <td style={td}>{v.due_date ? fmtD(v.due_date) : '—'}</td>
                      <td style={{ ...numTd, fontWeight: 700 }}>{gbp(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ))}
          </div>
        )}

        {tab === 'quotes' && tableCard('600px', (
          <>
            <thead><tr>
              <th style={th}>Reference</th><th style={th}>Customer</th><th style={th}>Site</th>
              <th style={th}>Status</th><th style={th}>Date</th><th style={{ ...th, textAlign: 'right' }}>Amount</th>
            </tr></thead>
            <tbody>
              {quotes.length === 0 && empty(6, 'No quotes.')}
              {quotes.map(q => (
                <tr key={q.id}>
                  <td style={td}>{q.ref || '—'}</td>
                  <td style={td}>{q.customer || '—'}</td>
                  <td style={td}>{q.site || '—'}</td>
                  <td style={td}>{q.status || '—'}</td>
                  <td style={td}>{q.quote_date ? fmtD(q.quote_date) : '—'}</td>
                  <td style={{ ...numTd, fontWeight: 700 }}>{gbp(q.amount)}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'customers' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Customers</div>
              {tableCard('620px', (
                <>
                  <thead><tr>
                    <th style={th}>Name</th><th style={th}>Type</th><th style={th}>Phone</th><th style={th}>Email</th><th style={th}>Region</th>
                  </tr></thead>
                  <tbody>
                    {customers.length === 0 && empty(5, 'No customers.')}
                    {customers.map(c => (
                      <tr key={c.id}>
                        <td style={td}>{c.name || '—'}</td>
                        <td style={td}>{c.type || '—'}</td>
                        <td style={td}>{c.contact || '—'}</td>
                        <td style={td}>{c.email || '—'}</td>
                        <td style={td}>{c.area || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ))}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, marginBottom: '8px' }}>Properties</div>
              {tableCard('560px', (
                <>
                  <thead><tr>
                    <th style={th}>Customer</th><th style={th}>Address</th><th style={th}>Postcode</th><th style={th}>Type</th>
                  </tr></thead>
                  <tbody>
                    {properties.length === 0 && empty(4, 'No properties.')}
                    {properties.map(pr => (
                      <tr key={pr.id}>
                        <td style={td}>{pr.customer || '—'}</td>
                        <td style={td}>{pr.address || '—'}</td>
                        <td style={td}>{pr.postcode || '—'}</td>
                        <td style={td}>{pr.prop_type || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ))}
            </div>
          </div>
        )}

        {tab === 'diary' && tableCard('680px', (
          <>
            <thead><tr>
              <th style={th}>Date</th><th style={th}>Time</th><th style={th}>Title</th>
              <th style={th}>Customer</th><th style={th}>Site</th><th style={th}>Engineer</th><th style={th}>Priority</th>
            </tr></thead>
            <tbody>
              {bookings.length === 0 && empty(7, 'No bookings.')}
              {bookings.map(b => (
                <tr key={b.id}>
                  <td style={td}>{b.booking_date ? fmtD(b.booking_date) : '—'}</td>
                  <td style={td}>{b.booking_time || '—'}</td>
                  <td style={td}>{b.title || '—'}</td>
                  <td style={td}>{b.customer || '—'}</td>
                  <td style={td}>{b.site || '—'}</td>
                  <td style={td}>{b.engineer || '—'}</td>
                  <td style={td}>{b.priority || '—'}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'certificates' && tableCard('720px', (
          <>
            <thead><tr>
              <th style={th}>Type</th><th style={th}>Customer</th><th style={th}>Site</th><th style={th}>Ref</th>
              <th style={th}>Issued</th><th style={th}>Expires</th><th style={{ ...th, textAlign: 'right' }}>File</th>
            </tr></thead>
            <tbody>
              {certs.length === 0 && empty(7, 'No certificates.')}
              {certs.map(c => (
                <tr key={c.id}>
                  <td style={td}>{c.cert_type || '—'}</td>
                  <td style={td}>{c.customer || '—'}</td>
                  <td style={td}>{c.site || '—'}</td>
                  <td style={td}>{c.ref || '—'}</td>
                  <td style={td}>{c.issue_date ? fmtD(c.issue_date) : '—'}</td>
                  <td style={td}>{c.expiry_date ? fmtD(c.expiry_date) : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {c.file_path
                      ? <button onClick={() => viewCert(c)} disabled={fileBusy === c.id}
                          style={{ background: 'transparent', color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: fileBusy === c.id ? .6 : 1 }}>
                          {fileBusy === c.id ? 'Opening…' : 'View'}
                        </button>
                      : <span style={{ color: C.text3, fontSize: '12px' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[['all', 'All time'], ['month', 'This Month'], ['quarter', 'This Quarter'], ['year', 'This Year'], ['custom', 'Custom']].map(([k, lbl]) => (
                <button key={k} onClick={() => setDatePreset(k)} style={{
                  background: datePreset === k ? `${C.accent}1a` : 'transparent',
                  color: datePreset === k ? C.accent : C.text3,
                  border: `1px solid ${datePreset === k ? C.accent + '55' : C.border}`,
                  borderRadius: '8px', padding: '7px 13px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}>{lbl}</button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>From</div>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ ...inp, width: 'auto', padding: '8px 10px', fontSize: '12.5px' }} /></div>
                <div><div style={{ fontSize: '11px', color: C.text3, marginBottom: '4px' }}>To</div>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ ...inp, width: 'auto', padding: '8px 10px', fontSize: '12.5px' }} /></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {kpi('Collected', gbp(repStats.collected))}
              {kpi('Outstanding', gbp(repStats.outstanding))}
              {kpi('Overdue', gbp(repStats.overdue))}
              {kpi('VAT (est.)', gbp(repStats.vat))}
            </div>

            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              Real figures from the client's invoices over {rangeLabel.toLowerCase()} (amounts are VAT-inclusive; VAT estimated at 20% of the paid total).
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button style={repBtn} onClick={exportInvoices}>Invoices (CSV)</button>
              <button style={repBtn} onClick={exportSummary}>Summary (CSV)</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// =============================================================================
// PropertyOps books — read-only, USER-scoped (prop_* tables keyed by user_id;
// the repo's own RLS SQL confirms user_id scoping and that it does NOT depend on
// the x-product header). So query directly by link.client_id, like SoloOps.
//
// Finance is rent payments with a stored `amount` (and optional `paid_amount`).
// The helpers below are byte-for-byte replicas of PropertyOps' src/lib/helpers.js
// (paidOf / outstandingOf / effectiveStatus) so arrears and collected figures
// match the client's Finance page, and propBuildReport mirrors that file's
// buildReport so the Reports tab exports the same CSVs the client can.
// Every query is SELECT-only and fails open.
// =============================================================================
const PROP_DOC_BUCKET = 'documents'

const propPaidOf = (p) => {
  const total = +(p?.amount) || 0
  const raw = p?.paid_amount
  const entered = !(raw === undefined || raw === null || raw === '') && +raw > 0
  if (entered) return Math.max(0, +raw)
  return String(p?.status || '').toLowerCase() === 'paid' ? total : 0
}
const propOutstandingOf = (p) => Math.max(0, (+(p?.amount) || 0) - propPaidOf(p))
const propEffectiveStatus = (p) => {
  const s = String(p?.status || '').toLowerCase()
  const total = +(p?.amount) || 0
  const paid = propPaidOf(p)
  if (total > 0 && paid >= total) return 'Paid'
  if (total <= 0 && s === 'paid') return 'Paid'
  if (s === 'overdue') return 'Overdue'
  const base = s === 'sent' ? 'Sent' : 'Pending'
  if (p?.due_date) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const due = new Date(p.due_date); due.setHours(0, 0, 0, 0)
    if (!isNaN(due) && due < today) return 'Overdue'
  }
  if (paid > 0 && total > paid) return 'Part paid'
  return base
}
const propUkDate = (v) => {
  if (!v) return '—'
  const s = String(v)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(s)
  if (isNaN(d)) return s
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Replica of PropertyOps helpers.js buildReport (£ with no decimals, same rows).
function propBuildReport(name, d) {
  const gbpc = (n) => '£' + (n || 0).toLocaleString('en-GB')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  switch (name) {
    case 'Rent statement':
    case 'Landlord statement':
      return { cols: ['Tenant', 'Property', 'Amount', 'Due date', 'Status'], rows: d.pays.map((p) => [p.tenant, p.property, gbpc(p.amount), propUkDate(p.due_date), p.status]) }
    case 'Arrears report':
      return { cols: ['Tenant', 'Property', 'Amount', 'Due date'], rows: d.pays.filter((p) => propEffectiveStatus(p) === 'Overdue').map((p) => [p.tenant, p.property, gbpc(p.amount), propUkDate(p.due_date)]) }
    case 'Profit & loss':
    case 'Tax-year summary': {
      const collected = d.pays.filter((p) => p.status === 'Paid').reduce((s, p) => s + (p.amount || 0), 0)
      const due = d.pays.reduce((s, p) => s + (p.amount || 0), 0)
      const maintCost = d.maint.reduce((s, m) => s + (+m.cost || 0), 0)
      const net = collected - maintCost
      return { cols: ['Line', 'Amount'], rows: [['Rent collected', gbpc(collected)], ['Rent due (all)', gbpc(due)], ['Outstanding', gbpc(due - collected)], ['Maintenance expenses', '-' + gbpc(maintCost)], ['Net (collected − expenses)', gbpc(net)], ['Properties', d.props.length]] }
    }
    case 'Compliance audit':
      return { cols: ['Type', 'Property', 'Reference', 'Expiry date'], rows: d.comp.map((c) => [c.type, c.property || '—', c.reference || '—', propUkDate(c.expiry_date)]) }
    case 'Expiring certificates':
      return { cols: ['Type', 'Property', 'Expiry date', 'Days left'], rows: d.comp.map((c) => ({ ...c, dd: c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null })).filter((c) => c.dd !== null && c.dd <= 90).sort((a, b) => a.dd - b.dd).map((c) => [c.type, c.property || '—', propUkDate(c.expiry_date), c.dd]) }
    case 'Overdue & at-risk':
      return { cols: ['Type', 'Property', 'Expiry date', 'Status'], rows: d.comp.map((c) => ({ ...c, dd: c.expiry_date ? Math.round((new Date(c.expiry_date) - today) / 864e5) : null })).filter((c) => c.dd !== null && c.dd <= 30).map((c) => [c.type, c.property || '—', propUkDate(c.expiry_date), c.dd < 0 ? 'Expired' : c.dd <= 7 ? 'Urgent' : 'Due soon']) }
    case 'Occupancy report':
      return { cols: ['Property', 'Area', 'Type', 'Status', 'Rent'], rows: d.props.map((p) => [p.address || p.addr, p.area || '—', p.type || '—', p.status, gbpc(p.rent)]) }
    case 'Tenancy renewals':
      return { cols: ['Tenant', 'Property', 'Tenancy ends'], rows: d.tenants.map((t) => [t.name, t.property || '—', propUkDate(t.tenancy_end)]) }
    case 'Maintenance summary':
      return { cols: ['Job', 'Property', 'Priority', 'Status', 'Contractor', 'Cost'], rows: d.maint.map((m) => [m.title, m.property || '—', m.priority, m.status, m.contractor || '—', gbpc(+m.cost || 0)]) }
    case 'Spend by category': {
      const byp = {}
      d.maint.forEach((m) => { const k = m.property || 'Unassigned'; byp[k] = (byp[k] || 0) + (+m.cost || 0) })
      const total = Object.values(byp).reduce((s, n) => s + n, 0)
      const rows = Object.entries(byp).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, gbpc(n)])
      rows.push(['Total', gbpc(total)])
      return { cols: ['Property', 'Maintenance spend'], rows }
    }
    case 'Contractor performance': {
      const byc = {}
      d.maint.forEach((m) => { const c = m.contractor || 'Unassigned'; byc[c] = (byc[c] || 0) + 1 })
      return { cols: ['Contractor', 'Jobs'], rows: Object.entries(byc).map(([c, n]) => [c, n]) }
    }
    default:
      return null
  }
}

const PROP_REPORT_GROUPS = [
  ['Financial', ['Rent statement', 'Arrears report', 'Landlord statement', 'Profit & loss', 'Tax-year summary']],
  ['Compliance', ['Compliance audit', 'Expiring certificates', 'Overdue & at-risk']],
  ['Portfolio & tenancy', ['Occupancy report', 'Tenancy renewals']],
  ['Operations', ['Maintenance summary', 'Spend by category', 'Contractor performance']],
]

function PropertyOpsBooks({ link, onBack }) {
  const perms = link.permissions || {}
  const cid = link.client_id
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState(null)
  const [properties, setProperties] = useState([])
  const [tenants, setTenants] = useState([])
  const [payments, setPayments] = useState([])
  const [maintenance, setMaintenance] = useState([])
  const [compliance, setCompliance] = useState([])
  const [documents, setDocuments] = useState([])
  const [note, setNote] = useState('')
  const [fileBusy, setFileBusy] = useState(null)

  const TABS = [
    ['dashboard', 'Overview'], ['properties', 'Properties'], ['tenants', 'Tenants'],
    ['finance', 'Finance'], ['maintenance', 'Maintenance'], ['compliance', 'Compliance'],
    ['documents', 'Documents'], ['reports', 'Reports'],
  ].filter(([k]) => perms[k] === true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const p = perms
      // Properties underpin labels across tabs + the dashboard count, so load
      // them whenever any tab is shown.
      let propMap = {}
      try {
        const { data } = await sb.from('prop_properties')
          .select('id, address, area, type, status, rent').eq('user_id', cid).order('created_at', { ascending: false })
        if (alive) setProperties(data || [])
        ;(data || []).forEach(pr => { propMap[pr.id] = pr.address })
      } catch { /* fail open */ }
      const label = (row) => row.property || propMap[row.property_id] || ''

      if (p.finance === true || p.dashboard === true || p.reports === true) {
        try {
          const { data } = await sb.from('prop_payments')
            .select('id, tenant, property, property_id, amount, paid_amount, due_date, billing_date, invoice_no, status')
            .eq('user_id', cid).order('due_date', { ascending: false })
          if (alive) setPayments((data || []).map(r => ({ ...r, property: label(r) })))
        } catch { /* fail open */ }
      }
      if (p.tenants === true || p.dashboard === true || p.reports === true) {
        try {
          const { data } = await sb.from('prop_tenants')
            .select('id, name, property_id, email, phone, tenancy_start, tenancy_end, deposit_amount, deposit_protected, rent_status')
            .eq('user_id', cid).order('created_at', { ascending: false })
          if (alive) setTenants((data || []).map(r => ({ ...r, property: label(r) })))
        } catch { /* fail open */ }
      }
      if (p.maintenance === true || p.reports === true) {
        try {
          const { data } = await sb.from('prop_maintenance')
            .select('id, title, property_id, priority, contractor, status, cost')
            .eq('user_id', cid).order('created_at', { ascending: false })
          if (alive) setMaintenance((data || []).map(r => ({ ...r, property: label(r) })))
        } catch { /* fail open */ }
      }
      if (p.compliance === true || p.reports === true) {
        try {
          const { data } = await sb.from('prop_compliance')
            .select('id, type, property_id, reference, start_date, expiry_date')
            .eq('user_id', cid).order('expiry_date', { ascending: true })
          if (alive) setCompliance((data || []).map(r => ({ ...r, property: label(r) })))
        } catch { /* fail open */ }
      }
      if (p.documents === true) {
        try {
          const { data } = await sb.from('prop_documents')
            .select('id, name, category, file_path, size_kb, property_id')
            .eq('user_id', cid).order('created_at', { ascending: false })
          if (alive) setDocuments((data || []).map(r => ({ ...r, property: label(r) })))
        } catch { /* fail open */ }
      }
      if (alive) { setTab(TABS[0]?.[0] || null); setReady(true) }
    })()
    return () => { alive = false }
  }, [link])

  // ---- finance KPIs (byte-for-byte the client's Finance page) ----
  const collected = payments.reduce((s, p) => s + propPaidOf(p), 0)
  const overdue = payments.filter(p => propEffectiveStatus(p) === 'Overdue').reduce((s, p) => s + propOutstandingOf(p), 0)
  const pending = payments.filter(p => ['Pending', 'Sent', 'Part paid'].includes(propEffectiveStatus(p))).reduce((s, p) => s + propOutstandingOf(p), 0)
  const outstanding = overdue + pending

  const th = { textAlign: 'left', fontSize: '10.5px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.text3, padding: '8px 10px', borderBottom: `1px solid ${C.border}` }
  const td = { fontSize: '13px', padding: '9px 10px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'top' }
  const numTd = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
  const kpi = (label, val) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 18px', minWidth: '160px', flex: '1 1 160px' }}>
      <div style={{ fontSize: '11px', color: C.text3, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px' }}>{val}</div>
    </div>
  )
  const tableCard = (minWidth, children) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '14px', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth }}>{children}</table>
    </div>
  )
  const empty = (cols, msg) => <tr><td style={td} colSpan={cols}><span style={{ color: C.text3 }}>{msg}</span></td></tr>
  const payStatusColor = (s) => s === 'Paid' ? C.green : s === 'Overdue' ? C.red : C.text2

  const viewDoc = async (doc) => {
    setNote('')
    setFileBusy(doc.id)
    try {
      if (!doc.file_path) { setNote('No file is attached to this document.'); return }
      const { data: s, error } = await sb.storage.from(PROP_DOC_BUCKET).createSignedUrl(doc.file_path, 600)
      if (error || !s?.signedUrl) { setNote('Could not open the file — it may have been removed.'); return }
      window.open(s.signedUrl, '_blank', 'noopener')
    } finally {
      setFileBusy(null)
    }
  }

  const reportData = { pays: payments, maint: maintenance, props: properties, comp: compliance, tenants }
  const downloadReport = (name) => {
    const rep = propBuildReport(name, reportData)
    if (!rep) { setNote('That report isn’t available.'); return }
    dlCsv(`${name.replace(/[^a-zA-Z0-9-]/g, '_')}.csv`, [rep.cols, ...rep.rows])
  }
  const repBtn = { background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }

  if (!ready) {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3 }}>Loading…</div>
  }

  return (
    <div style={page}>
      <header style={{ borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.text2, fontSize: '13px', cursor: 'pointer', padding: 0 }}>← Clients</button>
          <div style={{ fontWeight: 800, fontSize: '16px' }}>{link.client_name || 'Client'}</div>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.accent, border: `1px solid ${C.accent}44`, background: `${C.accent}1a`, borderRadius: '20px', padding: '2px 9px' }}>{PRODUCT_LABEL[link.product] || link.product}</span>
          <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: C.text3, border: `1px solid ${C.border}`, borderRadius: '20px', padding: '2px 9px' }}>View only</span>
        </div>
        <div style={{ maxWidth: '980px', margin: '0 auto', padding: '0 20px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              background: tab === k ? `${C.accent}1a` : 'transparent',
              color: tab === k ? C.accent : C.text3,
              border: `1px solid ${tab === k ? C.accent + '55' : C.border}`,
              borderRadius: '999px', padding: '6px 16px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer',
            }}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 20px' }}>
        {TABS.length === 0 && (
          <div style={{ color: C.text2, fontSize: '13.5px' }}>
            No sections are shared with you yet — ask your client to tick some in their Settings.
          </div>
        )}

        {note && <div style={{ color: C.text2, fontSize: '12.5px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 14px', marginBottom: '14px' }}>{note}</div>}

        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '22px' }}>
              {kpi('Properties', String(properties.length))}
              {kpi('Tenants', String(tenants.length))}
              {kpi('Collected', gbp(collected))}
              {kpi('Outstanding', gbp(outstanding))}
            </div>
            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              Collected and outstanding match the client's Finance page (rent received vs owed). The Reports tab exports the full portfolio reports.
            </div>
          </div>
        )}

        {tab === 'properties' && tableCard('620px', (
          <>
            <thead><tr>
              <th style={th}>Address</th><th style={th}>Area</th><th style={th}>Type</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Rent</th>
            </tr></thead>
            <tbody>
              {properties.length === 0 && empty(5, 'No properties.')}
              {properties.map(pr => (
                <tr key={pr.id}>
                  <td style={td}>{pr.address || '—'}</td>
                  <td style={td}>{pr.area || '—'}</td>
                  <td style={td}>{pr.type || '—'}</td>
                  <td style={td}>{pr.status || '—'}</td>
                  <td style={numTd}>{pr.rent != null ? gbp(pr.rent) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'tenants' && tableCard('760px', (
          <>
            <thead><tr>
              <th style={th}>Name</th><th style={th}>Property</th><th style={th}>Email</th><th style={th}>Phone</th>
              <th style={th}>Tenancy start</th><th style={th}>Tenancy end</th><th style={th}>Rent status</th>
            </tr></thead>
            <tbody>
              {tenants.length === 0 && empty(7, 'No tenants.')}
              {tenants.map(t => (
                <tr key={t.id}>
                  <td style={td}>{t.name || '—'}</td>
                  <td style={td}>{t.property || '—'}</td>
                  <td style={td}>{t.email || '—'}</td>
                  <td style={td}>{t.phone || '—'}</td>
                  <td style={td}>{t.tenancy_start ? fmtD(t.tenancy_start) : '—'}</td>
                  <td style={td}>{t.tenancy_end ? fmtD(t.tenancy_end) : '—'}</td>
                  <td style={td}>{t.rent_status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'finance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {kpi('Collected', gbp(collected))}
              {kpi('Outstanding', gbp(outstanding))}
              {kpi('Overdue', gbp(overdue))}
            </div>
            {tableCard('760px', (
              <>
                <thead><tr>
                  <th style={th}>Tenant</th><th style={th}>Property</th><th style={th}>Due</th><th style={th}>Status</th>
                  <th style={{ ...th, textAlign: 'right' }}>Amount</th><th style={{ ...th, textAlign: 'right' }}>Paid</th><th style={{ ...th, textAlign: 'right' }}>Outstanding</th>
                </tr></thead>
                <tbody>
                  {payments.length === 0 && empty(7, 'No payments.')}
                  {payments.map(p => {
                    const es = propEffectiveStatus(p)
                    return (
                      <tr key={p.id}>
                        <td style={td}>{p.tenant || '—'}</td>
                        <td style={td}>{p.property || '—'}</td>
                        <td style={td}>{p.due_date ? fmtD(p.due_date) : '—'}</td>
                        <td style={td}><span style={{ fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px', color: payStatusColor(es) }}>{es}</span></td>
                        <td style={numTd}>{gbp(p.amount)}</td>
                        <td style={{ ...numTd, color: C.text2 }}>{gbp(propPaidOf(p))}</td>
                        <td style={{ ...numTd, fontWeight: 700, color: propOutstandingOf(p) ? C.text : C.text3 }}>{gbp(propOutstandingOf(p))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </>
            ))}
          </div>
        )}

        {tab === 'maintenance' && tableCard('680px', (
          <>
            <thead><tr>
              <th style={th}>Job</th><th style={th}>Property</th><th style={th}>Priority</th><th style={th}>Contractor</th><th style={th}>Status</th><th style={{ ...th, textAlign: 'right' }}>Cost</th>
            </tr></thead>
            <tbody>
              {maintenance.length === 0 && empty(6, 'No maintenance jobs.')}
              {maintenance.map(m => (
                <tr key={m.id}>
                  <td style={td}>{m.title || '—'}</td>
                  <td style={td}>{m.property || '—'}</td>
                  <td style={td}>{m.priority || '—'}</td>
                  <td style={td}>{m.contractor || '—'}</td>
                  <td style={td}>{m.status || '—'}</td>
                  <td style={numTd}>{m.cost != null ? gbp(m.cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'compliance' && tableCard('620px', (
          <>
            <thead><tr>
              <th style={th}>Type</th><th style={th}>Property</th><th style={th}>Reference</th><th style={th}>Start</th><th style={th}>Expiry</th>
            </tr></thead>
            <tbody>
              {compliance.length === 0 && empty(5, 'No certificates.')}
              {compliance.map(c => (
                <tr key={c.id}>
                  <td style={td}>{c.type || '—'}</td>
                  <td style={td}>{c.property || '—'}</td>
                  <td style={td}>{c.reference || '—'}</td>
                  <td style={td}>{c.start_date ? fmtD(c.start_date) : '—'}</td>
                  <td style={td}>{c.expiry_date ? fmtD(c.expiry_date) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'documents' && tableCard('620px', (
          <>
            <thead><tr>
              <th style={th}>Name</th><th style={th}>Category</th><th style={th}>Property</th>
              <th style={{ ...th, textAlign: 'right' }}>Size</th><th style={{ ...th, textAlign: 'right' }}>File</th>
            </tr></thead>
            <tbody>
              {documents.length === 0 && empty(5, 'No documents.')}
              {documents.map(dc => (
                <tr key={dc.id}>
                  <td style={td}>{dc.name || '—'}</td>
                  <td style={td}>{dc.category || '—'}</td>
                  <td style={td}>{dc.property || '—'}</td>
                  <td style={numTd}>{dc.size_kb != null ? `${dc.size_kb} KB` : '—'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {dc.file_path
                      ? <button onClick={() => viewDoc(dc)} disabled={fileBusy === dc.id}
                          style={{ background: 'transparent', color: C.accent, border: `1px solid ${C.accent}55`, borderRadius: '7px', padding: '5px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: fileBusy === dc.id ? .6 : 1 }}>
                          {fileBusy === dc.id ? 'Opening…' : 'View'}
                        </button>
                      : <span style={{ color: C.text3, fontSize: '12px' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        ))}

        {tab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ fontSize: '12.5px', color: C.text3 }}>
              CSV downloads — the same portfolio reports your client can export, computed over all current records.
            </div>
            {PROP_REPORT_GROUPS.map(([cat, names]) => (
              <div key={cat}>
                <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.text3, marginBottom: '8px' }}>{cat}</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {names.map(n => <button key={n} style={repBtn} onClick={() => downloadReport(n)}>{n}</button>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// Floating dark/light toggle — one control on every screen (login included)
// instead of a copy in each of the six headers.
function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    (typeof document !== 'undefined' && document.documentElement.dataset.theme) || 'dark'
  )
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try { window.localStorage.setItem(THEME_KEY, next) } catch (e) {}
  }
  return (
    <button className="acct-theme-fab" onClick={flip}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle dark / light mode">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/accountant">
      <ThemeToggle />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:linkId" element={<ClientBooks />} />
        <Route path="*" element={<Navigate to="/clients" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
