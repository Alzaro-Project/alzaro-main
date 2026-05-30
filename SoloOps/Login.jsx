// ============================================================
//  Alzaro SoloOps — Login / Register
//  Loaded by app.html via <script type="text/babel">.
//  Uses CDN globals (React, ReactDOM) + window.sb from supabase.js
//  — no import statements (browser Babel can't resolve modules).
// ============================================================
const { useState } = React

// Emails listed here go to the admin dashboard instead of the normal one.
const ADMIN_EMAILS = ['mohammmed250052@gmail.com']

function Login() {
  const [tab, setTab] = useState(window.__START_TAB === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const goTo = (path) => { window.location.href = path }

  const inp = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '11px 14px', color: 'var(--text)',
    fontSize: '14px', outline: 'none', width: '100%'
  }
  const grad = 'linear-gradient(135deg, var(--orange), var(--amber))'

  const doLogin = async () => {
    if (!email || !password) return setError('Please enter email and password')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { data, error: err } = await window.sb.auth.signInWithPassword({ email, password })
      if (err) throw err

      // Only allow accounts that belong to SoloOps.
      // (The shared database also holds TyreOps/GarageOps/PropertyOps accounts.)
      const isAdmin = ADMIN_EMAILS.includes(email.trim().toLowerCase())
      const product = data?.user?.user_metadata?.product
      if (!isAdmin && product !== 'soloops') {
        await window.sb.auth.signOut()
        throw new Error('No SoloOps account found for this email. Please use the Register tab to create one.')
      }
      goTo(isAdmin ? '/soloops/admin' : '/soloops/dashboard')
    } catch (err) {
      const msg = err.message || 'Login failed'
      // Keep Supabase's deliberate ambiguity (don't reveal if an email exists),
      // but make it friendlier and point new users to Register.
      if (/invalid login credentials/i.test(msg)) {
        setError('Email or password is incorrect. New here? Use the Register tab to create an account.')
      } else {
        setError(msg)
      }
    }
    setLoading(false)
  }

  const doRegister = async () => {
    if (!businessName || !email || !password) return setError('Please fill all fields')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await window.sb.auth.signUp({
        email,
        password,
        options: { data: { business_name: businessName.trim(), product: 'soloops' } }
      })
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
      const siteUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : `${window.location.protocol}//${window.location.host}`
      const { error: err } = await window.sb.auth.resetPasswordForEmail(email, {
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '20px' }} className="fade-in">
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', width: '420px', maxWidth: '100%' }}>
        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Alzaro <span style={{ color: 'var(--orange)' }}>SoloOps</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Business Operations for Sole Traders</div>

        {showForgotPassword ? (
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

// Mount into #root (matches PropertyOps' self-rendering pattern)
ReactDOM.createRoot(document.getElementById('root')).render(<Login />)
