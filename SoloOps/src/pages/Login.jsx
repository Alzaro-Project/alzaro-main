import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { signIn, signUp, getAccess, createAccess, resetPasswordForEmail, signOut } from '../lib/db.js'
import { inp, grad } from '../components/UI.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const startTab = params.get('tab') === 'register' ? 'register' : 'login'

  const [tab, setTab] = useState(startTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [joinMode, setJoinMode] = useState(false)
  const [pendingUser, setPendingUser] = useState(null)

  const goDash = () => navigate('/dashboard')

  const siteBase = () => window.location.hostname === 'localhost'
    ? 'http://localhost:5173'
    : `${window.location.protocol}//${window.location.host}`

  const doLogin = async () => {
    if (!email || !password) return setError('Please enter email and password')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { data, error: err } = await signIn(email, password)
      if (err) throw err

      const { data: access } = await getAccess(data.user.id)
      if (!access) {
        if (data.user.user_metadata?.product === 'soloops') {
          // Check the insert: if it fails, going to the dashboard just bounces
          // straight back here (loadAll finds no access row) with no message.
          const { error: insErr } = await createAccess({ email: data.user.email, user_id: data.user.id,
            business_name: data.user.user_metadata?.business_name || null })
          if (insErr) throw insErr
          goDash()
          return
        }
        setPendingUser(data.user)
        setJoinMode(true)
        setLoading(false)
        return
      }
      goDash()
    } catch (err) {
      const msg = err.message || 'Login failed'
      if (/invalid login credentials/i.test(msg)) {
        setError('Email or password is incorrect. New here? Use the Register tab to create an account.')
      } else {
        setError(msg)
      }
    }
    setLoading(false)
  }

  const doJoin = async () => {
    if (!businessName.trim()) return setError('Please enter your business name')
    if (!pendingUser) return setError('Something went wrong — please sign in again')
    setLoading(true); setError('')
    try {
      const { error: insErr } = await createAccess({
        user_id: pendingUser.id, email: pendingUser.email, business_name: businessName.trim(),
      })
      if (insErr) throw insErr
      goDash()
    } catch (err) {
      setError(err.message || 'Could not set up your SoloOps account')
      setLoading(false)
    }
  }

  const cancelJoin = async () => {
    try { await signOut() } catch (e) { /* ignore */ }
    setJoinMode(false); setPendingUser(null); setBusinessName(''); setError(''); setLoading(false)
  }

  const doRegister = async () => {
    if (!businessName || !email || !password) return setError('Please fill all fields')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { data: signInData, error: signInErr } = await signIn(email, password)

      if (!signInErr && signInData?.user) {
        const uid = signInData.user.id
        const { data: existing } = await getAccess(uid)
        if (existing) {
          await signOut()
          setSuccess('You already have SoloOps on this account \u2014 just log in.')
          setTab('login'); setBusinessName(''); setPassword('')
          setLoading(false); return
        }
        const { error: insErr } = await createAccess({ user_id: uid, email: email.trim().toLowerCase(), business_name: businessName.trim() })
        if (insErr) throw insErr
        goDash()
        return
      }

      // A wrong password on an existing account also lands here. The signUp
      // call below disambiguates a brand-new email from an existing one via
      // the returned identities array, so we don't branch on signInErr.
      const { data: signUpData, error: err } = await signUp(email, password, {
        emailRedirectTo: `${siteBase()}/soloops/login`,
        data: { business_name: businessName.trim(), product: 'soloops' },
      })

      // Supabase obfuscates duplicate emails: signUp "succeeds" but returns a
      // user with an empty identities array. Some configs return an explicit
      // "already registered" error instead. Handle both.
      const alreadyRegistered =
        /already registered|already exists|user already/i.test(err?.message || '') ||
        (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0)

      if (alreadyRegistered) {
        setError('That account is already registered — head to Login to sign in (or use “Forgot password” if you’ve lost it).')
        setTab('login'); setPassword('')
        setLoading(false); return
      }

      if (err) throw err
      setSuccess('Check your email to confirm your account, then log in.')
      setTab('login'); setBusinessName(''); setPassword('')
    } catch (err) {
      setError(err.message || 'Registration failed')
    }
    setLoading(false)
  }

  const doForgotPassword = async () => {
    if (!email) return setError('Please enter your email address')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await resetPasswordForEmail(email, `${siteBase()}/soloops/reset-password`)
      if (err) throw err
      setSuccess('Password reset link sent! Check your email inbox (and spam folder).')
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '20px' }} className="fade-in">
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', width: '420px', maxWidth: '100%' }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Alzaro <span style={{ color: 'var(--orange)' }}>SoloOps</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Business Operations for Sole Traders</div>

        {joinMode ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>👋</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                You're already with Alzaro
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>{pendingUser?.email}</strong> is registered to another
                Alzaro product. Start a separate <strong style={{ color: 'var(--orange-light)' }}>14-day
                SoloOps trial</strong> on this same login? Your other products and their data stay
                completely separate.
              </div>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input style={inp} placeholder="Business name for SoloOps *" value={businessName} onChange={e => setBusinessName(e.target.value)} onKeyDown={e => e.key === 'Enter' && doJoin()} autoFocus />
              <button onClick={doJoin} disabled={loading} style={{ background: grad, color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                {loading ? 'Setting up...' : 'Start SoloOps Trial →'}
              </button>
              <button onClick={cancelJoin} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer', padding: '8px', textAlign: 'center' }}>
                Not now — sign me out
              </button>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>Separate trial · Separate subscription · No card required</div>
            </div>
          </>
        ) : showForgotPassword ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <button onClick={() => { setShowForgotPassword(false); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ← Back to login
              </button>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>🔑</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Reset Password</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Enter your email and we'll send you a reset link</div>
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>}
            {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--green)', marginBottom: '14px' }}>✓ {success}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && doForgotPassword()} />
              <button onClick={doForgotPassword} disabled={loading} style={{ background: grad, color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', borderRadius: '8px', padding: '4px', marginBottom: '20px' }}>
              {['login', 'register'].map(t => (
                <div key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }} style={{
                  flex: 1, padding: '8px', textAlign: 'center', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'var(--surface3)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text2)',
                }}>{t === 'login' ? 'Login' : 'Register Business'}</div>
              ))}
            </div>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>}
            {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--green)', marginBottom: '14px' }}>✓ {success}</div>}
            {tab === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button onClick={doLogin} disabled={loading} style={{ background: grad, color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button onClick={() => { setShowForgotPassword(true); setError(''); setSuccess('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer', padding: '8px', textAlign: 'center' }}>
                  Forgot password?
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'var(--orange-subtle)', border: '1px solid rgba(249,115,22,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--orange-light)', textAlign: 'center' }}>
                  🎉 Start your <strong>14-day free trial</strong> with full access to all features
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px' }}>
                    Already use another Alzaro product? Just <strong>sign in</strong> — we'll set up SoloOps on your existing login.
                  </div>
                </div>
                <input style={inp} placeholder="Business name *" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                <input style={inp} type="email" placeholder="Email address *" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inp} type="password" placeholder="Password (min 6 characters) *" value={password} onChange={e => setPassword(e.target.value)} />
                <button onClick={doRegister} disabled={loading} style={{ background: grad, color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                  {loading ? 'Creating account...' : 'Start Free Trial'}
                </button>
                <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>No credit card required · Cancel anytime</div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Alzaro SoloOps · Business Management SaaS · v1.0</div>
    </div>
  )
}
