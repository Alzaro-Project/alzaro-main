import { useState } from 'react'
import { useStore } from '../store/useStore'
import { useServices } from '../hooks/useServices'
import { useCatalog } from '../hooks/useCatalog'

// ============================================================
// Items — Catalog of Parts / Services / Labour / Consumables
// ------------------------------------------------------------
// Step 3a: Services tab is now fully editable.
// Parts / Labour / Consumables remain placeholders for now.
// ============================================================

const T = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surface2: 'var(--surface2)',
  surface3: 'var(--surface3)',
  border: 'var(--border)',
  border2: 'var(--border2)',
  red: 'var(--red)',
  green: 'var(--green)',
  amber: 'var(--amber)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
}

const TABS = [
  { key: 'services',    label: 'Services',    icon: 'ti-tool',    desc: 'Fixed-price jobs (MOT, oil change, diagnostic)' },
  { key: 'parts',       label: 'Parts',       icon: 'ti-box',     desc: 'Physical items you sell (brake pads, oil filter, wipers)' },
  { key: 'labour',      label: 'Labour',      icon: 'ti-clock',   desc: 'Time-based work (per hour or fractions)' },
  { key: 'consumables', label: 'Consumables', icon: 'ti-droplet', desc: 'Oils, grease, screen wash, sundries' },
]

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

// ============================================================
// MAIN
// ============================================================
export default function Items() {
  const [tab, setTab] = useState('services')

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Items</div>
        <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
          Your catalog of services, parts, labour and consumables — set up once, used everywhere
        </div>
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

      {tab === 'services' && <ServicesTab />}
      {tab === 'parts' && <CatalogTab type="parts" />}
      {tab === 'labour' && <CatalogTab type="labour" />}
      {tab === 'consumables' && <CatalogTab type="consumables" />}
    </div>
  )
}

