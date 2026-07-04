import React, { useState } from 'react'
import { grad } from './UI.jsx'

export default function WelcomeBanner({ invoices, expenses, clients, bizName, setView, setModal, uid, canExpense = false }) {
  const SUCCESS = '#22c55e'
  const key = uid ? `solo_welcome_dismissed_${uid}` : 'solo_welcome_dismissed'
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === '1' } catch (e) { return false }
  })
  const dismiss = () => {
    try { localStorage.setItem(key, '1') } catch (e) {}
    setDismissed(true)
  }

  const steps = [
    { id:'biz',     label:'Set up your business details', done: !!(bizName && bizName.trim()), action: () => setView('settings') },
    { id:'client',  label:'Add your first client',        done: (clients  || []).length > 0,    action: () => setView('clients') },
    // Expenses are a Bronze feature — only surface the onboarding step (which
    // opens the expense form) when the user's tier can actually reach it.
    ...(canExpense ? [{ id:'expense', label:'Log your first expense', done: (expenses || []).length > 0, action: () => setModal('expense') }] : []),
    { id:'invoice', label:'Create your first invoice',    done: (invoices || []).length > 0,    action: () => setModal('invoice') },
  ]

  const completed = steps.filter(s => s.done).length
  const total = steps.length
  const allDone = completed === total
  if (dismissed || allDone) return null

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'16px', padding:'22px', marginBottom:'16px', position:'relative' }}>
      <button onClick={dismiss} title="Dismiss" style={{ position:'absolute', top:'14px', right:'16px', background:'transparent', border:'none', color:'var(--text3)', fontSize:'20px', cursor:'pointer', lineHeight:1 }}>×</button>

      <div style={{ marginBottom:'14px' }}>
        <h3 style={{ fontSize:'19px', fontWeight:800, margin:'0 0 3px 0', display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ WebkitTextFillColor:'initial' }}>👋</span>
          <span style={{ background:grad, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Welcome to SoloOps</span>
        </h3>
        <div style={{ color:'var(--text2)', fontSize:'13px' }}>Let's get you set up — {completed} of {total} complete</div>
      </div>

      <div style={{ height:'6px', background:'var(--surface2)', borderRadius:'3px', overflow:'hidden', marginBottom:'16px' }}>
        <div style={{ height:'100%', width:`${(completed/total)*100}%`, background:grad, transition:'width .3s ease' }} />
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {steps.map(step => (
          <div key={step.id} onClick={step.action}
            style={{ display:'flex', alignItems:'center', gap:'12px', background:'var(--surface2)', border:`1px solid ${step.done ? SUCCESS : 'var(--border)'}`, borderRadius:'10px', padding:'12px 15px', cursor:'pointer', transition:'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--amber)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = step.done ? SUCCESS : 'var(--border)'}>
            <div style={{ width:'22px', height:'22px', borderRadius:'50%', background: step.done ? SUCCESS : 'transparent', border: step.done ? 'none' : '2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#fff', fontSize:'13px', fontWeight:700 }}>{step.done ? '✓' : ''}</div>
            <span style={{ color: step.done ? 'var(--text3)' : 'var(--text)', fontSize:'13.5px', textDecoration: step.done ? 'line-through' : 'none', flex:1 }}>{step.label}</span>
            <span style={{ color:'var(--text3)', fontSize:'14px' }}>→</span>
          </div>
        ))}
      </div>
    </div>
  )
}
