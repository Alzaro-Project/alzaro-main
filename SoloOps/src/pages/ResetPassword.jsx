import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession, onAuthChange, updateUser } from '../lib/db.js'
import { inp, grad } from '../components/UI.jsx'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let sub
    const check = async () => {
      const session = await getSession()
      if (session) { setReady(true) }
      else {
        sub = onAuthChange((event, s) => {
          if (s || event === 'PASSWORD_RECOVERY') setReady(true)
        })
      }
      setChecking(false)
    }
    check()
    return () => sub?.unsubscribe?.()
  }, [])

  const submit = async () => {
    if (!password || !confirm) return setError('Please enter and confirm your new password')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    if (password !== confirm) return setError('Passwords do not match')
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: err } = await updateUser({ password })
      if (err) throw err
      setSuccess('Password updated! Redirecting you to login…')
      setTimeout(() => { navigate('/login') }, 1800)
    } catch (err) {
      setError(err.message || 'Could not update password')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'14px', padding:'20px' }} className="fade-in">
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'20px', padding:'40px', width:'420px', maxWidth:'100%' }}>
        <div style={{ fontFamily:'Manrope, sans-serif', fontSize:'32px', fontWeight:800, textAlign:'center', marginBottom:'6px', letterSpacing:'-0.5px' }}>
          Alzaro <span style={{ color:'var(--orange)' }}>SoloOps</span>
        </div>
        <div style={{ textAlign:'center', color:'var(--text2)', fontSize:'13px', marginBottom:'24px' }}>Set a new password</div>

        {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--red)', marginBottom:'14px' }}>{error}</div>}
        {success && <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--green)', marginBottom:'14px' }}>✓ {success}</div>}

        {checking ? (
          <div style={{ textAlign:'center', color:'var(--text2)', fontSize:'14px', padding:'10px' }}>Checking your reset link…</div>
        ) : !ready ? (
          <>
            <div style={{ textAlign:'center', color:'var(--text2)', fontSize:'13.5px', lineHeight:1.6, marginBottom:'16px' }}>
              This reset link is invalid or has expired. Request a new one from the login page.
            </div>
            <a href="/soloops/login" style={{ display:'block', textAlign:'center', background:grad, color:'#000', fontWeight:700, fontSize:'14px', padding:'13px', borderRadius:'8px', textDecoration:'none' }}>Back to login</a>
          </>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <input style={inp} type="password" placeholder="New password (min 6 characters)" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
            <input style={inp} type="password" placeholder="Confirm new password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
            <button onClick={submit} disabled={loading} style={{ background:grad, color:'#000', fontWeight:700, fontSize:'14px', padding:'13px', borderRadius:'8px', border:'none', cursor:'pointer', opacity:loading?.7:1 }}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize:'11px', color:'var(--text3)' }}>Alzaro SoloOps · Business Management SaaS · v1.0</div>
    </div>
  )
}