// ============================================================
// SERVICES TAB
// ============================================================
function ServicesTab() {
  const {
    services, loading, error, refresh,
    createService, updateService, archiveService, restoreService, deleteService,
  } = useServices({ includeArchived: true })

  const [formMode, setFormMode] = useState(null) // null | 'create' | 'edit'
  const [formInitial, setFormInitial] = useState({})
  const [showArchived, setShowArchived] = useState(false)

  const active = services.filter(s => !s.archived)
  const archived = services.filter(s => s.archived)

  const openCreate = () => {
    setFormInitial({ default_duration_min: 60, sort_order: 100 })
    setFormMode('create')
  }
  const openEdit = (svc) => {
    setFormInitial(svc)
    setFormMode('edit')
  }
  const handleSave = async (data) => {
    if (formMode === 'create') await createService(data)
    else await updateService(data.id, data)
    setFormMode(null)
  }
  const handleArchive = async (svc) => {
    if (!window.confirm(`Archive "${svc.name}"? It'll be hidden from the booking form but old bookings still show.`)) return
    await archiveService(svc.id)
  }
  const handleRestore = async (svc) => {
    await restoreService(svc.id)
  }
  const handleHardDelete = async (svc) => {
    if (!window.confirm(`Permanently delete "${svc.name}"? This cannot be undone. Archived bookings using this service will keep showing the name.`)) return
    try { await deleteService(svc.id) } catch (err) { alert('Failed: ' + (err.message || err)) }
  }

  return (
    <>
      {/* Add button + archive toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: T.text2 }}>
          {active.length} service{active.length === 1 ? '' : 's'} in catalog{archived.length > 0 ? ` · ${archived.length} archived` : ''}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {archived.length > 0 && (
            <button onClick={() => setShowArchived(s => !s)} style={ghostBtn}>
              <i className={`ti ${showArchived ? 'ti-eye-off' : 'ti-archive'}`} /> {showArchived ? 'Hide' : 'Show'} archived
            </button>
          )}
          <button onClick={openCreate} style={primaryBtn}>
            <i className="ti ti-plus" aria-hidden="true" /> Add service
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
          ⚠ Couldn't load services: {error}
          <button onClick={refresh} style={{ marginLeft: '8px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, padding: '3px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: T.text3, background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px' }}>
          <i className="ti ti-loader-2" style={{ fontSize: '28px', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '13px', marginTop: '12px' }}>Loading services...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : (
        <ServicesList
          active={active}
          archived={showArchived ? archived : []}
          onEdit={openEdit}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onHardDelete={handleHardDelete}
        />
      )}

      {/* Form modal */}
      {formMode && (
        <ServiceForm
          mode={formMode}
          initial={formInitial}
          onClose={() => setFormMode(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}

function ServicesList({ active, archived, onEdit, onArchive, onRestore, onHardDelete }) {
  if (active.length === 0 && archived.length === 0) {
    return (
      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: '12px', padding: '40px 20px', textAlign: 'center',
      }}>
        <i className="ti ti-tool" style={{ fontSize: '36px', color: T.text3, marginBottom: '12px' }} />
        <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>No services yet</div>
        <div style={{ fontSize: '12px', color: T.text2 }}>Tap "Add service" to add your first one</div>
      </div>
    )
  }
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 110px',
        gap: '12px', padding: '10px 16px',
        borderBottom: `0.5px solid ${T.border}`,
        fontSize: '10px', color: T.text3, fontFamily: 'monospace',
        textTransform: 'uppercase', letterSpacing: '0.8px',
      }}>
        <span>Service</span><span>Duration</span><span>Default price</span><span></span>
      </div>
      {active.map(s => (
        <ServiceRow key={s.id} svc={s} onEdit={onEdit} onArchive={onArchive} />
      ))}
      {archived.length > 0 && (
        <>
          <div style={{ padding: '12px 16px', background: T.surface2, fontSize: '10px', color: T.text3, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Archived
          </div>
          {archived.map(s => (
            <ServiceRow key={s.id} svc={s} archived onRestore={onRestore} onHardDelete={onHardDelete} />
          ))}
        </>
      )}
    </div>
  )
}

function ServiceRow({ svc, archived, onEdit, onArchive, onRestore, onHardDelete }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 110px',
      gap: '12px', padding: '12px 16px',
      borderBottom: `0.5px solid ${T.border}`,
      alignItems: 'center', fontSize: '13px',
      opacity: archived ? 0.5 : 1,
    }}>
      <div>
        <div style={{ fontWeight: 500 }}>{svc.name}</div>
        {svc.default_description && (
          <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px' }}>{svc.default_description}</div>
        )}
      </div>
      <div style={{ fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>{svc.default_duration_min} min</div>
      <div style={{ fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>{money(svc.default_price)}</div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
        {archived ? (
          <>
            <button onClick={() => onRestore(svc)} style={iconBtn} title="Restore"><i className="ti ti-arrow-back-up" /></button>
            <button onClick={() => onHardDelete(svc)} style={{ ...iconBtn, color: T.red }} title="Delete forever"><i className="ti ti-trash" /></button>
          </>
        ) : (
          <>
            <button onClick={() => onEdit(svc)} style={iconBtn} title="Edit"><i className="ti ti-edit" /></button>
            <button onClick={() => onArchive(svc)} style={iconBtn} title="Archive"><i className="ti ti-archive" /></button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// SERVICE FORM (create/edit)
// ============================================================
function ServiceForm({ mode, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    id: initial.id || null,
    name: initial.name || '',
    default_duration_min: initial.default_duration_min ?? 60,
    default_price: initial.default_price ?? '',
    default_description: initial.default_description || '',
    sort_order: initial.sort_order ?? 100,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!form.name.trim()) { setError('Service name is required'); return }
    setSaving(true)
    try { await onSave(form) }
    catch (err) { setError(err.message || 'Failed to save'); setSaving(false) }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }} style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '460px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {mode === 'edit' ? 'Edit service' : 'New service'}
          </div>
          <button onClick={onClose} disabled={saving} style={closeXBtn}><i className="ti ti-x" /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <div style={fieldLbl}>Service name *</div>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Full Service" style={inputStyle} autoFocus />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>Default duration (min) *</div>
            <input type="number" min="5" step="5" value={form.default_duration_min} onChange={e => setForm(f => ({ ...f, default_duration_min: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={fieldLbl}>Default price (£)</div>
            <input type="number" step="0.01" min="0" value={form.default_price} onChange={e => setForm(f => ({ ...f, default_price: e.target.value }))} placeholder="Leave blank for quote-only" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={fieldLbl}>Default description</div>
          <input value={form.default_description} onChange={e => setForm(f => ({ ...f, default_description: e.target.value }))} placeholder="Optional — appears on bookings & invoices" style={inputStyle} />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={fieldLbl}>Sort order</div>
          <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value, 10) || 100 }))} style={inputStyle} />
          <div style={{ fontSize: '10px', color: T.text3, marginTop: '4px' }}>Lower numbers appear first in dropdowns. Multiples of 10 leave room to insert later.</div>
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : (mode === 'edit' ? 'Save changes' : 'Create service')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CATALOG TAB (Parts / Labour / Consumables)
// ------------------------------------------------------------
// One generic tab driven by config — list, add/edit modal,
// archive/restore/hard-delete, mirroring the Services tab.
// ============================================================

const CATALOG_CONFIG = {
  parts: {
    table: 'parts',
    singular: 'part',
    icon: 'ti-box',
    emptyHint: 'Parts you sell repeatedly — brake pads, oil filters, wipers, bulbs',
    headers: ['Part', 'Cost', 'Sell', ''],
    renderCells: (r) => [
      <div key="n">
        <div style={{ fontWeight: 500 }}>{r.name}</div>
        {r.part_number && <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px', fontFamily: 'monospace' }}>{r.part_number}</div>}
      </div>,
      <span key="c" style={{ fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>{money(r.cost)}</span>,
      <span key="s" style={{ fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>{money(r.sell)}</span>,
    ],
    fields: [
      { key: 'name', label: 'Part name *', placeholder: 'e.g. Front brake pads — Bosch', autoFocus: true },
      { key: 'part_number', label: 'Part number', placeholder: 'Optional' },
      { key: 'cost', label: 'Your cost (£)', type: 'money', placeholder: '0.00', half: true },
      { key: 'sell', label: 'Sell price (£)', type: 'money', placeholder: '0.00', half: true },
    ],
    blank: { name: '', part_number: '', cost: '', sell: '', sort_order: 100 },
  },
  labour: {
    table: 'labour_rates',
    singular: 'labour rate',
    icon: 'ti-clock',
    emptyHint: 'Hourly rates — e.g. Standard labour, Diagnostics, Apprentice',
    headers: ['Rate', '£ / hour', '', ''],
    renderCells: (r) => [
      <div key="n" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontWeight: 500 }}>{r.name}</span>
        {r.is_default && (
          <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'monospace', padding: '2px 7px', borderRadius: '10px', background: 'rgba(229,57,53,0.12)', color: T.red }}>DEFAULT</span>
        )}
      </div>,
      <span key="r" style={{ fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>{money(r.hourly_rate)}/hr</span>,
      <span key="x" />,
    ],
    fields: [
      { key: 'name', label: 'Rate name *', placeholder: 'e.g. Standard labour', autoFocus: true },
      { key: 'hourly_rate', label: 'Rate per hour (£) *', type: 'money', placeholder: '60.00' },
      { key: 'is_default', label: 'Make this the default rate', type: 'check' },
    ],
    blank: { name: '', hourly_rate: '', is_default: false, sort_order: 100 },
  },
  consumables: {
    table: 'consumables',
    singular: 'consumable',
    icon: 'ti-droplet',
    emptyHint: 'Oils, screen wash, grease, sundries — priced per unit',
    headers: ['Consumable', 'Unit', 'Price', ''],
    renderCells: (r) => [
      <div key="n" style={{ fontWeight: 500 }}>{r.name}</div>,
      <span key="u" style={{ fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>per {r.unit || 'each'}</span>,
      <span key="p" style={{ fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>{money(r.price)}</span>,
    ],
    fields: [
      { key: 'name', label: 'Name *', placeholder: 'e.g. Engine oil 5W-30', autoFocus: true },
      { key: 'unit', label: 'Unit', type: 'select', options: ['each', 'litre', 'ml', 'kg', 'metre'], half: true },
      { key: 'price', label: 'Price (£) *', type: 'money', placeholder: '0.00', half: true },
    ],
    blank: { name: '', unit: 'each', price: '', sort_order: 100 },
  },
}

function CatalogTab({ type }) {
  const cfg = CATALOG_CONFIG[type]
  const { rows, loading, error, refresh, create, update, archive, restore, remove, setDefault } = useCatalog(cfg.table)

  const [formMode, setFormMode] = useState(null) // null | 'create' | 'edit'
  const [formInitial, setFormInitial] = useState({})
  const [showArchived, setShowArchived] = useState(false)

  const active = rows.filter(r => !r.archived)
  const archived = rows.filter(r => r.archived)

  const openCreate = () => { setFormInitial({ ...cfg.blank }); setFormMode('create') }
  const openEdit = (row) => { setFormInitial(row); setFormMode('edit') }

  const handleSave = async (data) => {
    let saved
    if (formMode === 'create') saved = await create(data)
    else saved = await update(data.id, data)
    // Labour: honour the "default" checkbox by clearing it on the others
    if (type === 'labour' && data.is_default && saved?.id) {
      await setDefault(saved.id)
    }
    setFormMode(null)
  }

  const handleArchive = async (row) => {
    if (!window.confirm(`Archive "${row.name}"? It'll be hidden from pickers but old records keep the name.`)) return
    await archive(row.id)
  }
  const handleHardDelete = async (row) => {
    if (!window.confirm(`Permanently delete "${row.name}"? This cannot be undone.`)) return
    try { await remove(row.id) } catch (err) { alert('Failed: ' + (err.message || err)) }
  }

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: T.text2 }}>
          {active.length} {cfg.singular}{active.length === 1 ? '' : 's'} in catalog{archived.length > 0 ? ` · ${archived.length} archived` : ''}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {archived.length > 0 && (
            <button onClick={() => setShowArchived(s => !s)} style={ghostBtn}>
              <i className={`ti ${showArchived ? 'ti-eye-off' : 'ti-archive'}`} /> {showArchived ? 'Hide' : 'Show'} archived
            </button>
          )}
          <button onClick={openCreate} style={primaryBtn}>
            <i className="ti ti-plus" aria-hidden="true" /> Add {cfg.singular}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
          ⚠ Couldn't load: {error}
          <button onClick={refresh} style={{ marginLeft: '8px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, padding: '3px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Retry</button>
        </div>
      )}

      {/* Loading / list */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: T.text3, background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px' }}>
          <i className="ti ti-loader-2" style={{ fontSize: '28px', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '13px', marginTop: '12px' }}>Loading...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : active.length === 0 && archived.length === 0 ? (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '40px 20px', textAlign: 'center' }}>
          <i className={`ti ${cfg.icon}`} style={{ fontSize: '36px', color: T.text3, marginBottom: '12px' }} aria-hidden="true" />
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nothing here yet</div>
          <div style={{ fontSize: '12px', color: T.text2 }}>{cfg.emptyHint}</div>
        </div>
      ) : (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 110px',
            gap: '12px', padding: '10px 16px',
            borderBottom: `0.5px solid ${T.border}`,
            fontSize: '10px', color: T.text3, fontFamily: 'monospace',
            textTransform: 'uppercase', letterSpacing: '0.8px',
          }}>
            {cfg.headers.map((h, i) => <span key={i}>{h}</span>)}
          </div>
          {active.map(r => (
            <CatalogRow key={r.id} row={r} cfg={cfg} type={type}
              onEdit={openEdit} onArchive={handleArchive} onSetDefault={setDefault} />
          ))}
          {showArchived && archived.length > 0 && (
            <>
              <div style={{ padding: '12px 16px', background: T.surface2, fontSize: '10px', color: T.text3, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Archived
              </div>
              {archived.map(r => (
                <CatalogRow key={r.id} row={r} cfg={cfg} type={type} archived
                  onRestore={restore} onHardDelete={handleHardDelete} />
              ))}
            </>
          )}
        </div>
      )}

      {/* Form modal */}
      {formMode && (
        <CatalogForm
          mode={formMode}
          cfg={cfg}
          initial={formInitial}
          onClose={() => setFormMode(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}

function CatalogRow({ row, cfg, type, archived, onEdit, onArchive, onRestore, onHardDelete, onSetDefault }) {
  const cells = cfg.renderCells(row)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 110px',
      gap: '12px', padding: '12px 16px',
      borderBottom: `0.5px solid ${T.border}`,
      alignItems: 'center', fontSize: '13px',
      opacity: archived ? 0.5 : 1,
    }}>
      {cells[0]}
      {cells[1]}
      {cells[2] || <span />}
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
        {archived ? (
          <>
            <button onClick={() => onRestore(row.id)} style={iconBtn} title="Restore"><i className="ti ti-arrow-back-up" /></button>
            <button onClick={() => onHardDelete(row)} style={{ ...iconBtn, color: T.red }} title="Delete forever"><i className="ti ti-trash" /></button>
          </>
        ) : (
          <>
            {type === 'labour' && !row.is_default && (
              <button onClick={() => onSetDefault(row.id)} style={iconBtn} title="Make default"><i className="ti ti-star" /></button>
            )}
            <button onClick={() => onEdit(row)} style={iconBtn} title="Edit"><i className="ti ti-edit" /></button>
            <button onClick={() => onArchive(row)} style={iconBtn} title="Archive"><i className="ti ti-archive" /></button>
          </>
        )}
      </div>
    </div>
  )
}

function CatalogForm({ mode, cfg, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    const f = { id: initial.id || null }
    cfg.fields.forEach(fl => { f[fl.key] = initial[fl.key] ?? cfg.blank[fl.key] })
    f.sort_order = initial.sort_order ?? 100
    return f
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!String(form.name || '').trim()) { setError('Name is required'); return }
    setSaving(true)
    try { await onSave(form) }
    catch (err) { setError(err.message || 'Failed to save'); setSaving(false) }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }} style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {mode === 'edit' ? `Edit ${cfg.singular}` : `New ${cfg.singular}`}
          </div>
          <button onClick={onClose} disabled={saving} style={closeXBtn}><i className="ti ti-x" /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
          {cfg.fields.map(fl => (
            <div key={fl.key} style={{ gridColumn: fl.half ? 'span 1' : 'span 2' }}>
              {fl.type === 'check' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: T.text2, cursor: 'pointer', marginTop: '4px' }}>
                  <input type="checkbox" checked={!!form[fl.key]} onChange={e => setForm(f => ({ ...f, [fl.key]: e.target.checked }))} />
                  {fl.label}
                </label>
              ) : (
                <>
                  <div style={fieldLbl}>{fl.label}</div>
                  {fl.type === 'select' ? (
                    <select value={form[fl.key] || fl.options[0]} onChange={e => setForm(f => ({ ...f, [fl.key]: e.target.value }))} style={inputStyle}>
                      {fl.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={fl.type === 'money' ? 'number' : 'text'}
                      step={fl.type === 'money' ? '0.01' : undefined}
                      min={fl.type === 'money' ? '0' : undefined}
                      value={form[fl.key] ?? ''}
                      onChange={e => setForm(f => ({ ...f, [fl.key]: e.target.value }))}
                      placeholder={fl.placeholder}
                      autoFocus={fl.autoFocus}
                      style={inputStyle}
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : (mode === 'edit' ? 'Save changes' : `Add ${cfg.singular}`)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// STYLES
// ============================================================
const primaryBtn = {
  background: T.red, color: '#fff', border: 'none',
  padding: '10px 16px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const ghostBtn = {
  background: T.surface3, color: T.text, border: `1px solid ${T.border2}`,
  padding: '10px 14px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const iconBtn = {
  width: '30px', height: '30px',
  background: T.surface2, border: `1px solid ${T.border2}`,
  color: T.text2, borderRadius: '6px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '13px',
}
const closeXBtn = {
  background: 'none', border: 'none', color: T.text3,
  fontSize: '22px', cursor: 'pointer', padding: '0',
}
const modalOverlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 600, padding: '16px',
}
const modalCard = {
  background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: '16px', padding: '24px',
  width: '100%', maxHeight: '90vh', overflowY: 'auto',
  fontFamily: "'Space Grotesk', sans-serif", color: T.text,
}
const inputStyle = {
  width: '100%',
  background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px',
  padding: '9px 12px', color: T.text, fontSize: '13px',
  fontFamily: 'inherit', outline: 'none',
}
const fieldLbl = {
  fontSize: '10px', color: T.text3, fontFamily: 'monospace',
  letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px',
  fontWeight: 500,
}
