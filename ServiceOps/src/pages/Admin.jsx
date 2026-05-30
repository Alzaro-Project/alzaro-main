import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader, Card, Btn, StatCard } from '../components/UI'
import { getAllTenants, updateTenantTier, updateTenantStatus, deleteTenant } from '../lib/db'
import { PRODUCT, TIER_PRICE, TIER_META, TIER_ORDER } from '../config/product'

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

export default function Admin() {
  const { isAdmin } = useStore()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTenants() }, [])

  const loadTenants = async () => {
    try { setLoading(true); setTenants(await getAllTenants()) }
    catch (err) { console.error('Failed to load tenants:', err) }
    setLoading(false)
  }

  const handleTier = async (id, tier) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, tier } : t))
    try { await updateTenantTier(id, tier) } catch { loadTenants() }
  }
  const handleStatus = async (id, status) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    try { await updateTenantStatus(id, status) } catch { loadTenants() }
  }
  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}" and all their data? This cannot be undone.`)) return
    try { await deleteTenant(id); setTenants(prev => prev.filter(t => t.id !== id)) }
    catch { alert('Failed to delete. They may have linked data.') }
  }

  const active = tenants.filter(t => t.status === 'active')
  const trial = tenants.filter(t => t.status === 'trial')
  const suspended = tenants.filter(t => t.status === 'suspended')
  const mrr = active.reduce((a, t) => a + (TIER_PRICE[t.tier] || 0), 0)

  const tierCounts = Object.fromEntries(TIER_ORDER.map(t => [t, 0]))
  tenants.forEach(t => { if (tierCounts[t.tier] !== undefined) tierCounts[t.tier]++ })

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

  const trialInfo = (t) => {
    if (t.status !== 'trial') return null
    const ends = t.trial_ends ? new Date(t.trial_ends) : new Date(new Date(t.created_at).getTime() + PRODUCT.trialDays * 864e5)
    const today = new Date(); today.setHours(0, 0, 0, 0); ends.setHours(0, 0, 0, 0)
    const daysLeft = Math.ceil((ends - today) / 864e5)
    return { ends, daysLeft, isExpired: daysLeft <= 0, isSoon: daysLeft > 0 && daysLeft <= 3 }
  }
  const expiring = trial.filter(t => { const i = trialInfo(t); return i && (i.isExpired || i.isSoon) }).length

  if (!isAdmin) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Access Denied</div>
        <div style={{ color: 'var(--text2)' }}>You need admin privileges to view this page.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ background: 'linear-gradient(90deg,rgba(124,58,237,.12),rgba(124,58,237,.04))', border: '1px solid rgba(124,58,237,.25)', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', color: '#7c3aed', fontWeight: 600, marginBottom: '14px' }}>
        👑 {PRODUCT.name} Admin Panel — Platform Owner View
      </div>

      <PageHeader title={`${cap(PRODUCT.tenantNoun)} Management`} subtitle={`All registered ${PRODUCT.tenantNounPlural} and subscriptions`}>
        <Btn variant="secondary" onClick={loadTenants}>↻ Refresh</Btn>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }} className="stat-grid">
        <StatCard label={`Total ${cap(PRODUCT.tenantNounPlural)}`} value={tenants.length} delta={`${trial.length} on trial`} color="var(--accent)" />
        <StatCard label="Monthly Revenue" value={`£${mrr.toLocaleString()}`} delta="MRR from active" color="var(--green)" />
        <StatCard label="Active Subscriptions" value={active.length} delta={`${suspended.length} suspended`} color="var(--blue)" />
        <StatCard label="Trials Expiring Soon" value={expiring} delta="need follow-up" color={expiring > 0 ? 'var(--red)' : 'var(--green)'} />
      </div>

      <Card>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>
          All {cap(PRODUCT.tenantNounPlural)} {loading && <span style={{ color: 'var(--text3)' }}>· Loading…</span>}
        </div>
        {tenants.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>No {PRODUCT.tenantNounPlural} registered yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead><tr>{[cap(PRODUCT.tenantNoun), 'Email', 'Tier', 'Status', 'Trial Ends', 'Fee/mo', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {tenants.map(t => {
                  const info = trialInfo(t)
                  return (
                    <tr key={t.id}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{t.name || `Unnamed ${PRODUCT.tenantNoun}`}</td>
                      <td style={{ padding: '10px', fontSize: '11px', color: 'var(--text2)' }}>{t.email || '-'}</td>
                      <td style={{ padding: '10px' }}>
                        <select style={selStyle} value={t.tier || TIER_ORDER[0]} onChange={e => handleTier(t.id, e.target.value)}>
                          {TIER_ORDER.map(id => <option key={id} value={id}>{TIER_META[id].icon} {TIER_META[id].label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <select style={selStyle} value={t.status || 'trial'} onChange={e => handleStatus(t.id, e.target.value)}>
                          <option value="active">✓ Active</option>
                          <option value="trial">⏳ Trial</option>
                          <option value="suspended">✕ Suspended</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px' }}>
                        {info ? (
                          <div>
                            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '11px', color: info.isExpired ? 'var(--red)' : info.isSoon ? 'var(--accent)' : 'var(--text2)' }}>{fmtDate(info.ends)}</div>
                            <div style={{ fontSize: '10px', color: info.isExpired ? 'var(--red)' : info.isSoon ? 'var(--accent)' : 'var(--text3)', fontWeight: info.isExpired || info.isSoon ? 600 : 400 }}>
                              {info.isExpired ? '⚠ Expired' : info.daysLeft === 1 ? '1 day left' : `${info.daysLeft} days left`}
                            </div>
                          </div>
                        ) : <span style={{ color: 'var(--text3)', fontSize: '11px' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: t.status === 'active' ? 'var(--green)' : 'var(--text3)' }}>{t.status === 'active' ? `£${TIER_PRICE[t.tier] || 0}` : '—'}</td>
                      <td style={{ padding: '10px' }}><Btn sm variant="danger" onClick={() => handleDelete(t.id, t.name)}>Delete</Btn></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

const selStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text)', fontSize: '11px', outline: 'none', cursor: 'pointer' }
