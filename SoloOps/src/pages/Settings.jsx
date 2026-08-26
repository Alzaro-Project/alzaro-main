import React from 'react'
import { card, inp, noScroll, btnPri, btnSec, isEmailish } from '../components/UI.jsx'
import { updateUser, updateAccessName, uploadFile, signedUrl, loadSettings, saveSettings, getMember, getSession, listStaff, updateStaffPermissions, removeStaff, resetPasswordForEmail, getAccountantLink, updateAccountantPermissions, revokeAccountant, getSmtpSecret } from '../lib/db.js'

const TABS = [
  { key: 'business', label: '🏢 Business' },
  { key: 'vat',      label: '📊 VAT' },
  { key: 'payment',  label: '🏦 Payment' },
  { key: 'email',    label: '📧 Email' },
  { key: 'billing',  label: '💳 Billing' },
  { key: 'users',    label: '👥 Users' },
  { key: 'accountant', label: '🧾 Accountant' },
]

// Host/port/security per provider — picking one fills the fields below.
const SMTP_PRESETS = {
  custom:    { host: '',                      port: 587, secure: false },
  gmail:     { host: 'smtp.gmail.com',        port: 587, secure: false },
  outlook:   { host: 'smtp-mail.outlook.com', port: 587, secure: false },
  office365: { host: 'smtp.office365.com',    port: 587, secure: false },
  zoho:      { host: 'smtp.zoho.eu',          port: 587, secure: false },
  ionos:     { host: 'smtp.ionos.co.uk',      port: 587, secure: false },
  resend:    { host: 'smtp.resend.com',       port: 587, secure: false },
  sendgrid:  { host: 'smtp.sendgrid.net',     port: 587, secure: false },
}

// Per-provider guidance for the Password field. Gmail/Outlook reject normal
// login passwords over SMTP — users must generate an "app password". This is
// the single most common setup mistake, so we spell it out with a link.
const PASS_HELP = {
  gmail:     { text: 'Gmail needs an App Password, not your normal password. Turn on 2-Step Verification first, then create one here:', url: 'https://myaccount.google.com/apppasswords', label: 'Google App Passwords' },
  outlook:   { text: 'Outlook/Hotmail needs an App Password (with 2-step verification on), not your normal password. Create one here:', url: 'https://account.live.com/proofs/AppPassword', label: 'Microsoft App Passwords' },
  office365: { text: 'Microsoft 365 needs an App Password (with 2-step verification on), not your normal password. Create one here:', url: 'https://account.microsoft.com/security', label: 'Microsoft Security' },
  zoho:      { text: 'Zoho Mail needs an App-Specific Password, not your normal password. Create one here:', url: 'https://accounts.zoho.eu/home#security/app_password', label: 'Zoho App Passwords' },
  resend:    { text: 'Use your Resend API key as the password. Create one in your Resend dashboard:', url: 'https://resend.com/api-keys', label: 'Resend API Keys' },
  sendgrid:  { text: "Use an API key as the password (username is literally 'apikey'). Create one here:", url: 'https://app.sendgrid.com/settings/api_keys', label: 'SendGrid API Keys' },
  ionos:     { text: "Use your normal IONOS mailbox password here. If it's rejected, check the mailbox is enabled for SMTP in your IONOS webmail settings.", url: '', label: '' },
  custom:    { text: 'For Gmail, Outlook and most providers, this is an "app password", not your normal login password. Pick your provider above for a direct link.', url: '', label: '' },
}

