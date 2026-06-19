import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { getGarageForProduct, joinProduct } from '../lib/db'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [garageName, setGarageName] = useState('')
  const [tier, setTier] = useState(() => {
    const p = new URLSearchParams(window.location.search).get('plan')
    return ['basic', 'bronze', 'silver', 'gold'].includes(p) ? p : 'gold'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [joinMode, setJoinMode] = useState(false)   // existing Alzaro login, no TyreOps garage yet
  const [joinName, setJoinName] = useState('')      // garage name for the new TyreOps trial
  const { login } = useStore()
  const navigate = useNavigate()

  // Arrived from the email confirmation page? Show a welcome banner.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('confirmed') === '1') {
      setSuccess('Email confirmed — you can sign in now.')
      // Tidy the URL so a refresh doesn't re-show the banner
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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
      
      // MULTI-PRODUCT — look for this login's TyreOps garage specifically.
      // If they're an Alzaro user from another product (e.g. GarageOps),
      // offer to start a separate TyreOps trial on the same login.
      const garage = await getGarageForProduct(email, 'tyreops')
      if (!garage) {
        // Fresh TyreOps signup: garage name was captured at registration.
        // Auto-create the garage instead of asking again.
        const { data: { user } } = await supabase.auth.getUser()
        const signupGarageName = user?.user_metadata?.garage_name
        const signupProduct = user?.user_metadata?.product
        if (signupGarageName && signupProduct === 'tyreops') {
          await joinProduct('tyreops', signupGarageName)
          login(email)
          navigate('/dashboard')
          return
        }
        // Existing Alzaro user from another product — offer the join screen.
        setJoinMode(true)
        setLoading(false)
        return
      }
      // Regular garage login
      login(email)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  // Existing Alzaro user starting their TyreOps trial
  const doJoin = async () => {
    if (!joinName.trim()) return setError('Please enter your garage name')
    setLoading(true); setError('')
    try {
      await joinProduct('tyreops', joinName.trim())
      login(email)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Could not set up your TyreOps account')
      setLoading(false)
    }
  }

  const cancelJoin = async () => {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    setJoinMode(false)
    setJoinName('')
    setError('')
  }

  const doRegister = async () => {
    if (!garageName || !email || !password) return setError('Please fill all fields')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true); setError(''); setSuccess('')
    try {
      const siteUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : `${window.location.protocol}//${window.location.host}`

      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            garage_name: garageName.trim(),
            product: 'tyreops',
            plan: tier
          },
          emailRedirectTo: `${siteUrl}/confirmed?product=tyreops`
        }
      })
      if (err) throw err
      // Supabase returns a fake "success" (user with no identities) when the
      // email is already registered — no email is sent in that case.
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setError('This email already has an Alzaro account. Go to Login and sign in with your existing password — we\'ll set up TyreOps on that login. Forgot it? Use "Forgot password".')
        setTab('login')
        setLoading(false)
        return
      }
      setSuccess('Check your email to confirm your account, then log in.')
      setTab('login')
      setGarageName('')
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
      // Use the actual deployed URL, not localhost
      const siteUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5173'  // Dev
        : `${window.location.protocol}//${window.location.host}` // Production (e.g., garageiq-green.vercel.app)
      
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/tyreops/reset-password`,
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
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '6px' }}>
          Tyre<span style={{ color: 'var(--accent)' }}>Ops</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Tyre Management Platform</div>
        
        {/* Join TyreOps view — signed in fine, but no TyreOps garage yet */}
        {joinMode ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>👋</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
                You're already with Alzaro
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text)' }}>{email}</strong> is registered to another
                Alzaro product. Start a separate <strong style={{ color: 'var(--accent)' }}>14-day
                TyreOps trial</strong> on this same login? Your other product and its data stay
                completely separate.
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                style={inp}
                placeholder="Garage name for TyreOps *"
                value={joinName}
                onChange={e => setJoinName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doJoin()}
                autoFocus
              />
              <button
                onClick={doJoin}
                disabled={loading}
                style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}
              >
                {loading ? 'Setting up...' : 'Start TyreOps Trial'}
              </button>
              <button
                onClick={cancelJoin}
                disabled={loading}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: '12px', cursor: 'pointer', padding: '8px', textAlign: 'center' }}
              >
                Not now — sign me out
              </button>
              <div style={{ fontSize: '11px', color: 'var(--text3)', textAlign: 'center' }}>
                Separate trial · Separate subscription · No card required
              </div>
            </div>
          </>
        ) : showForgotPassword ? (
          <>
            <div style={{ marginBottom: '20px' }}>
              <button 
                onClick={() => { setShowForgotPassword(false); setError(''); setSuccess('') }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text2)', 
                  fontSize: '13px', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Back to login
              </button>
            </div>
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>🔑</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                Reset Password
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
                Enter your email and we'll send you a reset link
              </div>
            </div>

            {error && (
              <div style={{ background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>
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
                style={{ 
                  background: 'var(--accent)', 
                  color: '#000', 
                  fontWeight: 700, 
                  fontSize: '14px', 
                  padding: '13px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  opacity: loading ? .7 : 1 
                }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Login/Register Tabs */}
            <div style={{ display: 'flex', gap: '6px', background: 'var(--surface2)', borderRadius: '8px', padding: '4px', marginBottom: '20px' }}>
              {['login', 'register'].map(t => (
                <div key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }} style={{
                  flex: 1, padding: '8px', textAlign: 'center', borderRadius: '6px',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: tab === t ? 'var(--surface3)' : 'transparent',
                  color: tab === t ? 'var(--text)' : 'var(--text2)',
                }}>
                  {t === 'login' ? 'Login' : 'Register Garage'}
                </div>
              ))}
            </div>
            
            {error && (
              <div style={{ background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>
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
                <button onClick={doLogin} disabled={loading} style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
                <button 
                  onClick={() => { setShowForgotPassword(true); setError(''); setSuccess('') }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--text2)', 
                    fontSize: '12px', 
                    cursor: 'pointer',
                    padding: '8px',
                    textAlign: 'center'
                  }}
                >
                  Forgot password?
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'rgba(45,212,191,.08)', border: '1px solid rgba(45,212,191,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--teal)', textAlign: 'center' }}>
                  🎉 Start your <strong>14-day free trial</strong> with full access to all features
                  <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '6px' }}>
                    Already use another Alzaro product? Just <strong>sign in</strong> with that email — we'll set up TyreOps on your existing login.
                  </div>
                </div>
                <input style={inp} placeholder="Garage name *" value={garageName} onChange={e => setGarageName(e.target.value)} />
                <input style={inp} type="email" placeholder="Email address *" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inp} type="password" placeholder="Password (min 6 characters) *" value={password} onChange={e => setPassword(e.target.value)} />
                <button onClick={doRegister} disabled={loading} style={{ background: 'var(--accent)', color: '#000', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1 }}>
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
      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>TyreOps · Tyre Management SaaS · v1.0</div>
    </div>
  )
}
