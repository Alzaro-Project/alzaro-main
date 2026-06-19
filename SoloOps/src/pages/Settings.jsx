import React from 'react'
import { card, inp, btnPri, btnSec } from '../components/UI.jsx'
import { updateUser, updateAccessName, uploadFile, signedUrl } from '../lib/db.js'

export default function Settings({ session, signOut, flash }) {
  const [name, setName] = React.useState(session.user.user_metadata?.business_name || '')
  const [address, setAddress] = React.useState(session.user.user_metadata?.company_address || '')
  const [vatNo, setVatNo] = React.useState(session.user.user_metadata?.vat_number || '')
  const [logoUrl, setLogoUrl] = React.useState(session.user.user_metadata?.logo_url || '')
  const [email, setEmail] = React.useState(session.user.email || '')
  const [pw, setPw] = React.useState('')
  const [pw2, setPw2] = React.useState('')
  const [busy, setBusy] = React.useState('')
  const [msg, setMsg] = React.useState('')
  const [err, setErr] = React.useState('')

  const note = (m) => { setMsg(m); setErr(''); setTimeout(()=>setMsg(''), 3500) }
  const fail = (m) => { setErr(m); setMsg('') }

  const saveName = async () => {
    setBusy('name'); setErr('')
    try {
      const { error } = await updateUser({ data: {
        business_name: name.trim(), company_address: address.trim(), vat_number: vatNo.trim()
      } })
      if (error) throw error
      await updateAccessName(session.user.id, name.trim())
      note('Business details saved')
    } catch (e) { fail(e.message || 'Could not save details') }
    setBusy('')
  }

  const uploadLogo = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy('logo'); setErr('')
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${session.user.id}/logo-${safe}`
      const { error: upErr } = await uploadFile(path, f, { upsert:true })
      if (upErr) throw upErr
      const { data } = await signedUrl(path, 60*60*24*365)
      const url = data?.signedUrl || ''
      await updateUser({ data: { logo_url: url } })
      setLogoUrl(url); note('Logo uploaded')
    } catch (e) { fail(e.message || 'Could not upload logo') }
    setBusy('')
  }

  const saveEmail = async () => {
    if (!email.trim()) return fail('Enter an email')
    setBusy('email'); setErr('')
    try {
      const { error } = await updateUser({ email: email.trim() })
      if (error) throw error
      note('Confirmation sent to your new email — click the link to confirm the change.')
    } catch (e) { fail(e.message || 'Could not update email') }
    setBusy('')
  }

  const savePw = async () => {
    if (pw.length < 6) return fail('Password must be at least 6 characters')
    if (pw !== pw2) return fail('Passwords do not match')
    setBusy('pw'); setErr('')
    try {
      const { error } = await updateUser({ password: pw })
      if (error) throw error
      setPw(''); setPw2(''); note('Password changed')
    } catch (e) { fail(e.message || 'Could not change password') }
    setBusy('')
  }

  const tiers = [
    { name:'Bronze', price:'£40/mo', feats:'Dashboard, income & expenses, invoicing, mileage, CSV import' },
    { name:'Silver', price:'£55/mo', feats:'Everything in Bronze + recurring detection, receipt matching, tax estimates' },
    { name:'Gold',   price:'£70/mo', feats:'Everything in Silver + accountant export pack, priority support', current:true },
  ]
  const sectionTitle = { fontWeight:700, fontSize:'15px', marginBottom:'14px' }
  const lbl = { fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', alignItems:'start' }}>
      {msg && <div style={{ gridColumn:'1/-1', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,.25)', borderRadius:'10px', padding:'12px 16px', fontSize:'13.5px', color:'var(--green)' }}>✓ {msg}</div>}
      {err && <div style={{ gridColumn:'1/-1' }}><div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--red)' }}>{err}</div></div>}

      <div data-card style={card}>
        <div style={sectionTitle}>Business profile</div>
        <div style={{ fontSize:'11.5px', color:'var(--text3)', marginBottom:'14px' }}>Shown on your invoices.</div>
        <div style={{ marginBottom:'12px' }}>
          <div style={lbl}>Business name</div>
          <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Your business name" />
        </div>
        <div style={{ marginBottom:'12px' }}>
          <div style={lbl}>Company address</div>
          <textarea style={{...inp, minHeight:'70px', resize:'vertical', fontFamily:'inherit'}} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street, city, postcode" />
        </div>
        <div style={{ marginBottom:'12px' }}>
          <div style={lbl}>VAT number (optional)</div>
          <input style={inp} value={vatNo} onChange={e=>setVatNo(e.target.value)} placeholder="GB123456789" />
        </div>
        <div style={{ marginBottom:'12px' }}>
          <div style={lbl}>Logo</div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            {logoUrl && <img src={logoUrl} alt="logo" style={{ height:'42px', width:'42px', objectFit:'contain', borderRadius:'8px', background:'var(--surface3)', padding:'4px' }} />}
            <label style={{...btnSec, cursor:'pointer', opacity:busy==='logo'?.7:1}}>
              {busy==='logo' ? 'Uploading…' : (logoUrl ? 'Replace logo' : 'Upload logo')}
              <input type="file" accept="image/*" onChange={uploadLogo} disabled={busy==='logo'} style={{ display:'none' }} />
            </label>
          </div>
        </div>
        <button style={{...btnPri, opacity:busy==='name'?.7:1}} disabled={busy==='name'} onClick={saveName}>{busy==='name'?'Saving…':'Save business details'}</button>
      </div>

      <div data-card style={card}>
        <div style={sectionTitle}>Login email</div>
        <div style={{ marginBottom:'12px' }}>
          <div style={lbl}>Email address</div>
          <input style={inp} type="email" value={email} onChange={e=>setEmail(e.target.value)} />
        </div>
        <button style={{...btnSec, opacity:busy==='email'?.7:1}} disabled={busy==='email'} onClick={saveEmail}>{busy==='email'?'Sending…':'Update email'}</button>
        <div style={{ fontSize:'11.5px', color:'var(--text3)', marginTop:'8px' }}>You'll get a confirmation link at the new address.</div>
      </div>

      <div data-card style={card}>
        <div style={sectionTitle}>Change password</div>
        <input style={{...inp, marginBottom:'10px'}} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password (min 6)" />
        <input style={{...inp, marginBottom:'12px'}} type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Confirm new password" />
        <button style={{...btnPri, opacity:busy==='pw'?.7:1}} disabled={busy==='pw'} onClick={savePw}>{busy==='pw'?'Saving…':'Change password'}</button>
      </div>

      <div data-card style={card}>
        <div style={sectionTitle}>Billing &amp; plan</div>
        <div style={{ fontSize:'13px', color:'var(--text2)', marginBottom:'14px' }}>You're on <strong style={{color:'var(--orange-light)'}}>Gold</strong> · 14-day trial.</div>
        {tiers.map(t => (
          <div key={t.name} style={{ border:'1px solid '+(t.current?'var(--orange)':'var(--border)'), borderRadius:'12px', padding:'14px', marginBottom:'10px', background: t.current?'var(--orange-subtle)':'transparent' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontWeight:700 }}>{t.name} <span style={{ color:'var(--text3)', fontWeight:500, fontSize:'13px' }}>{t.price}</span></div>
              {t.current ? <span style={{ fontSize:'11px', fontWeight:700, color:'var(--orange-light)', border:'1px solid var(--orange)', borderRadius:'20px', padding:'2px 10px' }}>CURRENT</span>
                : <button style={{...btnSec, padding:'6px 12px'}} onClick={()=>flash('Plan changes are coming soon — billing isn\u2019t live yet.')}>Switch</button>}
            </div>
            <div style={{ fontSize:'12px', color:'var(--text3)', marginTop:'6px' }}>{t.feats}</div>
          </div>
        ))}
        <div style={{ fontSize:'11.5px', color:'var(--text3)', marginTop:'4px' }}>Online payments &amp; plan changes are coming soon.</div>
      </div>

      <div style={{ gridColumn:'1/-1' }}>
        <button onClick={signOut} style={btnSec}>Sign out</button>
      </div>
    </div>
  )
}
