import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { PageHeader, Card, StatCard, Btn, Badge } from '../components/UI'
import { PRODUCT } from '../config/product'

export default function Dashboard() {
  const navigate = useNavigate()
  const { settings, jobs, invoices, customers } = useStore()

  const openJobs = jobs.filter(j => j.status !== 'completed').length
  const unpaid = invoices.filter(i => i.status !== 'paid')
  const unpaidTotal = unpaid.reduce((a, i) => a + (i.total || 0), 0)
  const paidThisMonth = invoices
    .filter(i => i.status === 'paid' && new Date(i.date).getMonth() === new Date().getMonth())
    .reduce((a, i) => a + (i.total || 0), 0)

  const setupSteps = [
    { label: 'Set up your business details', done: !!(settings.name && settings.phone), path: '/settings' },
    { label: 'Add your first customer', done: customers.length > 0, path: '/customers' },
    { label: 'Create your first quote', done: false, path: '/quotes' },
    { label: 'Raise your first invoice', done: invoices.length > 0, path: '/invoices' },
  ]
  const done = setupSteps.filter(s => s.done).length
  const showOnboarding = done < setupSteps.length

  return (
    <div>
      <PageHeader title={`Welcome${settings.name ? `, ${settings.name}` : ''}`} subtitle={PRODUCT.tagline}>
        <Btn variant="primary" onClick={() => navigate('/jobs')}>+ New Job</Btn>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }} className="stat-grid">
        <StatCard label="Open Jobs" value={openJobs} delta={`${jobs.length} total`} color="var(--accent)" />
        <StatCard label="Unpaid Invoices" value={unpaid.length} delta={`£${unpaidTotal.toFixed(0)} outstanding`} color="var(--red)" />
        <StatCard label="Paid This Month" value={`£${paidThisMonth.toFixed(0)}`} delta="received" color="var(--green)" />
        <StatCard label="Customers" value={customers.length} delta="on your books" color="var(--blue)" />
      </div>

      {showOnboarding && (
        <Card style={{ marginBottom: '18px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>👋 Get started with {PRODUCT.name}</div>
          <div style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '14px' }}>{done} of {setupSteps.length} complete</div>
          <div style={{ height: '6px', background: 'var(--surface3)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ height: '100%', width: `${(done / setupSteps.length) * 100}%`, background: 'var(--accent)', transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {setupSteps.map(s => (
              <button key={s.label} onClick={() => navigate(s.path)} style={{
                display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--surface2)',
                border: `1px solid ${s.done ? 'var(--green)' : 'var(--border)'}`, borderRadius: '8px',
                padding: '12px 16px', cursor: 'pointer', textAlign: 'left', color: 'var(--text)',
              }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: s.done ? 'var(--green)' : 'transparent', border: s.done ? 'none' : '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: '13px' }}>{s.done ? '✓' : ''}</div>
                <span style={{ flex: 1, fontSize: '14px', color: s.done ? 'var(--text3)' : 'var(--text)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
                <span style={{ color: 'var(--text3)' }}>→</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>Recent Jobs</div>
        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)', fontSize: '13px' }}>
            No jobs yet. <span onClick={() => navigate('/jobs')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Create your first job →</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {jobs.slice(0, 5).map(j => (
              <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface2)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{j.title || 'Untitled job'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{j.customer || '—'}</div>
                </div>
                <Badge variant={j.status === 'completed' ? 'green' : j.status === 'in_progress' ? 'blue' : 'gray'}>{(j.status || 'pending').replace('_', ' ')}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
