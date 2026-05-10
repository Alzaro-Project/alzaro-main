import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'
import { checkIsAdmin } from '../lib/db'
import garageOpsIcon from '../assets/alzaro-garageops-icon.jpg'

// GarageOps brand palette — matches landing page
const BRAND = {
  bg: '#0c0a0f',
  surface: '#14121a',
  surface2: '#1e1b26',
  surface3: '#282432',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.1)',
  text: '#f8f7fa',
  text2: '#9d99a8',
  text3: '#5c586a',
  red: '#e53935',
  redLight: '#ff6659',
  redGlow: 'rgba(229,57,53,0.4)',
  redSubtle: 'rgba(229,57,53,0.08)',
  orange: '#ff7043',
  green: '#4caf50',
  amber: '#ffb300',
}

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [garageName, setGarageName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const { login } = useStore()
  const navigate = useNavigate()

  const inputStyle = {
    background: BRAND.surface2,
    border: `1px solid ${BRAND.border}`,
    borderRadius: '8px',
    padding: '13px 16px',
    color: BRAND.text,
    fontSize: '14px',
    fontFamily: "'Space Grotesk', sans-serif",
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s ease',
  }

  const primaryBtnStyle = {
    background: BRAND.red,
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    padding: '14px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: '-0.2px',
    boxShadow: `0 4px 16px ${BRAND.redGlow}`,
    transition: 'transform 0.1s ease, box-shadow 0.15s ease',
  }

  const doLogin = async () => {
    if (!email || !password) return setError('Please enter email and password')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err

      const isAdmin = await checkIsAdmin(email)
      if (isAdmin) {
        login(email, true)
        navigate('/admin')
      } else {
        login(email, false)
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Login failed')
    }
    setLoading(false)
  }

  const doRegister = async () => {
    if (!garageName || !email || !password) return setError('Please fill all fields')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            garage_name: garageName.trim(),
            product: 'garageops'
          }
        }
      })
      if (err) throw err
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
      const siteUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5173'
        : `${window.location.protocol}//${window.location.host}`
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/garageops/reset-password`,
      })
      if (err) throw err
      setSuccess('Password reset link sent! Check your email inbox (and spam folder).')
    } catch (err) {
      setError(err.message || 'Failed to send reset email')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: BRAND.bg,
      fontFamily: "'Space Grotesk', -apple-system, sans-serif",
      color: BRAND.text,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '14px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Import Space Grotesk font (matches landing page) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

        .gop-login-card input:focus {
          border-color: ${BRAND.red} !important;
          box-shadow: 0 0 0 3px ${BRAND.redSubtle};
        }
        .gop-login-card button.primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px ${BRAND.redGlow};
        }
        .gop-login-card button.primary:active {
          transform: translateY(0);
        }
        @keyframes gopFloat {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -20px); }
        }
        .gop-bg-accent {
          position: absolute;
          width: 560px;
          height: 560px;
          border-radius: 50%;
          background: radial-gradient(circle, ${BRAND.redSubtle} 0%, transparent 70%);
          filter: blur(40px);
          pointer-events: none;
          z-index: 0;
        }
      `}</style>

      {/* Ambient red glow — subtle, atmospheric */}
      <div className="gop-bg-accent" style={{ top: '-280px', right: '-200px', animation: 'gopFloat 8s ease-in-out infinite' }} />
      <div className="gop-bg-accent" style={{ bottom: '-280px', left: '-200px', animation: 'gopFloat 10s ease-in-out infinite reverse' }} />

      <div className="gop-login-card" style={{
        background: BRAND.surface,
        border: `1px solid ${BRAND.border}`,
        borderRadius: '16px',
        padding: '40px 36px',
        width: '440px',
        maxWidth: '100%',
        position: 'relative',
        zIndex: 1,
        boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
      }}>
        {/* Logo — Alzaro GarageOps icon (cropped from full logo, no text) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px',
        }}>
          <img
  src={garageOpsIcon}
  alt="Alzaro GarageOps"
  style={{
    width: '200px',
    height: 'auto',
    display: 'block',
  }}
/>
        </div>

        {showForgotPassword ? (
          // ==================== FORGOT PASSWORD VIEW ====================
          <>
            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={() => { setShowForgotPassword(false); setError(''); setSuccess('') }}
                style={{
                  background: 'none', border: 'none',
                  color: BRAND.text2, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px', padding: 0,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                ← Back to login
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔑</div>
              <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
                Reset Password
              </div>
              <div style={{ fontSize: '13px', color: BRAND.text2 }}>
                Enter your email and we'll send you a reset link
              </div>
            </div>

            {error && <ErrorBanner text={error} />}
            {success && <SuccessBanner text={success} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                style={inputStyle}
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doForgotPassword()}
              />
              <button
                className="primary"
                onClick={doForgotPassword}
                disabled={loading}
                style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </div>
          </>
        ) : (
          // ==================== LOGIN / REGISTER VIEW ====================
          <>
            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              gap: '6px',
              background: BRAND.surface2,
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '22px',
            }}>
              {['login', 'register'].map(t => (
                <div
                  key={t}
                  onClick={() => { setTab(t); setError(''); setSuccess('') }}
                  style={{
                    flex: 1, padding: '10px',
                    textAlign: 'center', borderRadius: '7px',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    background: tab === t ? BRAND.surface3 : 'transparent',
                    color: tab === t ? BRAND.text : BRAND.text2,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t === 'login' ? 'Login' : 'Register Garage'}
                </div>
              ))}
            </div>

            {error && <ErrorBanner text={error} />}
            {success && <SuccessBanner text={success} />}

            {tab === 'login' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                />
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                />
                <button
                  className="primary"
                  onClick={doLogin}
                  disabled={loading}
                  style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Signing in...' : 'Sign In →'}
                </button>
                <button
                  onClick={() => setShowForgotPassword(true)}
                  style={{
                    background: 'none', border: 'none',
                    color: BRAND.text2, fontSize: '12px', cursor: 'pointer',
                    padding: '8px', textAlign: 'center',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Forgot password?
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{
                  background: BRAND.redSubtle,
                  border: `1px solid rgba(229,57,53,0.2)`,
                  borderRadius: '8px',
                  padding: '11px 14px',
                  fontSize: '12px',
                  color: BRAND.redLight,
                  textAlign: 'center',
                  fontWeight: 500,
                }}>
                  🔧 Start your <strong>14-day free trial</strong> — full access, no card required
                </div>
                <input
                  style={inputStyle}
                  placeholder="Garage name *"
                  value={garageName}
                  onChange={e => setGarageName(e.target.value)}
                />
                <input
                  style={inputStyle}
                  type="email"
                  placeholder="Email address *"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="Password (min 6 characters) *"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  className="primary"
                  onClick={doRegister}
                  disabled={loading}
                  style={{ ...primaryBtnStyle, opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Creating account...' : 'Start Free Trial →'}
                </button>
                <div style={{
                  fontSize: '11px',
                  color: BRAND.text3,
                  textAlign: 'center',
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: '0.3px',
                }}>
                  No credit card · Cancel anytime · UK-based support
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        fontSize: '11px',
        color: BRAND.text3,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.5px',
        position: 'relative',
        zIndex: 1,
      }}>
        Alzaro GarageOps · Built for UK garages · v1.0
      </div>
    </div>
  )
}

// ==================== HELPER COMPONENTS ====================

function ErrorBanner({ text }) {
  return (
    <div style={{
      background: 'rgba(229,57,53,0.1)',
      border: '1px solid rgba(229,57,53,0.25)',
      borderRadius: '8px',
      padding: '11px 14px',
      fontSize: '13px',
      color: '#ff6659',
      marginBottom: '14px',
    }}>
      {text}
    </div>
  )
}

function SuccessBanner({ text }) {
  return (
    <div style={{
      background: 'rgba(76,175,80,0.1)',
      border: '1px solid rgba(76,175,80,0.25)',
      borderRadius: '8px',
      padding: '11px 14px',
      fontSize: '13px',
      color: '#66bb6a',
      marginBottom: '14px',
    }}>
      ✓ {text}
    </div>
  )
}
