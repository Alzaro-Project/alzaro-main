import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PRODUCT } from '../config/product'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [checked, setChecked] = useState(false)
  const navigate = useNavigate()

  const inp = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '11px 14px', color: 'var(--text)',
    fontSize: '14px', outline: 'none', width: '100%',
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setError('Invalid or expired reset link. Please request a new one.')
      setChecked(true)
    })
  }, [])

  const handleReset = async () => {
    if (!password) return setError('Please enter a new password')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError('Passwords do not match')
    setLoading(true); setError('')
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setSuccess(true)
      setTimeout(async () => { await supabase.auth.signOut(); navigate('/login') }, 3000)
    } catch (err) {
      setError(err.message || 'Failed to reset password')
    }
    setLoading(false)
  }

  if (!checked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text2)' }}>
          <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏳</div>
          <div>Verifying reset link…</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', width: '420px', maxWidth: '100%' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '6px' }}>
          Alzaro<span style={{ color: 'var(--accent)' }}>{PRODUCT.name.replace('Alzaro', '')}</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Reset Your Password</div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '18px', fontWeight: 700, color: 'var(--green)', marginBottom: '8px' }}>Password Reset Successfully!</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Redirecting to login…</div>
          </div>
        ) : error && !password ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <div style={{ background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,.25)', borderRadius: '8px', padding: '14px', fontSize: '13px', color: 'var(--red)', marginBottom: '16px' }}>{error}</div>
            <button onClick={() => navigate('/login')} style={{ background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '13px 24px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Back to Login</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', marginBottom: '8px' }}>🔐</div>
              <div style={{ fontSize: '13px', color: 'var(--text2)' }}>Enter your new password below</div>
            </div>
            {error && <div style={{ background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,.25)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--red)', marginBottom: '14px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input style={inp} type="password" placeholder="New password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} />
              <input style={inp} type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleReset()} />
              <button onClick={handleReset} disabled={loading} style={{ background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '13px', borderRadius: '8px', border: 'none', cursor: 'pointer', opacity: loading ? .7 : 1, marginTop: '8px' }}>{loading ? 'Resetting…' : 'Reset Password'}</button>
            </div>
          </>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{PRODUCT.fullName} · v1.0</div>
    </div>
  )
}