export default function Settings({ session, member, signOut, flash, onBizChange }) {
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
  // Keep the hash in step with the tab, so a refresh (or a shared link)
  // reopens the same tab instead of dumping back to Business. replaceState
  // avoids polluting Back-button history with every tab click.
  React.useEffect(() => {
    try { window.history.replaceState(null, '', '#' + tab) } catch (e) {}
  }, [tab])

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

  // Email / SMTP — invoices go out FROM the trader's own address, so these
  // credentials are theirs, not Alzaro's. `smtpPass` is WRITE-ONLY: it is never
  // loaded back from the database (see SETTINGS_COLS in db.js), so a blank field
  // on an already-configured account means "keep the saved password".
  const [smtpProvider, setSmtpProvider] = React.useState('custom')
  const [smtpHost, setSmtpHost] = React.useState('')
  const [smtpPort, setSmtpPort] = React.useState(587)
  const [smtpSecure, setSmtpSecure] = React.useState(false)
  const [smtpUser, setSmtpUser] = React.useState('')
  const [smtpPass, setSmtpPass] = React.useState('')
  const [smtpFromName, setSmtpFromName] = React.useState('')
  const [smtpFromEmail, setSmtpFromEmail] = React.useState('')
  const [smtpReplyTo, setSmtpReplyTo] = React.useState('')
  const [emailFooter, setEmailFooter] = React.useState('')
  // True when a password is already stored (host+user present on load) — drives
  // the "leave blank to keep current" hint, since we can't read the value back.
  const [smtpSaved, setSmtpSaved] = React.useState(false)
  const [smtpTest, setSmtpTest] = React.useState(null)   // null | testing | success | error
  const [smtpTestMsg, setSmtpTestMsg] = React.useState('')

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
        // SMTP — note smtp_pass is intentionally absent from the payload.
        setSmtpProvider(s?.smtp_provider || 'custom')
        setSmtpHost(s?.smtp_host || '')
        setSmtpPort(s?.smtp_port ?? 587)
        setSmtpSecure(!!s?.smtp_secure)
        setSmtpUser(s?.smtp_user || '')
        setSmtpFromName(s?.smtp_from_name || '')
        setSmtpFromEmail(s?.smtp_from_email || '')
        setSmtpReplyTo(s?.smtp_reply_to || '')
        setEmailFooter(s?.email_footer || '')
        // Host + user present ⇒ the server has a password stored for this row.
        setSmtpSaved(!!(s?.smtp_host && s?.smtp_user))
        // Load the stored SMTP password into the form so it is VISIBLE in
        // Settings (owner's choice — PropertyOps pattern, replaces the earlier
        // write-only design). The decrypt RPC returns ONLY the calling user's
        // own password, it stays encrypted at rest, and the field is masked by
        // default with the eye icon to reveal.
        try {
          const secret = await getSmtpSecret()
          if (alive && secret) { setSmtpPass(p => p || secret); setSmtpSaved(true) }
        } catch (e) { /* RPC missing — field stays blank, save still works */ }
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
      // SMTP config travels with every save because this is a whole-row upsert —
      // omitting these would null out a configured mail setup when the user saves
      // an unrelated tab. `smtp_pass` is deliberately NOT here: it's only added
      // by saveEmail() below when the user actually types a new one, so the
      // BEFORE-write trigger's "null/'' means keep current ciphertext" rule
      // preserves the stored password on every other save.
      smtp_provider: smtpProvider,
      smtp_host: smtpHost.trim(),
      smtp_port: Number(smtpPort) || 587,
      smtp_secure: !!smtpSecure,
      smtp_user: smtpUser.trim(),
      smtp_from_name: smtpFromName.trim(),
      smtp_from_email: smtpFromEmail.trim(),
      smtp_reply_to: smtpReplyTo.trim(),
      email_footer: emailFooter,
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

  // Picking a provider preset fills host/port/security.
  const pickProvider = (p) => {
    const preset = SMTP_PRESETS[p]
    setSmtpProvider(p)
    if (preset && p !== 'custom') {
      setSmtpHost(preset.host); setSmtpPort(preset.port); setSmtpSecure(preset.secure)
    }
    setSmtpTest(null); setSmtpTestMsg('')
  }

  // Gmail shows App Passwords as "xxxx xxxx xxxx xxxx" and users paste them with
  // the spaces; Gmail then rejects the login. Strip them on the way out (the
  // server does this too, defensively, for rows saved by older builds).
  const cleanPass = () =>
    smtpProvider === 'gmail' ? smtpPass.replace(/\s+/g, '') : smtpPass.trim()

  const saveEmail = async () => {
    if (!smtpHost.trim() || !smtpUser.trim()) {
      return fail('Enter at least the SMTP host and username.')
    }
    if (!smtpSaved && !smtpPass) {
      return fail('Enter your email password to finish setting up sending.')
    }
    if (smtpFromEmail.trim() && !isEmailish(smtpFromEmail)) {
      return fail('The "from" address looks invalid.')
    }
    if (smtpReplyTo.trim() && !isEmailish(smtpReplyTo)) {
      return fail('The reply-to address looks invalid.')
    }
    // Only send smtp_pass when the field has one. Blank ⇒ omit the key
    // entirely ⇒ the DB trigger keeps the existing encrypted password.
    const extra = smtpPass ? { smtp_pass: cleanPass() } : {}
    await persist(extra, 'email')
    // Keep the password in the field (masked; eye to reveal) instead of wiping
    // it — the owner asked to see and edit what's saved. Then VERIFY the write
    // actually landed: read the password back through the decrypt RPC and
    // compare. A silent save-that-didn't-save is exactly the failure mode this
    // guards against.
    if (smtpPass) {
      const stored = await getSmtpSecret()
      if (stored === cleanPass()) {
        setSmtpPass(cleanPass())
        setSmtpSaved(true)
        note('Email settings saved — password verified ✓')
      } else if (stored) {
        fail('Saved, but the stored password does not match what you typed — try saving again.')
      } else {
        fail('Settings saved, but the password could not be verified as stored — the email encryption SQL may not be active on this database.')
      }
    } else {
      setSmtpSaved(true)
    }
  }

  // Tests the details as typed, against the real mail server, BEFORE saving.
  const testSmtp = async () => {
    if (!smtpHost.trim() || !smtpUser.trim() || !smtpPass) {
      setSmtpTest('error')
      setSmtpTestMsg('Enter the host, username and password to run a test.')
      return
    }
    setSmtpTest('testing'); setSmtpTestMsg('')
    try {
      const res = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: Number(smtpPort) || 587,
          secure: !!smtpSecure,
          user: smtpUser.trim(),
          pass: cleanPass(),
          fromName: smtpFromName.trim() || name.trim() || '',
        }),
      })
      let data = {}
      try { data = await res.json() } catch (e) { /* non-JSON */ }
      if (!res.ok) throw new Error(data.error || `Server responded with status ${res.status}`)
      setSmtpTest('success'); setSmtpTestMsg('')
      setTimeout(() => setSmtpTest(null), 8000)
    } catch (e) {
      setSmtpTest('error')
      setSmtpTestMsg(
        e.message === 'Failed to fetch'
          ? 'Could not reach /api/test-smtp — the function may not be deployed yet.'
          : e.message
      )
    }
  }

  // Standardised four-tier plan, consistent with the other verticals. Prices
  // match the shared Stripe prices (api/_billing-config.js); the tier key is
  // sent straight to checkout.
  const tiers = [
    { key:'basic',  name:'⚪ Basic',  price:'£5.99/mo', color:'#6b7280', features:['Dashboard', 'Income & invoicing', 'Items & client database'] },
    { key:'bronze', name:'🥉 Bronze', price:'£12.99/mo', color:'#cd7f32', features:['Everything in Basic', 'Expenses', 'Receipts'] },
    { key:'silver', name:'🥈 Silver', price:'£18.99/mo', color:'#c0c0c0', features:['Everything in Bronze', 'Reports & CSV exports'] },
    { key:'gold',   name:'🥇 Gold',   price:'£28.99/mo', color:'var(--orange)', features:['Everything in Silver', 'Tax estimate (inside Reports)', 'Accountant export pack'] },
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
                  <input style={inp} type="number" {...noScroll} step="0.1" value={flatRate} onChange={e=>setFlatRate(e.target.value)} placeholder="16.5" />
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

      {tab==='email' && (
        <div style={{ ...card, display:'flex', flexDirection:'column', gap:'14px' }}>
          <div>
            <div style={{ fontSize:'15px', fontWeight:800, marginBottom:'4px' }}>Send invoices from your own email</div>
            <div style={{ fontSize:'13px', color:'var(--text3)', lineHeight:1.5 }}>
              Invoices go out from your address, not ours — so replies come straight back to you
              and your clients see your name in their inbox. Your password is stored encrypted;
              only you can view it here, using the eye icon.
            </div>
          </div>

          <div style={field}>
            <div style={lbl}>Email provider</div>
            <select style={inp} value={smtpProvider} onChange={e=>pickProvider(e.target.value)}>
              <option value="custom">Other / custom</option>
              <option value="gmail">Gmail</option>
              <option value="outlook">Outlook / Hotmail</option>
              <option value="office365">Microsoft 365</option>
              <option value="zoho">Zoho Mail</option>
              <option value="ionos">IONOS</option>
              <option value="resend">Resend</option>
              <option value="sendgrid">SendGrid</option>
            </select>
          </div>

          <div style={{ display:'flex', gap:'10px' }}>
            <div style={{...field, flex:2}}>
              <div style={lbl}>SMTP host</div>
              <input style={inp} value={smtpHost} onChange={e=>setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div style={{...field, flex:1}}>
              <div style={lbl}>Port</div>
              <input style={inp} value={smtpPort} onChange={e=>setSmtpPort(e.target.value)} placeholder="587" />
            </div>
          </div>

          <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'var(--text2)', cursor:'pointer' }}>
            <input type="checkbox" checked={smtpSecure} onChange={e=>setSmtpSecure(e.target.checked)} />
            Use SSL (tick for port 465 — leave off for 587)
          </label>

          <div style={field}>
            <div style={lbl}>Username</div>
            <input style={inp} value={smtpUser} onChange={e=>setSmtpUser(e.target.value)} placeholder="you@yourbusiness.co.uk" />
          </div>

          <div style={field}>
            <div style={lbl}>Password {smtpSaved && !smtpPass && <span style={{ fontWeight:500, color:'var(--text3)' }}>— leave blank to keep the saved one</span>}</div>
            <PasswordInput width="100%" value={smtpPass} onChange={v=>{setSmtpPass(v); setSmtpTest(null)}} placeholder={smtpSaved ? '••••••••  (saved)' : 'App password'} />
            {PASS_HELP[smtpProvider] && (
              <div style={{ fontSize:'12px', color:'var(--text3)', marginTop:'6px', lineHeight:1.5 }}>
                {PASS_HELP[smtpProvider].text}
                {PASS_HELP[smtpProvider].url && (
                  <> <a href={PASS_HELP[smtpProvider].url} target="_blank" rel="noopener noreferrer" style={{ color:'var(--orange)', fontWeight:700 }}>{PASS_HELP[smtpProvider].label} ↗</a></>
                )}
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:'10px' }}>
            <div style={{...field, flex:1}}>
              <div style={lbl}>From name</div>
              <input style={inp} value={smtpFromName} onChange={e=>setSmtpFromName(e.target.value)} placeholder={name || 'Your business name'} />
            </div>
            <div style={{...field, flex:1}}>
              <div style={lbl}>From address</div>
              <input style={inp} value={smtpFromEmail} onChange={e=>setSmtpFromEmail(e.target.value)} placeholder="Defaults to your username" />
            </div>
          </div>

          <div style={field}>
            <div style={lbl}>Reply-to (optional)</div>
            <input style={inp} value={smtpReplyTo} onChange={e=>setSmtpReplyTo(e.target.value)} placeholder="Where client replies should go" />
          </div>

          <div style={field}>
            <div style={lbl}>Email footer (optional)</div>
            <textarea style={{...inp, minHeight:'70px', resize:'vertical', fontFamily:'inherit'}} value={emailFooter} onChange={e=>setEmailFooter(e.target.value)} placeholder="e.g. Payment due within 14 days. Bank details on the invoice." />
          </div>

          {smtpTest==='success' && (
            <div style={{ background:'rgba(34,197,94,.1)', border:'1px solid rgba(34,197,94,.3)', color:'#22c55e', borderRadius:'10px', padding:'11px 14px', fontSize:'13px', fontWeight:600 }}>
              ✓ Connected and sent a test email to {smtpUser} — check your inbox.
            </div>
          )}
          {smtpTest==='error' && (
            <div style={{ background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)', color:'#f87171', borderRadius:'10px', padding:'11px 14px', fontSize:'13px', lineHeight:1.5 }}>
              {smtpTestMsg}
            </div>
          )}

          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            <button style={{...btnPri, opacity:busy==='email'?.7:1}} disabled={busy==='email'} onClick={saveEmail}>
              {busy==='email' ? 'Saving…' : 'Save email settings'}
            </button>
            <button style={{...btnSec, opacity:smtpTest==='testing'?.7:1}} disabled={smtpTest==='testing'} onClick={testSmtp}>
              {smtpTest==='testing' ? 'Testing…' : 'Send test email'}
            </button>
          </div>
        </div>
      )}

      {/* BILLING TAB */}
      {tab === 'users' && <UsersTab tier={member?.tier} memberStatus={member?.status} flash={flash} />}

      {tab === 'accountant' && <AccountantTab memberStatus={member?.status} flash={flash} />}

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

// ---------------------------------------------------------------------------
// Users tab — Gold multi-user. The owner adds staff by email and picks which
// sections each can use. The real enforcement is RLS (see
// migrations/008_soloops_staff.sql); this tab is the control panel.
// ---------------------------------------------------------------------------
const STAFF_PERMS = [
  ['dashboard', 'Dashboard',    'Totals and charts (sees income & expense figures)'],
  ['income',    'Income',       'Create, edit and send invoices'],
  ['items',     'Items/Clients','Manage the item and client lists'],
  ['expenses',  'Expenses',     'Record and edit expenses, and attach receipts'],
  ['reports',   'Reports/Tax',  'Read-only reports over income and expenses'],
]

// Eye / eye-off. Inline SVG so there's no dependency on an icon font being
// loaded on this page.
function EyeIcon({ off }) {
  return off ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

// Password input with a show/hide toggle inside the field.
function PasswordInput({ value, onChange, onEnter, placeholder, width = '240px' }) {
  const [show, setShow] = React.useState(false)
  return (
    <div style={{ position: 'relative', width, maxWidth: '100%' }}>
      <input
        style={{ ...inp, width: '100%', paddingRight: '40px' }}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter() }}
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={() => setShow(v => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--text3)', display: 'flex', alignItems: 'center' }}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  )
}

function UsersTab({ tier, memberStatus, flash }) {
  const [rows, setRows] = React.useState(null)      // null = loading
  const [email, setEmail] = React.useState('')
  const [perms, setPerms] = React.useState({ income: true })
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  // Keep in step with STAFF_SEATS in api/staff.js (the real limit) and the
  // tier list in migrations/011_staff_silver.sql (the RLS gate).
  const TIER_SEATS = { silver: 2, gold: 4 }
  const SEATS = TIER_SEATS[tier] || 0
  const eligible = SEATS > 0 && ['trial', 'active'].includes(memberStatus || '')
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : ''
  const seatsLeft = rows === null ? 0 : Math.max(0, SEATS - rows.length)

  const reload = React.useCallback(async () => {
    const { data, error } = await listStaff()
    setRows(error ? [] : (data || []))
  }, [])
  React.useEffect(() => { reload() }, [reload])

  const add = async () => {
    setErr('')
    if (!email.trim()) { setErr('Enter their email address.'); return }
    setBusy(true)
    try {
      const session = await getSession()
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ email: email.trim(), permissions: perms }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not add the user'); return }
      flash(j.invited
        ? 'Access given — invite email sent so they can set a password'
        : 'Access given — they can sign in with their existing Alzaro login')
      setEmail(''); setPerms({ income: true })
      await reload()
    } catch (e) {
      setErr('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  if (!eligible) {
    return (
      <div style={{ ...card, maxWidth: '560px' }}>
        <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '8px' }}>Add your team</div>
        <div style={{ color: 'var(--text2)', fontSize: '14px', lineHeight: 1.6 }}>
          Silver includes 2 extra users and Gold includes 4: invite staff with their
          own logins and choose exactly which sections they can use — just invoices,
          say, while your reports and settings stay yours. Upgrade on the{' '}
          <a href="#billing" onClick={(e) => { e.preventDefault(); window.location.hash = 'billing'; window.location.reload() }}
             style={{ color: 'var(--orange-light)', fontWeight: 700 }}>Billing tab</a>{' '}
          to unlock it.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: '16px', maxWidth: '720px' }}>
      <div style={card}>
        <div style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px' }}>Users</div>
        <div style={{ color: 'var(--text2)', fontSize: '13.5px', marginBottom: '16px' }}>
          Your {tierLabel} plan includes {SEATS} staff seats ({seatsLeft} left). Staff sign
          in with their own email and password and only see the sections you tick —
          never Settings or Billing.
        </div>

        {rows === null && <div style={{ color: 'var(--text3)', fontSize: '13.5px' }}>Loading…</div>}

        {rows !== null && seatsLeft > 0 && (
          <div style={{ display: 'grid', gap: '12px', paddingBottom: rows.length ? '20px' : 0, marginBottom: rows.length ? '20px' : 0, borderBottom: rows.length ? '1px solid var(--border)' : 'none' }}>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>Their email</div>
              <input style={inp} type="email" placeholder="name@example.com" value={email}
                     onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} />
            </div>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text2)', marginBottom: '6px' }}>What they can use</div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {STAFF_PERMS.map(([k, label, blurb]) => (
                  <label key={k} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13.5px' }}>
                    <input type="checkbox" checked={perms[k] === true}
                           onChange={() => setPerms(p => ({ ...p, [k]: !(p[k] === true) }))}
                           style={{ marginTop: '2px' }} />
                    <span><strong>{label}</strong>
                      <span style={{ color: 'var(--text3)' }}> — {blurb}</span></span>
                  </label>
                ))}
              </div>
            </div>
            {err && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{err}</div>}
            <button style={{ ...btnPri, width: 'fit-content' }} disabled={busy} onClick={add}>
              {busy ? 'Adding…' : 'Add user'}
            </button>
          </div>
        )}

        {rows !== null && rows.map(row => (
          <StaffCard key={row.id} row={row} flash={flash} onChanged={reload} />
        ))}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// My accountant: invite an accountant to a VIEW-ONLY window on the books.
