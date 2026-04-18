import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader, Card, Badge, Btn, StatCard } from '../components/UI'
import { getAllGarages, updateGarageTier, updateGarageStatus, deleteGarage } from '../lib/db'

const TIER_PRICE = { bronze: 60, silver: 75, gold: 90 }

export default function Admin() {
  const { isAdmin } = useStore()
  const [garages, setGarages] = useState([])
  const [loading, setLoading] = useState(true)

  // Load garages from Supabase
  useEffect(() => {
    loadGarages()
  }, [])

  const loadGarages = async () => {
    try {
      setLoading(true)
      const data = await getAllGarages()
      setGarages(data)
    } catch (err) {
      console.error('Failed to load garages:', err)
    }
    setLoading(false)
  }

  // Handle tier change
  const handleTierChange = async (garageId, newTier) => {
    setGarages(prev => prev.map(g => g.id === garageId ? { ...g, tier: newTier } : g))
    try {
      await updateGarageTier(garageId, newTier)
    } catch (err) {
      console.error('Failed to update tier:', err)
      loadGarages()
    }
  }

  // Handle status change
  const handleStatusChange = async (garageId, newStatus) => {
    setGarages(prev => prev.map(g => g.id === garageId ? { ...g, status: newStatus } : g))
    try {
      await updateGarageStatus(garageId, newStatus)
    } catch (err) {
      console.error('Failed to update status:', err)
      loadGarages()
    }
  }

  // Handle delete
  const handleDelete = async (garageId, garageName) => {
    if (!confirm(`Delete "${garageName}" and all their data? This cannot be undone.`)) return
    try {
      await deleteGarage(garageId)
      setGarages(prev => prev.filter(g => g.id !== garageId))
    } catch (err) {
      console.error('Failed to delete garage:', err)
      alert('Failed to delete garage. They may have linked data.')
    }
  }

  // Calculate stats
  const activeGarages = garages.filter(g => g.status === 'active')
  const trialGarages = garages.filter(g => g.status === 'trial')
  const suspendedGarages = garages.filter(g => g.status === 'suspended')
  
  const mrr = activeGarages.reduce((a, g) => a + (TIER_PRICE[g.tier] || 0), 0)
  const arr = mrr * 12
  
  const tierCounts = { bronze: 0, silver: 0, gold: 0 }
  garages.forEach(g => { if (tierCounts[g.tier] !== undefined) tierCounts[g.tier]++ })

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Calculate days remaining in trial
  const getTrialInfo = (garage) => {
    if (garage.status !== 'trial') return null
    
    const trialEnds = garage.trial_ends 
      ? new Date(garage.trial_ends) 
      : new Date(new Date(garage.created_at).getTime() + 14 * 24 * 60 * 60 * 1000)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    trialEnds.setHours(0, 0, 0, 0)
    
    const daysLeft = Math.ceil((trialEnds - today) / (1000 * 60 * 60 * 24))
    
    return {
      endsOn: trialEnds,
      daysLeft,
      isExpired: daysLeft <= 0,
      isExpiringSoon: daysLeft > 0 && daysLeft <= 3
    }
  }

  // Count expiring trials
  const expiringTrials = trialGarages.filter(g => {
    const info = getTrialInfo(g)
    return info && (info.isExpired || info.isExpiringSoon)
  }).length

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
      <div style={{ background: 'linear-gradient(90deg,rgba(167,139,250,.12),rgba(167,139,250,.04))', border: '1px solid rgba(167,139,250,.25)', borderRadius: '8px', padding: '7px 14px', fontSize: '11px', color: 'var(--purple)', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        👑 GarageIQ Admin Panel — Platform Owner View
      </div>

      <PageHeader title="Garage Management" subtitle="All registered garages and subscriptions">
        <Btn variant="secondary" onClick={loadGarages}>↻ Refresh</Btn>
      </PageHeader>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }}>
        <StatCard label="Total Garages" value={garages.length} delta={`${trialGarages.length} on trial`} color="var(--accent)" />
        <StatCard label="Monthly Revenue" value={`£${mrr.toLocaleString()}`} delta="MRR from active" color="var(--green)" />
        <StatCard label="Active Subscriptions" value={activeGarages.length} delta={`${suspendedGarages.length} suspended`} color="var(--blue)" />
        <StatCard label="Trials Expiring Soon" value={expiringTrials} delta="need follow-up" color={expiringTrials > 0 ? 'var(--red)' : 'var(--green)'} />
      </div>

      {/* Tier breakdown + Revenue chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '18px' }}>
        <Card>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '14px' }}>Tier Breakdown</div>
          {['bronze', 'silver', 'gold'].map(t => {
            const pct = garages.length ? Math.round(tierCounts[t] / garages.length * 100) : 0
            const col = t === 'bronze' ? '#cd7f32' : t === 'silver' ? '#c0c0c0' : 'var(--accent)'
            const revenue = tierCounts[t] * TIER_PRICE[t]
            return (
              <div key={t} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 600 }}>{t === 'bronze' ? '🥉' : t === 'silver' ? '🥈' : '🥇'} {t.charAt(0).toUpperCase() + t.slice(1)}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{tierCounts[t]} · £{revenue}/mo</span>
                </div>
                <div style={{ height: '5px', background: 'var(--surface3)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: col, borderRadius: '3px', width: `${pct}%`, transition: 'width .3s' }} />
                </div>
              </div>
            )
          })}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
              <span>Total MRR</span>
              <span style={{ color: 'var(--green)', fontFamily: 'DM Mono, monospace' }}>£{mrr}/mo</span>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '14px' }}>Status Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.2)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--green)', fontFamily: 'DM Mono, monospace' }}>{activeGarages.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Active</div>
            </div>
            <div style={{ background: 'rgba(245,200,66,.1)', border: '1px solid rgba(245,200,66,.2)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'DM Mono, monospace' }}>{trialGarages.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Trial</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--red)', fontFamily: 'DM Mono, monospace' }}>{suspendedGarages.length}</div>
              <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '4px' }}>Suspended</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Garages table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>
            All Garages {loading && <span style={{ color: 'var(--text3)' }}>· Loading...</span>}
          </div>
        </div>
        
        {garages.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
            No garages registered yet. They'll appear here when garages sign up.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>{['Garage', 'Email', 'Tier', 'Status', 'Trial Ends', 'Fee/mo', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {garages.map(g => {
                  const trialInfo = getTrialInfo(g)
                  return (
                    <tr key={g.id} onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--surface2)')} onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{g.name || 'Unnamed Garage'}</td>
                      <td style={{ padding: '10px', fontSize: '11px', color: 'var(--text2)' }}>{g.email || '-'}</td>
                      <td style={{ padding: '10px' }}>
                        <select 
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text)', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                          value={g.tier || 'bronze'} 
                          onChange={e => handleTierChange(g.id, e.target.value)}
                        >
                          <option value="bronze">🥉 Bronze</option>
                          <option value="silver">🥈 Silver</option>
                          <option value="gold">🥇 Gold</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <select 
                          style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text)', fontSize: '11px', outline: 'none', cursor: 'pointer' }}
                          value={g.status || 'trial'} 
                          onChange={e => handleStatusChange(g.id, e.target.value)}
                        >
                          <option value="active">✓ Active</option>
                          <option value="trial">⏳ Trial</option>
                          <option value="suspended">✕ Suspended</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px' }}>
                        {trialInfo ? (
                          <div>
                            <div style={{ 
                              fontFamily: 'DM Mono, monospace', 
                              fontSize: '11px',
                              color: trialInfo.isExpired ? 'var(--red)' : trialInfo.isExpiringSoon ? 'var(--accent)' : 'var(--text2)'
                            }}>
                              {formatDate(trialInfo.endsOn)}
                            </div>
                            <div style={{ 
                              fontSize: '10px', 
                              color: trialInfo.isExpired ? 'var(--red)' : trialInfo.isExpiringSoon ? 'var(--accent)' : 'var(--text3)',
                              fontWeight: trialInfo.isExpired || trialInfo.isExpiringSoon ? 600 : 400
                            }}>
                              {trialInfo.isExpired 
                                ? '⚠ Expired' 
                                : trialInfo.daysLeft === 1 
                                  ? '1 day left' 
                                  : `${trialInfo.daysLeft} days left`}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text3)', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: g.status === 'active' ? 'var(--green)' : 'var(--text3)' }}>
                        {g.status === 'active' ? `£${TIER_PRICE[g.tier] || 0}` : '—'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <Btn sm variant="danger" onClick={() => handleDelete(g.id, g.name)}>Delete</Btn>
                      </td>
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