import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { PageHeader, Card, Btn, Badge } from '../components/UI'

const KIND_META = {
  sku:      { label: 'New Tyre',  variant: 'blue' },
  batch:    { label: 'Batch',     variant: 'yellow' },
  used:     { label: 'Used Tyre', variant: 'teal' },
  customer: { label: 'Customer',  variant: 'green' },
  invoice:  { label: 'Invoice',   variant: 'blue' },
}

const RECYCLE_DAYS = 30

function daysLeft(deletedAt) {
  const gone = new Date(new Date(deletedAt).getTime() + RECYCLE_DAYS * 86400000)
  const diff = Math.ceil((gone - Date.now()) / 86400000)
  return Math.max(0, diff)
}

export default function RecentlyDeleted() {
  const { deletedItems, loadDeletedItems, restoreItem, purgeItem } = useStore()
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    loadDeletedItems().finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const handleRestore = async (item) => {
    setBusyId(item.kind + item.id)
    await restoreItem(item.kind, item.id)
    setBusyId(null)
  }

  const handlePurge = async (item) => {
    if (!confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) return
    setBusyId(item.kind + item.id)
    await purgeItem(item.kind, item.id)
    setBusyId(null)
  }

  return (
    <div>
      <PageHeader title="Recently Deleted" subtitle={`Deleted items are kept for ${RECYCLE_DAYS} days, then removed for good`} />

      <Card>
        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
        ) : deletedItems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>
            🗑 Nothing here. Deleted items will appear here so you can restore them.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {deletedItems.map(item => {
              const meta = KIND_META[item.kind] || { label: item.kind, variant: 'blue' }
              const left = daysLeft(item.deletedAt)
              const busy = busyId === (item.kind + item.id)
              return (
                <div key={item.kind + item.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '12px', flexWrap: 'wrap',
                  background: 'var(--surface2)', borderRadius: '10px', padding: '12px 14px',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <span style={{ fontWeight: 600 }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '3px' }}>
                      {item.sub} · deleted {new Date(item.deletedAt).toLocaleDateString()} ·{' '}
                      <span style={{ color: left <= 5 ? 'var(--red)' : 'var(--text2)' }}>
                        {left} day{left !== 1 ? 's' : ''} left
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Btn sm variant="primary" onClick={() => handleRestore(item)} disabled={busy}>
                      {busy ? '…' : '↩ Restore'}
                    </Btn>
                    <Btn sm variant="danger" onClick={() => handlePurge(item)} disabled={busy}>
                      {busy ? '…' : '🗑 Delete forever'}
                    </Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '12px' }}>
        Note: restoring a batch or invoice brings back its stock and details exactly as they were.
      </div>
    </div>
  )
}
