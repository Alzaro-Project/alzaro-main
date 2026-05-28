import { useState } from 'react'
import { useStore } from '../store/useStore'

// ============================================================
// Items — Catalog of Parts / Services / Labour / Consumables
// ------------------------------------------------------------
// Placeholder shell. Tabs render but the editors are stubs —
// real CRUD UI is the next build pass. The Parts and Labour
// stores already exist in useStore; Services & Consumables are
// not in the DB yet (TODO).
// ============================================================

const T = {
  surface: '#14121a', surface2: '#1e1b26',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.1)',
  red: '#e53935', text: '#f8f7fa', text2: '#9d99a8', text3: '#5c586a',
}

const TABS = [
  { key: 'parts',       label: 'Parts',       icon: 'ti-box',         desc: 'Physical items you sell (brake pads, oil filter, wipers)' },
  { key: 'services',    label: 'Services',    icon: 'ti-tool',        desc: 'Fixed-price jobs (MOT, oil change, diagnostic)' },
  { key: 'labour',      label: 'Labour',      icon: 'ti-clock',       desc: 'Time-based work (per hour or fractions)' },
  { key: 'consumables', label: 'Consumables', icon: 'ti-droplet',     desc: 'Oils, grease, screen wash, sundries' },
]

export default function Items() {
  const [tab, setTab] = useState('parts')
  const { parts, labourRates } = useStore()

  const active = TABS.find(t => t.key === tab)
  const count =
    tab === 'parts' ? (parts?.length || 0) :
    tab === 'labour' ? (labourRates?.length || 0) :
    0

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Items</div>
          <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
            Your catalog of parts, services, labour and consumables — set up once, used everywhere
          </div>
        </div>
        <button style={{
          background: T.red, color: '#fff', border: 'none',
          padding: '10px 16px', borderRadius: '10px',
          fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
        }}>
          <i className="ti ti-plus" aria-hidden="true" /> Add {active.label.toLowerCase().replace(/s$/, '')}
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px',
        background: T.surface, border: `0.5px solid ${T.border}`,
        padding: '4px', borderRadius: '10px',
        marginBottom: '16px', overflowX: 'auto',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 14px', borderRadius: '7px',
            fontSize: '12px', fontWeight: tab === t.key ? 500 : 400,
            color: tab === t.key ? T.text : T.text2,
            background: tab === t.key ? T.surface2 : 'transparent',
            border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            <i className={`ti ${t.icon}`} aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — placeholder */}
      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: '12px', padding: '40px 20px', textAlign: 'center',
      }}>
        <i className={`ti ${active.icon}`} style={{ fontSize: '36px', color: T.text3, marginBottom: '12px' }} aria-hidden="true" />
        <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '6px' }}>{active.label}</div>
        <div style={{ fontSize: '13px', color: T.text2, marginBottom: '16px', maxWidth: '420px', margin: '0 auto 16px' }}>
          {active.desc}
        </div>
        <div style={{ fontSize: '12px', color: T.text3, fontFamily: 'monospace' }}>
          {count > 0
            ? `${count} ${active.label.toLowerCase()} in catalog · editor coming next`
            : 'Catalog editor coming next — for now items are added directly inside invoices'}
        </div>
      </div>
    </div>
  )
}
