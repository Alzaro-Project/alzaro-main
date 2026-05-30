import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

// ============================================================
//  SUPABASE CONNECTION
//  Paste your project's values below (Supabase dashboard →
//  Project Settings → API). Nothing else needs configuring.
// ============================================================
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Optional: emails listed here go to the admin dashboard instead
// of the normal one. Leave as-is if you don't need it.
const ADMIN_EMAILS = ['admin@alzaro.co.uk']

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  // Where to send the user after a successful login.
  // Plain redirects, so this works with or without react-router.
  const goTo = (path) => { window.location.href = path }

  const inp = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '11px 14px', color: 'var(--text)',
    fontSize: '14px', outline: 'none', width: '100%'
  }

  const doLogin = async () => {
    if (!email || !password) return setError('Please enter email and password')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err

      const isAdmin = ADMIN_EMAILS.includes(email.trim().toLowerCase())
      goTo(isAdmin ? '/soloops/admin' : '/soloops/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  const doRegister = async () => {
    if (!businessName || !email || !password) return setError('Please fill all fields')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            business_name: businessName.trim(),
            product: 'soloops'
          }
        }
      })
      if (err) throw err
      setSuccess('Check your email to confirm your account, then log in.')
      setTab('login')
      setBusinessName('')
      setPassword('')
    } catch (err) {
      setError(err.message || 'Registration failed')
    }
    setLoading(false)
  }

  const doForgotPassword = async () => {
    if (!email) return setError('Please enter your email address')
    setLoading(true); setError(''); setSuccess('')
    try {
      const siteUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : `${window.location.protocol}//${window.location.host}`

      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/soloops/reset-password`,
      })
      if (err) throw err
      setSuccess('Password reset link sent! Check your email inbox (and spam folder).')
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', width: '420px', maxWidth: '100%' }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Alzaro <span style={{ color: 'var(--orange)' }}>SoloOps</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Business Operations for Sole Traders</div>

        {showForgotPassword ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => { setShowForgotPassword(false); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                ← Back to login
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>🔑</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                Reset Password
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
                Enter your email and we'll send you a reset link
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--green)', marginBottom: '14px' }}>
                ✓ {success}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                style={inp}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doForgotPassword()}
              />
              <button
                onClick={doForgotPassword}
                disabled={loading}
                style={{ background: 'linear-gradient(135deg, var(--orange), var(--amber))', color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', borderRadius: '8px', padding: '4px', marginBottom: '20px' }}>
              {['login', 'register'].map(t => (
                <div key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }} style={{
                  flex: 1, padding: '8px', textAlign: 'center', borderRadius: '6px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'var(--surface3)' : 'transparent',
                  color: tab === t ? 'var(--text)' : 'var(--text2)',
                }}>
                  {t === 'login' ? 'Login' : 'Register Business'}
                </div>
              ))}
            </div>

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--green)', marginBottom: '14px' }}>
                ✓ {success}
              </div>
            )}

            {tab === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input style={inp} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} />
                <button onClick={doLogin} disabled={loading} style={{ background: 'linear-gradient(135deg, var(--orange), var(--amber))', color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button
                  onClick={() => { setShowForgotPassword(true); setError(''); setSuccess('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer', padding: '8px', textAlign: 'center' }}
                >
                  Forgot password?
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'var(--orange-subtle)', border: '1px solid rgba(249,115,22,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--orange-light)', textAlign: 'center' }}>
                  🎉 Start your <strong>14-day free trial</strong> with full access to all features
                </div>
                <input style={inp} placeholder="Business name *" value={businessName} onChange={e => setBusinessName(e.target.value)} />
                <input style={inp} type="email" placeholder="Email address *" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inp} type="password" placeholder="Password (min 6 characters) *" value={password} onChange={e => setPassword(e.target.value)} />
                <button onClick={doRegister} disabled={loading} style={{ background: 'linear-gradient(135deg, var(--orange), var(--amber))', color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                  {loading ? 'Creating account...' : 'Start Free Trial'}
                </button>
                <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>
                  No credit card required · Cancel anytime
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Alzaro SoloOps · Business Management SaaS · v1.0</div>
    </div>
  )
}
