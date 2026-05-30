import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { PRODUCT } from '../config/product'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [mode, setMode] = useState('auth') // 'auth' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [bizName, setBizName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { login } = useStore()
  const navigate = useNavigate()

  const inp = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '11px 14px', color: 'var(--text)',
    fontSize: '14px', outline: 'none', width: '100%',
  }
  const primaryBtn = {
    background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '14px',
    padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer',
  }

  const reset = () => { setError(''); setSuccess('') }

  const doLogin = async () => {
    if (!email || !password) return setError('Please enter email and password')
    setLoading(true); reset()
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err

      const res = await login(data.user)

      // Valid credentials, but no account for THIS product.
      if (!res.ok) {
        await supabase.auth.signOut()
        setLoading(false)
        setError(`No ${PRODUCT.name} account found for this email. Please register for ${PRODUCT.name} first.`)
        return
      }

      navigate(res.isAdmin ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  const doRegister = async () => {
    if (!bizName || !email || !password) return setError('Please fill all fields')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true); reset()
    try {
      const { error: err } = await supabase.auth.signUp({
        email, password,
        options: { data: { tenant_name: bizName.trim(), product: PRODUCT.id } },
      })
      if (err) throw err
      setSuccess('Check your email to confirm your account, then log in.')
      setTab('login'); setBizName(''); setPassword('')
    } catch (err) {
      setError(err.message || 'Registration failed')
    }
    setLoading(false)
  }

  const doForgot = async () => {
    if (!email) return setError('Please enter your email address')
    setLoading(true); reset()
    try {
      const siteUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : `${window.location.protocol}//${window.location.host}`
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}${PRODUCT.basename}/reset-password`,
      })
      if (err) throw err
      setSuccess('Password reset link sent! Check your inbox (and spam).')
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    }
    setLoading(false)
  }

  const Logo = () => (
    <>
      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '6px' }}>
        Alzaro<span style={{ color: 'var(--accent)' }}>{PRODUCT.name.replace('Alzaro', '')}</span>
      </div>
      <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>{PRODUCT.tagline}</div>
    </>
  )

  const Alerts = () => (
    <>
      {error && <div style={{ background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>}
      {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--green)', marginBottom: '14px' }}>✓ {success}</div>}
    </>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', width: '420px', maxWidth: '100%' }}>
        <Logo />

        {mode === 'forgot' ? (
          <>
            <button onClick={() => { setMode('auth'); reset() }} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}>← Back to login</button>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>🔑</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>Reset Password</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Enter your email and we'll send a reset link</div>
            </div>
            <Alerts />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && doForgot()} />
              <button onClick={doForgot} disabled={loading} style={{ ...primaryBtn, opacity: loading ? .7 : 1 }}>{loading ? 'Sending…' : 'Send Reset Link'}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', borderRadius: '8px', padding: '4px', marginBottom: '20px' }}>
              {['login', 'register'].map(t => (
                <div key={t} onClick={() => { setTab(t); reset() }} style={{
                  flex: 1, padding: '8px', textAlign: 'center', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'var(--surface3)' : 'transparent', color: tab === t ? 'var(--text)' : 'var(--text2)',
                }}>{t === 'login' ? 'Login' : `Register ${PRODUCT.tenantNoun.charAt(0).toUpperCase() + PRODUCT.tenantNoun.slice(1)}`}</div>
              ))}
            </div>
            <Alerts />
            {tab === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button onClick={doLogin} disabled={loading} style={{ ...primaryBtn, opacity: loading ? .7 : 1 }}>{loading ? 'Signing in…' : 'Sign In'}</button>
                <button onClick={() => { setMode('forgot'); reset() }} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer', padding: '8px' }}>Forgot password?</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--accent)', textAlign: 'center' }}>
                  🎉 Start your <strong>{PRODUCT.trialDays}-day free trial</strong> with full access
                </div>
                <input style={inp} placeholder={`${PRODUCT.tenantLabel} *`} value={bizName} onChange={e => setBizName(e.target.value)} />
                <input style={inp} type="email" placeholder="Email address *" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inp} type="password" placeholder="Password (min 6 characters) *" value={password} onChange={e => setPassword(e.target.value)} />
                <button onClick={doRegister} disabled={loading} style={{ ...primaryBtn, opacity: loading ? .7 : 1 }}>{loading ? 'Creating account…' : 'Start Free Trial'}</button>
                <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>No credit card required · Cancel anytime</div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{PRODUCT.fullName} · v1.0</div>
    </div>
  )
}