// The client picks which sections are visible; the accountant can never edit
// anything (there are no write policies for accountants in the database).
// Available on every plan.
// -----------------------------------------------------------------------------
const ACCT_PERMS = [
  ['dashboard', 'Dashboard',    'Totals and charts'],
  ['income',    'Income',       'Invoices and payments'],
  ['items',     'Items/Clients','Item and client lists'],
  ['expenses',  'Expenses',     'Expenses, mileage and receipts'],
  ['reports',   'Reports/Tax',  'Reports and the tax estimate'],
]

function AccountantTab({ memberStatus, flash }) {
  const [link, setLink] = React.useState(undefined)   // undefined=loading, null=none
  const [email, setEmail] = React.useState('')
  // Default: everything visible — they were invited to see the books. Every
  // box can be unticked before or after inviting.
  const [perms, setPerms] = React.useState({ dashboard: true, income: true, items: true, expenses: true, reports: true })
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [editing, setEditing] = React.useState(false)   // editing a live link's visibility
  const [draft, setDraft] = React.useState({})          // pending edits, saved on demand
  const eligible = ['trial', 'active'].includes(memberStatus || '')

  const reload = React.useCallback(async () => { setLink(await getAccountantLink()) }, [])
  React.useEffect(() => { reload() }, [reload])

  const invite = async () => {
    setErr('')
    if (!email.trim()) { setErr('Enter their email address.'); return }
    setBusy(true)
    try {
      const session = await getSession()
      const r = await fetch('/api/accountant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ product: 'soloops', email: email.trim(), permissions: perms }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not send the invite'); return }
      flash(j.existing_user
        ? 'Accountant linked — they can sign in to the portal with their existing login'
        : 'Invite sent — they’ll get an email to set up their portal login')
      setEmail('')
      await reload()
    } catch (e) {
      setErr('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  // Pre-invite: toggle the local perms (no link yet).
  const togglePerm = (k) => setPerms(p => ({ ...p, [k]: !p[k] }))

  // Editing a live link: batch changes into a draft, then Save/Cancel.
  const startEdit = () => { setDraft({ ...(link.permissions || {}) }); setEditing(true) }
  const cancelEdit = () => setEditing(false)
  const saveEdit = async () => {
    const { error } = await updateAccountantPermissions(link.id, draft)
    if (error) { flash('Could not save the changes'); return }
    setLink({ ...link, permissions: draft })
    setEditing(false)
    flash('Access updated')
  }

  const revoke = async () => {
    if (!window.confirm(`Remove ${link.accountant_email}’s access? They’ll no longer be able to see any of your books. You can invite them (or someone else) again any time.`)) return
    const { error } = await revokeAccountant(link.id)
    if (error) { flash('Could not remove access'); return }
    flash('Accountant access removed')
    await reload()
  }

  if (link === undefined) return <div style={{ color: 'var(--text3)', fontSize: '13px' }}>Loading…</div>

  return (
    <div>
      <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '6px' }}>My accountant</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text3)', marginBottom: '18px', maxWidth: '640px', lineHeight: 1.55 }}>
        Give your accountant a <b>view-only</b> window on your books. They sign in to a separate
        accountant portal and can look but never change anything. You choose what they see below,
        and you can adjust or remove their access at any time.
      </div>

      {!eligible && (
        <div style={{ fontSize: '13px', color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px', maxWidth: '640px' }}>
          Your subscription needs to be active to link an accountant.
        </div>
      )}

      {eligible && !link && (
        <div style={{ maxWidth: '640px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '6px' }}>Accountant’s email</div>
          <input style={inp} type="email" placeholder="accountant@example.co.uk" value={email} onChange={e => setEmail(e.target.value)} />

          <div style={{ fontSize: '12px', color: 'var(--text3)', margin: '16px 0 8px' }}>What they can see</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {ACCT_PERMS.map(([k, label, blurb]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13.5px' }}>
                <input type="checkbox" checked={perms[k] === true} onChange={() => togglePerm(k)} />
                <span style={{ fontWeight: 600 }}>{label}</span>
                <span style={{ color: 'var(--text3)', fontSize: '12px' }}>{blurb}</span>
              </label>
            ))}
          </div>

          {err && <div style={{ color: 'var(--red, #ef4444)', fontSize: '12.5px', marginBottom: '10px' }}>{err}</div>}
          <button style={btnPri} disabled={busy} onClick={invite}>{busy ? 'Sending…' : 'Invite accountant'}</button>
        </div>
      )}

      {eligible && link && (
        <div style={{ maxWidth: '640px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '14px', wordBreak: 'break-all' }}>{link.accountant_email}</span>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase',
              color: link.status === 'active' ? 'var(--green, #22c55e)' : 'var(--orange-light)',
              background: link.status === 'active' ? 'rgba(34,197,94,.12)' : 'var(--orange-subtle)',
              border: `1px solid ${link.status === 'active' ? 'rgba(34,197,94,.3)' : 'rgba(249,115,22,.35)'}`,
              borderRadius: '20px', padding: '2px 9px' }}>
              {link.status === 'active' ? 'Active' : 'Invited'}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: '20px', padding: '2px 9px' }}>View only</span>
          </div>
          {link.status !== 'active' && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px' }}>
              They’ve been emailed a link to set up their portal login.
            </div>
          )}

          {!editing && (
            <>
              <div style={{ fontSize: '12px', color: 'var(--text3)', margin: '14px 0 8px' }}>What they can see</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {ACCT_PERMS.filter(([k]) => link.permissions?.[k] === true).map(([k, label]) => (
                  <span key={k} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--orange-light)', background: 'var(--orange-subtle)', border: '1px solid rgba(249,115,22,.3)', borderRadius: '999px', padding: '4px 11px' }}>{label}</span>
                ))}
                {ACCT_PERMS.every(([k]) => link.permissions?.[k] !== true) && (
                  <span style={{ fontSize: '12.5px', color: 'var(--text3)' }}>No sections shared — hit “Edit access” to choose some.</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={startEdit} style={btnSec}>Edit access</button>
                <button onClick={revoke} style={{ background: 'transparent', color: 'var(--red, #ef4444)', border: '1px solid rgba(239,68,68,.4)', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Remove access
                </button>
              </div>
            </>
          )}
          {editing && (
            <>
              <div style={{ fontSize: '12px', color: 'var(--text3)', margin: '14px 0 8px' }}>What they can see</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {ACCT_PERMS.map(([k, label, blurb]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13.5px' }}>
                    <input type="checkbox" checked={draft[k] === true} onChange={() => setDraft(d => ({ ...d, [k]: !(d[k] === true) }))} />
                    <span style={{ fontWeight: 600 }}>{label}</span>
                    <span style={{ color: 'var(--text3)', fontSize: '12px' }}>{blurb}</span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={saveEdit} style={btnPri}>Save changes</button>
                <button onClick={cancelEdit} style={btnSec}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// One staff member: permission summary with an Edit mode, plus password tools.
function StaffCard({ row, flash, onChanged }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(row.permissions || {})
  const [saving, setSaving] = React.useState(false)

  const enabled = STAFF_PERMS.filter(([k]) => row.permissions?.[k] === true).map(([, label]) => label)

  const startEdit = () => { setDraft({ ...(row.permissions || {}) }); setEditing(true) }
  const cancelEdit = () => { setEditing(false) }
  const saveEdit = async () => {
    setSaving(true)
    const { error } = await updateStaffPermissions(row.id, draft)
    setSaving(false)
    if (error) { flash('Could not save — try again'); return }
    setEditing(false)
    flash('Access updated')
    onChanged()
  }

  const remove = async () => {
    if (!window.confirm(`Remove ${row.staff_email}? They lose access immediately.`)) return
    const { error } = await removeStaff(row.id)
    if (error) { flash('Could not remove — try again'); return }
    flash('Removed')
    onChanged()
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '14.5px', overflowWrap: 'anywhere' }}>{row.staff_email}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
            {row.status === 'invited' ? "Invited — hasn't set a password yet" : 'Active'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {!editing && <button style={btnSec} onClick={startEdit}>Edit</button>}
          <button style={{ ...btnSec, color: 'var(--red)' }} onClick={remove}>Remove</button>
        </div>
      </div>

      {!editing && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
          {enabled.length ? enabled.map(label => (
            <span key={label} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--orange-light)', background: 'var(--orange-subtle)', border: '1px solid rgba(249,115,22,.3)', borderRadius: '999px', padding: '4px 11px' }}>
              {label}
            </span>
          )) : (
            <span style={{ fontSize: '12.5px', color: 'var(--text3)' }}>
              No sections enabled — they can sign in but see nothing. Hit Edit to give them access.
            </span>
          )}
        </div>
      )}

      {editing && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'grid', gap: '8px' }}>
            {STAFF_PERMS.map(([k, label, blurb]) => (
              <label key={k} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13.5px' }}>
                <input type="checkbox" checked={draft[k] === true}
                       onChange={() => setDraft(d => ({ ...d, [k]: !(d[k] === true) }))}
                       style={{ marginTop: '2px' }} />
                <span><strong>{label}</strong>
                  <span style={{ color: 'var(--text3)' }}> — {blurb}</span></span>
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button style={btnPri} disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
            <button style={btnSec} disabled={saving} onClick={cancelEdit}>Cancel</button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '10px' }}>
            Changes apply on their next page load.
          </div>
        </div>
      )}

      <StaffPassword row={row} flash={flash} onChanged={onChanged} />
    </div>
  )
}

// Password controls for one staff row. Two cases:
//  • We created their account (invite) — the owner may set a new password
//    directly, e.g. when a staff member is locked out.
//  • They joined with an Alzaro login they already owned — the owner must NOT
//    be able to take that account over, so the only option is emailing THEM a
//    reset link.
function StaffPassword({ row, flash, onChanged }) {
  const [pw, setPw] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const setPassword = async () => {
    setErr('')
    if (pw.length < 8) { setErr('At least 8 characters.'); return }
    setBusy(true)
    try {
      const session = await getSession()
      const r = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'set_password', staff_id: row.id, password: pw }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(j.error || 'Could not set the password'); return }
      setPw('')
      flash('Password updated — tell them the new one')
      onChanged() // server flips invited -> active; refresh so the label follows
    } catch (e) {
      setErr('Network error — try again')
    } finally { setBusy(false) }
  }

  const sendReset = async () => {
    setBusy(true)
    try {
      const redirect = window.location.origin + '/soloops/reset-password'
      const { error } = await resetPasswordForEmail(row.staff_email, redirect)
      if (error) { flash('Could not send the reset email'); return }
      flash(`Reset email sent to ${row.staff_email}`)
    } finally { setBusy(false) }
  }

  return (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text2)', marginBottom: '8px' }}>Password</div>
      {row.created_via_invite ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <PasswordInput value={pw} onChange={setPw} onEnter={setPassword} placeholder="New password (min 8 chars)" />
          <button style={btnSec} disabled={busy} onClick={setPassword}>
            {busy ? 'Saving…' : 'Set password'}
          </button>
          {err && <span style={{ color: 'var(--red)', fontSize: '12.5px' }}>{err}</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button style={btnSec} disabled={busy} onClick={sendReset}>
            {busy ? 'Sending…' : 'Send password reset email'}
          </button>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>
            They joined with an Alzaro login they already had, so only they can change its password.
          </span>
        </div>
      )}
    </div>
  )
}
