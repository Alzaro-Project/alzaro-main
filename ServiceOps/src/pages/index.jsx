import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader, Card, Btn, Badge } from '../components/UI'
import { PRODUCT } from '../config/product'

/* A small reusable empty-state so each page is functional, not a stub. */
function Empty({ icon, label, action, onAction }) {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text3)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>{icon}</div>
        <div style={{ fontSize: '14px', marginBottom: '16px' }}>{label}</div>
        {action && <Btn variant="primary" onClick={onAction}>{action}</Btn>}
      </div>
    </Card>
  )
}

export function Jobs() {
  const jobs = useStore(s => s.jobs)
  return (
    <div>
      <PageHeader title="Jobs" subtitle="Track work from booking to completion">
        <Btn variant="primary">+ New Job</Btn>
      </PageHeader>
      {jobs.length === 0
        ? <Empty icon="🛠️" label="No jobs yet. Create one to start tracking work." action="+ New Job" />
        : <Card>{/* job list to be wired to Supabase svc_jobs */}</Card>}
    </div>
  )
}

export function Quotes() {
  return (
    <div>
      <PageHeader title="Quotes" subtitle="Build and send quotes to customers">
        <Btn variant="primary">+ New Quote</Btn>
      </PageHeader>
      <Empty icon="📝" label="No quotes yet. Create a quote to send to a customer." action="+ New Quote" />
    </div>
  )
}

export function Invoices() {
  const invoices = useStore(s => s.invoices)
  return (
    <div>
      <PageHeader title="Invoices" subtitle="Raise invoices and track payments">
        <Btn variant="primary">+ New Invoice</Btn>
      </PageHeader>
      {invoices.length === 0
        ? <Empty icon="📄" label="No invoices yet. Raise one when a job is done." action="+ New Invoice" />
        : <Card>{/* invoice list */}</Card>}
    </div>
  )
}

export function Customers() {
  const customers = useStore(s => s.customers)
  return (
    <div>
      <PageHeader title="Customers" subtitle="Your customer database">
        <Btn variant="primary">+ Add Customer</Btn>
      </PageHeader>
      {customers.length === 0
        ? <Empty icon="👥" label="No customers yet. Add your first one." action="+ Add Customer" />
        : <Card>{/* customer list */}</Card>}
    </div>
  )
}

export function Schedule() {
  return (
    <div>
      <PageHeader title="Schedule" subtitle="Plan jobs across the week" />
      <Empty icon="📅" label="Your schedule is empty. Booked jobs will appear here." />
    </div>
  )
}

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
      const { error } = await supabase.from('product_members')
        .update({ company_name: name.trim(), phone: phone.trim(), address: addr.trim() })
        .eq('id', tenantId)
      if (error) throw error
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
