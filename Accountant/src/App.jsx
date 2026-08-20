import React, { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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
    const { data, error } = await sb
      .from('accountant_links')
      .select('id, client_id, product, client_name, permissions, status, created_at')
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
                  <button disabled title="The read-only books view arrives in the next update"
                    style={{ background: C.surface2, color: C.text3, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'not-allowed' }}>
                    Open books — coming soon
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

export default function App() {
  return (
    <BrowserRouter basename="/accountant">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="*" element={<Navigate to="/clients" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
