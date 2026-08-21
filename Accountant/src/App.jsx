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
const C = {
  bg: '#0f1115', surface: '#171a21', surface2: '#1e222b', border: '#2a2f3a',
  text: '#e8eaf0', text2: '#aab0be', text3: '#7a8194', accent: '#f59e0b',
  green: '#22c55e', red: '#ef4444',
}
const page = { minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'Manrope, sans-serif' }
const inp = { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '11px 14px', color: C.text, fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' }
const btn = { background: C.accent, color: '#151515', border: 'none', borderRadius: '8px', padding: '11px 18px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', width: '100%' }
const PRODUCT_LABEL = { soloops: 'SoloOps', tyreops: 'TyreOps', garageops: 'GarageOps', serviceops: 'ServiceOps', propertyops: 'PropertyOps' }

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
    <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '18px', padding: '36px', width: '420px', maxWidth: '100%' }}>
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
  // TyreOps is account-scoped with computed VAT, so it has its own component.
  if (link.product === 'tyreops') return <TyreOpsBooks link={link} onBack={() => navigate('/clients')} />

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

export default function App() {
  return (
    <BrowserRouter basename="/accountant">
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
