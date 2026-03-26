import { useState } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader, Card, Badge, Btn } from '../components/UI'
import GlobalSearch from '../components/GlobalSearch'

export default function Purchases() {
  const { skus, batches, usedTyres } = useStore()
  const [search, setSearch] = useState('')

  const skuLabel = sk => `${sk.brand} ${sk.model} ${sk.w}/${sk.p}R${sk.r}`

  const allRecords = [
    ...batches.map(b => {
      const sk = skus.find(s => s.id === b.skuId)
      return { ...b, type: 'new', tyreLabel: sk ? skuLabel(sk) : 'Unknown', totalCost: b.qty * b.cost }
    }),
    ...usedTyres.map(u => ({
      id: u.id, type: 'used', date: u.date, qty: 1, remaining: u.sold ? 0 : 1,
      cost: u.cost, totalCost: u.cost, supplier: u.sourceCust || 'Part-exchange',
      ref: '—', notes: u.notes, tyreLabel: `${u.brand} ${u.model} ${u.w}/${u.p}R${u.r}`
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  // Filter records by search
  const filtered = allRecords.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.tyreLabel?.toLowerCase().includes(q) ||
      r.supplier?.toLowerCase().includes(q) ||
      r.ref?.toLowerCase().includes(q) ||
      r.date?.includes(q)
    )
  })

  const totalSpend = allRecords.reduce((a, r) => a + r.totalCost, 0)
  const activeBatches = batches.filter(b => b.remaining > 0).length

  return (
    <div>
      <PageHeader title="Purchase History" subtitle="All supplier batches and part-exchange records" />

      {/* Global Search */}
      <div style={{ marginBottom: '16px' }}>
        <GlobalSearch maxWidth="500px" placeholder="Search customers, invoices, car reg..." />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '18px' }} className="stat-grid">
        {[
          ['Total Records', allRecords.length, 'purchases logged'],
          ['Active Batches', activeBatches, 'with stock remaining'],
          ['Total Spend', `£${totalSpend.toFixed(2)}`, 'at cost price'],
        ].map(([label, val, delta]) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>{label}</div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '24px', fontWeight: 500, marginTop: '5px', color: 'var(--accent)' }}>{val}</div>
            <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '3px' }}>{delta}</div>
          </div>
        ))}
      </div>

      <Card>
        {/* Page filter */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>Purchase Records</div>
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Filter records..." 
            style={{ 
              background: 'var(--surface2)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '6px 10px', 
              color: 'var(--text)', 
              fontSize: '12px', 
              outline: 'none', 
              width: '200px' 
            }} 
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>{['Date', 'Tyre', 'Type', 'Qty', 'Cost/ea', 'Total', 'Supplier', 'Ref', 'Remaining'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px' }}>
                  {search ? 'No records match your filter' : 'No purchase records yet'}
                </td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--surface2)')} onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{r.date}</td>
                  <td style={{ padding: '10px', fontWeight: 600, fontSize: '12px' }}>{r.tyreLabel}</td>
                  <td style={{ padding: '10px' }}><Badge variant={r.type === 'used' ? 'teal' : 'blue'}>{r.type === 'used' ? '♻ Used' : 'New'}</Badge></td>
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace' }}>{r.qty}</td>
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace' }}>£{r.cost.toFixed(2)}</td>
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>£{r.totalCost.toFixed(2)}</td>
                  <td style={{ padding: '10px', fontSize: '11px' }}>{r.supplier || '—'}</td>
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', fontSize: '10px', color: 'var(--text2)' }}>{r.ref || '—'}</td>
                  <td style={{ padding: '10px' }}>
                    <Badge variant={r.remaining === 0 ? 'gray' : 'green'}>{r.remaining}/{r.qty}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}