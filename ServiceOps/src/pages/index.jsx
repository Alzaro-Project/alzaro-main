export function Settings() {
  const { settings, tenantId, hydrateUser } = useStore()
  const [name, setName] = useState(settings.name || '')
  const [phone, setPhone] = useState(settings.phone || '')
  const [addr, setAddr] = useState(settings.addr || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const inp = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '11px 14px', color: 'var(--text)', fontSize: '14px', outline: 'none', width: '100%' }
  const lbl = { fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }

  const save = async () => {
    if (!name.trim()) { setErr('Business name is required.'); return }
    setErr(''); setSaving(true); setSaved(false)
    try {
      const { supabase } = await import('../lib/supabase')
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('garages')
        .update({ name: name.trim(), phone: phone.trim(), address: addr.trim() })
        .eq('id', tenantId)
      if (error) throw error
      // re-hydrate the store so the sidebar (and everything reading settings) updates live
      if (user) await hydrateUser(user)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setErr(e.message || 'Could not save changes')
    }
    setSaving(false)
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle={`Your ${PRODUCT.tenantNoun} profile`} />
      <Card style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div><label style={lbl}>{PRODUCT.tenantLabel}</label><input style={inp} value={name} onChange={e => setName(e.target.value)} /></div>
          <div><label style={lbl}>Phone</label><input style={inp} value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label style={lbl}>Address</label><input style={inp} value={addr} onChange={e => setAddr(e.target.value)} /></div>
          {err && <div style={{ fontSize: '13px', color: 'var(--red)' }}>{err}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Btn variant="primary" onClick={save}>{saving ? 'Saving…' : 'Save Changes'}</Btn>
            {saved && <span style={{ fontSize: '13px', color: 'var(--green)' }}>✓ Saved</span>}
          </div>
        </div>
      </Card>
    </div>
  )
}
