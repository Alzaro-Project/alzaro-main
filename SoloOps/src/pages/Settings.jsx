import React from 'react'
import { card, inp, btnPri, btnSec } from '../components/UI.jsx'
import { updateUser, updateAccessName, uploadFile, signedUrl, loadSettings, saveSettings, getMember, getSession } from '../lib/db.js'

const TABS = [
  { key: 'business', label: '🏢 Business' },
  { key: 'vat',      label: '📊 VAT' },
  { key: 'payment',  label: '🏦 Payment' },
  { key: 'billing',  label: '💳 Billing' },
]

export default function Settings({ session, signOut, flash, onBizChange }) {
  const uid = session.user.id

  // Allow deep-linking to a specific tab via URL hash, e.g. /settings#billing
  // (used by the "View plans" upgrade prompt on locked features).
  const initialTab = (() => {
    try {
      const h = (window.location.hash || '').replace('#', '')
      return TABS.some(t => t.key === h) ? h : 'business'
    } catch (e) { return 'business' }
  })()
  const [tab, setTab] = React.useState(initialTab)

  // Business
  const [name, setName] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [bizEmail, setBizEmail] = React.useState('')
  const [logoUrl, setLogoUrl] = React.useState('')

  // VAT
  const [vatRegistered, setVatRegistered] = React.useState(false)
  const [vatNo, setVatNo] = React.useState('')
  const [vatScheme, setVatScheme] = React.useState('standard')
  const [flatRate, setFlatRate] = React.useState(16.5)

  // Payment / bank (printed on invoices)
  const [bankName, setBankName] = React.useState('')
  const [bankAccountName, setBankAccountName] = React.useState('')
  const [bankSortCode, setBankSortCode] = React.useState('')
  const [bankAccountNumber, setBankAccountNumber] = React.useState('')
  const [paymentTerms, setPaymentTerms] = React.useState('')

  // Login email / password
  const [loginEmail, setLoginEmail] = React.useState(session.user.email || '')
  const [pw, setPw] = React.useState('')
  const [pw2, setPw2] = React.useState('')

  const [busy, setBusy] = React.useState('')
  const [msg, setMsg] = React.useState('')
  const [err, setErr] = React.useState('')
  const [loaded, setLoaded] = React.useState(false)

  const note = (m) => { setMsg(m); setErr(''); setTimeout(()=>setMsg(''), 3500) }
  const fail = (m) => { setErr(m); setMsg('') }

  // Load existing settings (falls back to user_metadata for first-run migration)
  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const s = await loadSettings(uid)
        const md = session.user.user_metadata || {}
        if (!alive) return
        setName((s?.business_name ?? md.business_name) || '')
        setAddress((s?.address ?? md.company_address) || '')
        setPhone((s?.phone ?? md.phone) || '')
        setBizEmail((s?.email ?? md.business_email) || '')
        setLogoUrl((s?.logo_url ?? md.logo_url) || '')
        setVatRegistered(s?.vat_registered ?? !!md.vat_number)
        setVatNo((s?.vat_number ?? md.vat_number) || '')
        setVatScheme(s?.vat_scheme || 'standard')
        setFlatRate(s?.flat_rate ?? 16.5)
        setBankName(s?.bank_name || '')
        setBankAccountName(s?.bank_account_name || '')
        setBankSortCode(s?.bank_sort_code || '')
        setBankAccountNumber(s?.bank_account_number || '')
        setPaymentTerms(s?.payment_terms || '')
      } catch (e) {
        // first run, no row yet — defaults stand
      } finally {
        if (alive) setLoaded(true)
      }
    })()
    return () => { alive = false }
  }, [uid])

  // ---- subscription / billing ----
  // The product_members row id is the webhook's PATCH key; its tier is the
  // source of truth for the current plan.
  const [memberId, setMemberId] = React.useState(null)
  const [currentTier, setCurrentTier] = React.useState('basic')
  const [changingTier, setChangingTier] = React.useState(null)
  const [portalLoading, setPortalLoading] = React.useState(false)

  React.useEffect(() => {
    let alive = true
    getMember(uid)
      .then(({ data: m }) => {
        if (!alive || !m) return
        if (m.id) setMemberId(m.id)
        const t = (m.tier || 'basic').toLowerCase()
        setCurrentTier(['basic', 'bronze', 'silver', 'gold'].includes(t) ? t : 'basic')
      })
      .catch(() => {})
    return () => { alive = false }
  }, [uid])

  // Tidy the ?billing= param after returning from Stripe Checkout.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('billing')) {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const authHeaders = async () => {
    const sess = await getSession()
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sess?.access_token || ''}`,
    }
  }

  // Start a real Stripe Checkout for the chosen tier, then redirect to it.
  const startCheckout = async (tierKey) => {
    if (!memberId || !session.user?.email) {
      flash('Your account is still loading — please try again in a moment.')
      return
    }
    setChangingTier(tierKey)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          email: session.user.email,
          garageId: memberId,
          product: 'soloops',
          tier: tierKey,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (e) {
      flash(e.message || 'Could not start checkout')
      setChangingTier(null)
    }
  }

  // Open the Stripe Billing Portal to update payment details or cancel.
  const openPortal = async () => {
    if (!memberId) {
      flash('Your account is still loading — please try again in a moment.')
      return
    }
    setPortalLoading(true)
    try {
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ garageId: memberId, product: 'soloops' }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not open billing portal')
      window.location.href = data.url
    } catch (e) {
      flash(e.message || 'Could not open billing portal')
      setPortalLoading(false)
    }
  }

  // ---- saves ----
  const persist = async (extra, tag) => {
    setBusy(tag); setErr('')
    const record = {
      user_id: uid,
      business_name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: bizEmail.trim(),
      logo_url: logoUrl,
      vat_registered: vatRegistered,
      vat_number: vatNo.trim(),
      vat_scheme: vatScheme,
      flat_rate: Number(flatRate) || 0,
      bank_name: bankName.trim(),
      bank_account_name: bankAccountName.trim(),
      bank_sort_code: bankSortCode.trim(),
      bank_account_number: bankAccountNumber.trim(),
      payment_terms: paymentTerms.trim(),
      updated_at: new Date().toISOString(),
      ...extra,
    }
    try {
      const { error } = await saveSettings(record)
      if (error) throw error
      // update sidebar FIRST — must not be blocked if a later mirror-write fails
      if (tag === 'business') onBizChange?.(name.trim())
      // keep business_name mirrored to soloops_access + auth metadata (drives welcome/login)
      if (tag === 'business') {
        try { await updateAccessName(uid, name.trim()) } catch (_) {}
        try { await updateUser({ data: { business_name: name.trim() } }) } catch (_) {}
      }
      note('Saved')
    } catch (e) {
      fail((e.message || 'Could not save') + ' — if this mentions soloops_settings, re-run the settings SQL in Supabase.')
    }
    setBusy('')
  }

  const uploadLogo = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy('logo'); setErr('')
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${uid}/logo-${safe}`
      const { error: upErr } = await uploadFile(path, f, { upsert:true })
      if (upErr) throw upErr
      const { data } = await signedUrl(path, 60*60*24*365)
      const url = data?.signedUrl || ''
      setLogoUrl(url)
      await saveSettings({ user_id: uid, logo_url: url, updated_at: new Date().toISOString() })
      await updateUser({ data: { logo_url: url } })
      note('Logo uploaded')
    } catch (e) { fail(e.message || 'Could not upload logo') }
    setBusy('')
  }

  const saveLoginEmail = async () => {
    if (!loginEmail.trim()) return fail('Enter an email')
    setBusy('loginEmail'); setErr('')
    try {
      const { error } = await updateUser({ email: loginEmail.trim() })
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

  // Standardised four-tier plan, consistent with the other verticals. Prices
  // match the shared Stripe prices (api/_billing-config.js); the tier key is
  // sent straight to checkout.
  const tiers = [
    { key:'basic',  name:'⚪ Basic',  price:'£5.99/mo', color:'#6b7280', features:['Dashboard', 'Income & invoicing', 'Client database'] },
    { key:'bronze', name:'🥉 Bronze', price:'£12.99/mo', color:'#cd7f32', features:['Everything in Basic', 'Expenses', 'Recurring-expense detection', 'Receipts'] },
    { key:'silver', name:'🥈 Silver', price:'£18.99/mo', color:'#c0c0c0', features:['Everything in Bronze', 'Bank import', 'Mileage', 'Reports'] },
    { key:'gold',   name:'🥇 Gold',   price:'£28.99/mo', color:'var(--orange)', features:['Everything in Silver', 'Document store', 'Tax tools', 'Accountant export pack'] },
  ]

  const sectionTitle = { fontWeight:700, fontSize:'15px', marginBottom:'14px' }
  const lbl = { fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }
  const field = { marginBottom:'12px' }

  if (!loaded) {
    return <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)' }}>Loading settings…</div>
  }

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'18px', flexWrap:'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:'9px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:600, cursor:'pointer',
            border:'1px solid '+(tab===t.key?'var(--orange)':'var(--border)'),
            background: tab===t.key?'var(--orange-subtle)':'transparent',
            color: tab===t.key?'var(--orange-light)':'var(--text2)',
          }}>{t.label}</button>
        ))}
      </div>

      {msg && <div style={{ marginBottom:'14px', background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,.25)', borderRadius:'10px', padding:'12px 16px', fontSize:'13.5px', color:'var(--green)' }}>✓ {msg}</div>}
      {err && <div style={{ marginBottom:'14px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--red)' }}>{err}</div>}

      {/* BUSINESS TAB */}
      {tab === 'business' && (
        <div data-card style={card}>
          <div style={sectionTitle}>Business profile</div>
          <div style={{ fontSize:'11.5px', color:'var(--text3)', marginBottom:'14px' }}>Shown on your invoices.</div>
          <div style={field}>
            <div style={lbl}>Business name</div>
            <input style={inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Your business name" />
          </div>
          <div style={field}>
            <div style={lbl}>Company address</div>
            <textarea style={{...inp, minHeight:'70px', resize:'vertical', fontFamily:'inherit'}} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Street, city, postcode" />
          </div>
          <div style={field}>
            <div style={lbl}>Phone</div>
            <input style={inp} value={phone} onChange={e=>setPhone(e.target.value)} placeholder="07123 456789" />
          </div>
          <div style={field}>
            <div style={lbl}>Contact email</div>
            <input style={inp} value={bizEmail} onChange={e=>setBizEmail(e.target.value)} placeholder="hello@yourbusiness.co.uk" />
          </div>
          <div style={field}>
            <div style={lbl}>Logo</div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              {logoUrl && <img src={logoUrl} alt="logo" style={{ height:'42px', width:'42px', objectFit:'contain', borderRadius:'8px', background:'var(--surface3)', padding:'4px' }} />}
              <label style={{...btnSec, cursor:'pointer', opacity:busy==='logo'?.7:1}}>
                {busy==='logo' ? 'Uploading…' : (logoUrl ? 'Replace logo' : 'Upload logo')}
                <input type="file" accept="image/*" onChange={uploadLogo} disabled={busy==='logo'} style={{ display:'none' }} />
              </label>
            </div>
          </div>
          <button style={{...btnPri, opacity:busy==='business'?.7:1}} disabled={busy==='business'} onClick={()=>persist({}, 'business')}>{busy==='business'?'Saving…':'Save business details'}</button>
        </div>
      )}

      {/* VAT TAB */}
      {tab === 'vat' && (
        <div data-card style={card}>
          <div style={sectionTitle}>VAT</div>
          <div style={{ fontSize:'11.5px', color:'var(--text3)', marginBottom:'14px' }}>Most sole traders aren’t VAT-registered until turnover passes £90k. Turn this on only if you are.</div>
          <label style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', cursor:'pointer' }}>
            <input type="checkbox" checked={vatRegistered} onChange={e=>setVatRegistered(e.target.checked)} />
            <span style={{ fontSize:'13.5px' }}>I’m VAT-registered</span>
          </label>
          {vatRegistered && (
            <>
              <div style={field}>
                <div style={lbl}>VAT number</div>
                <input style={inp} value={vatNo} onChange={e=>setVatNo(e.target.value)} placeholder="GB123456789" />
              </div>
              <div style={field}>
                <div style={lbl}>VAT scheme</div>
                <select style={inp} value={vatScheme} onChange={e=>setVatScheme(e.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="flat_rate">Flat Rate Scheme</option>
                </select>
              </div>
              {vatScheme === 'flat_rate' && (
                <div style={field}>
                  <div style={lbl}>Flat rate %</div>
                  <input style={inp} type="number" step="0.1" value={flatRate} onChange={e=>setFlatRate(e.target.value)} placeholder="16.5" />
                </div>
              )}
            </>
          )}
          <button style={{...btnPri, opacity:busy==='vat'?.7:1}} disabled={busy==='vat'} onClick={()=>persist({}, 'vat')}>{busy==='vat'?'Saving…':'Save VAT settings'}</button>
        </div>
      )}

      {/* PAYMENT TAB */}
      {tab === 'payment' && (
        <div data-card style={card}>
          <div style={sectionTitle}>Payment details</div>
          <div style={{ fontSize:'11.5px', color:'var(--text3)', marginBottom:'14px' }}>Shown in the “how to pay” section of your invoices. Until online payments go live, customers pay by bank transfer using these details.</div>
          <div style={field}>
            <div style={lbl}>Account name</div>
            <input style={inp} value={bankAccountName} onChange={e=>setBankAccountName(e.target.value)} placeholder="Name on the account" />
          </div>
          <div style={field}>
            <div style={lbl}>Bank name</div>
            <input style={inp} value={bankName} onChange={e=>setBankName(e.target.value)} placeholder="e.g. Barclays" />
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <div style={{...field, flex:1}}>
              <div style={lbl}>Sort code</div>
              <input style={inp} value={bankSortCode} onChange={e=>setBankSortCode(e.target.value)} placeholder="00-00-00" />
            </div>
            <div style={{...field, flex:1}}>
              <div style={lbl}>Account number</div>
              <input style={inp} value={bankAccountNumber} onChange={e=>setBankAccountNumber(e.target.value)} placeholder="12345678" />
            </div>
          </div>
          <div style={field}>
            <div style={lbl}>Payment terms (optional)</div>
            <input style={inp} value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} placeholder="e.g. Payment due within 14 days" />
          </div>
          <button style={{...btnPri, opacity:busy==='payment'?.7:1}} disabled={busy==='payment'} onClick={()=>persist({}, 'payment')}>{busy==='payment'?'Saving…':'Save payment details'}</button>
        </div>
      )}

      {/* BILLING TAB */}
      {tab === 'billing' && (
        <>
          <div data-card style={card}>
            <div style={sectionTitle}>Billing &amp; plan</div>
            <div style={{ fontSize:'13px', color:'var(--text2)', marginBottom:'16px' }}>You're on <strong style={{color:'var(--orange-light)'}}>{(tiers.find(x=>x.key===currentTier)||tiers[0]).name.replace(/^\S+\s/, '')}</strong>.</div>

            {/* Mobile-friendly horizontal scroll */}
            <div style={{ display:'flex', gap:'12px', overflowX:'auto', paddingBottom:'8px', paddingTop:'10px', WebkitOverflowScrolling:'touch', scrollSnapType:'x mandatory' }}>
              {tiers.map((t) => {
                const isCurrent = t.key === currentTier
                const currentIdx = tiers.findIndex(x => x.key === currentTier)
                const thisIdx = tiers.findIndex(x => x.key === t.key)
                return (
                  <div key={t.key} style={{
                    background: isCurrent ? 'var(--surface2)' : 'var(--surface)',
                    border: `2px solid ${isCurrent ? t.color : 'var(--border)'}`,
                    borderRadius:'12px', padding:'20px', position:'relative', transition:'all .15s',
                    minWidth:'220px', flex:'1 0 220px', scrollSnapAlign:'start',
                  }}>
                    {isCurrent && (
                      <div style={{ position:'absolute', top:'-10px', right:'12px', background:t.color, color: t.key==='silver'||t.key==='basic' ? '#000':'#fff', fontSize:'10px', fontWeight:700, padding:'4px 10px', borderRadius:'20px' }}>CURRENT</div>
                    )}

                    <div style={{ fontWeight:800, fontSize:'18px', color:t.color, marginBottom:'4px' }}>{t.name}</div>
                    <div style={{ fontSize:'24px', fontWeight:700, color:'var(--text)', marginBottom:'16px' }}>{t.price}</div>

                    <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
                      {t.features.map(feat => (
                        <div key={feat} style={{ fontSize:'12px', color:'var(--text2)', display:'flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ color:t.color, flexShrink:0 }}>✓</span>{feat}
                        </div>
                      ))}
                    </div>

                    {!isCurrent && (
                      <button
                        style={{ ...(thisIdx > currentIdx ? btnPri : btnSec), width:'100%', opacity:changingTier?0.7:1 }}
                        disabled={!!changingTier}
                        onClick={()=>startCheckout(t.key)}>
                        {changingTier===t.key ? 'Starting…' : (thisIdx > currentIdx ? 'Upgrade' : 'Downgrade')}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize:'11px', color:'var(--text3)', marginTop:'12px', textAlign:'center' }}>← Swipe to see all plans →</div>

            <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', marginTop:'16px' }}>
              <button style={{...btnSec, opacity:portalLoading?0.7:1}} disabled={portalLoading} onClick={openPortal}>{portalLoading ? 'Opening…' : 'Manage subscription'}</button>
              <span style={{ fontSize:'11.5px', color:'var(--text3)' }}>Update payment details or cancel anytime via the secure billing portal.</span>
            </div>
          </div>

          <div data-card style={{...card, marginTop:'16px'}}>
            <div style={sectionTitle}>Login email</div>
            <div style={field}>
              <div style={lbl}>Email address</div>
              <input style={inp} type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} />
            </div>
            <button style={{...btnSec, opacity:busy==='loginEmail'?.7:1}} disabled={busy==='loginEmail'} onClick={saveLoginEmail}>{busy==='loginEmail'?'Sending…':'Update email'}</button>
            <div style={{ fontSize:'11.5px', color:'var(--text3)', marginTop:'8px' }}>You'll get a confirmation link at the new address.</div>
          </div>

          <div data-card style={{...card, marginTop:'16px'}}>
            <div style={sectionTitle}>Change password</div>
            <input style={{...inp, marginBottom:'10px'}} type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="New password (min 6)" />
            <input style={{...inp, marginBottom:'12px'}} type="password" value={pw2} onChange={e=>setPw2(e.target.value)} placeholder="Confirm new password" />
            <button style={{...btnPri, opacity:busy==='pw'?.7:1}} disabled={busy==='pw'} onClick={savePw}>{busy==='pw'?'Saving…':'Change password'}</button>
          </div>

          <div style={{ marginTop:'16px' }}>
            <button onClick={signOut} style={btnSec}>Sign out</button>
          </div>
        </>
      )}
    </div>
  )
}
