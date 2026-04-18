import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const inp = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '11px 14px', color: 'var(--text)',
    fontSize: '14px', outline: 'none', width: '100%'
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '14px', padding: '20px' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', width: '420px', maxWidth: '100%' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '32px', fontWeight: 800, textAlign: 'center', marginBottom: '6px' }}>
          Garage<span style={{ color: 'var(--accent)' }}>IQ</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '13px', marginBottom: '24px' }}>Garage Management Platform</div>

        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => navigate('/login')}
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
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>GarageIQ · Garage Management SaaS · v1.0</div>
    </div>
  )
}
