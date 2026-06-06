import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { usePurchases } from '../hooks/usePurchases'

// ============================================================
// Purchases — Step 2: full CRUD
// ------------------------------------------------------------
// One row per item bought. Optional customer/vehicle tag for
// job-specific purchases (these get offered at invoice time).
// Untagged rows are general workshop spend — still count for
// VAT. Receipt photo upload comes in a later step.
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
  blue: 'var(--blue)',
  teal: 'var(--teal)',
  purple: 'var(--purple)',
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
}

const CATEGORIES = [
  { key: 'parts',       label: 'Parts',       icon: 'ti-box',           color: T.blue },
  { key: 'tyres',       label: 'Tyres',       icon: 'ti-circle-dot',    color: T.teal },
  { key: 'consumables', label: 'Consumables', icon: 'ti-droplet',       color: T.amber },
  { key: 'tools',       label: 'Tools',       icon: 'ti-tool',          color: T.purple },
  { key: 'overheads',   label: 'Overheads',   icon: 'ti-building',      color: T.text2 },
  { key: 'other',       label: 'Other',       icon: 'ti-dots',          color: T.text2 },
]

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayStr() {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// ============================================================
// MAIN
// ============================================================
export default function Purchases() {
  const {
    purchases, loading, error, refresh,
    createPurchase, updatePurchase, deletePurchase,
  } = usePurchases()

  const [formMode, setFormMode] = useState(null) // null | 'create' | 'edit'
  const [formInitial, setFormInitial] = useState({})
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [billFilter, setBillFilter] = useState('all') // all | unbilled | billed

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let monthGross = 0, monthVat = 0, unbilledCount = 0, unbilledValue = 0
    purchases.forEach(p => {
      if ((p.purchase_date || '').startsWith(monthPrefix)) {
        monthGross += Number(p.gross) || 0
        monthVat += Number(p.vat) || 0
      }
      const jobTagged = p.customer_id || p.customer_name || p.vehicle_reg
      if (jobTagged && !p.invoice_id) {
        unbilledCount += 1
        unbilledValue += Number(p.gross) || 0
      }
    })
    return { monthGross, monthVat, unbilledCount, unbilledValue }
  }, [purchases])

  // ---------- Filtering ----------
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return purchases.filter(p => {
      if (catFilter !== 'all' && p.category !== catFilter) return false
      if (billFilter === 'unbilled' && p.invoice_id) return false
      if (billFilter === 'billed' && !p.invoice_id) return false
      if (!q) return true
      return (
        (p.supplier || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.customer_name || '').toLowerCase().includes(q) ||
        (p.vehicle_reg || '').toLowerCase().includes(q) ||
        (p.supplier_ref || '').toLowerCase().includes(q) ||
        (p.invoice_id || '').toLowerCase().includes(q)
      )
    })
  }, [purchases, search, catFilter, billFilter])

  // ---------- Handlers ----------
  const openCreate = () => {
    setFormInitial({ purchase_date: todayStr(), category: 'parts', payment_status: 'paid' })
    setFormMode('create')
  }
  const openEdit = (p) => {
    setFormInitial(p)
    setFormMode('edit')
  }
  const handleSave = async (data) => {
    if (formMode === 'create') await createPurchase(data)
    else {
      const net = parseFloat(data.net) || 0
      const vat = parseFloat(data.vat) || 0
      await updatePurchase(data.id, {
        supplier: data.supplier, purchase_date: data.purchase_date,
        description: data.description, category: data.category,
        supplier_ref: data.supplier_ref || null, notes: data.notes || null,
        net, vat, gross: Math.round((net + vat) * 100) / 100,
        payment_status: data.payment_status,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name || null,
        vehicle_reg: data.vehicle_reg ? data.vehicle_reg.toUpperCase() : null,
      })
    }
    setFormMode(null)
  }
  const handleDelete = async (p) => {
    const warn = p.invoice_id
      ? `This purchase is already on invoice ${p.invoice_id}. Deleting it here won't change that invoice. Delete anyway?`
      : `Delete "${p.description}" (${money(p.gross)})? This cannot be undone.`
    if (!window.confirm(warn)) return
    try { await deletePurchase(p.id) } catch (err) { alert('Failed: ' + (err.message || err)) }
  }

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }} className="page-header">
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Purchases</div>
          <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
            Everything you buy — tag job purchases to a customer so they're ready at invoice time
          </div>
        </div>
        <button onClick={openCreate} style={primaryBtn}>
          <i className="ti ti-plus" aria-hidden="true" /> Add purchase
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatTile label="Spend this month" value={money(stats.monthGross)} sub="inc. VAT" />
        <StatTile label="VAT this month" value={money(stats.monthVat)} sub="reclaimable" color={T.teal} />
        <StatTile
          label="Unbilled job purchases"
          value={stats.unbilledCount}
          sub={stats.unbilledCount > 0 ? `${money(stats.unbilledValue)} waiting to be invoiced` : 'all caught up'}
          color={stats.unbilledCount > 0 ? T.amber : T.green}
        />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px', padding: '8px 12px', flex: '1 1 220px', maxWidth: '340px' }}>
          <i className="ti ti-search" style={{ color: T.text3, fontSize: '14px' }} aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search supplier, item, reg, customer..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.text, fontSize: '12px', fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 0, fontSize: '12px' }}>✕</button>
          )}
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={selectStyle}>
          <option value="all">All categories</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select value={billFilter} onChange={e => setBillFilter(e.target.value)} style={selectStyle}>
          <option value="all">Billed + unbilled</option>
          <option value="unbilled">Unbilled only</option>
          <option value="billed">Billed only</option>
        </select>
        <div style={{ fontSize: '11px', color: T.text3, fontFamily: 'monospace', marginLeft: 'auto' }}>
          {filtered.length} of {purchases.length}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
          ⚠ Couldn't load purchases: {error}
          <button onClick={refresh} style={{ marginLeft: '8px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, padding: '3px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Retry</button>
        </div>
      )}

      {/* Loading / List */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: T.text3, background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px' }}>
          <i className="ti ti-loader-2" style={{ fontSize: '28px', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '13px', marginTop: '12px' }}>Loading purchases...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState anyAtAll={purchases.length > 0} onAdd={openCreate} />
      ) : (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {/* Column headings (desktop) */}
          <div style={{ ...rowGrid, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            <div>Item / Supplier</div>
            <div>Category</div>
            <div>Job</div>
            <div style={{ textAlign: 'right' }}>Cost</div>
            <div style={{ textAlign: 'center' }}>Status</div>
            <div />
          </div>
          {filtered.map(p => (
            <PurchaseRow key={p.id} p={p} onEdit={openEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Form modal */}
      {formMode && (
        <PurchaseForm
          mode={formMode}
          initial={formInitial}
          onClose={() => setFormMode(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

// ============================================================
// STAT TILE
// ============================================================
function StatTile({ label, value, sub, color = T.text }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px', color }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

// ============================================================
// ROW
// ============================================================
const rowGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 2fr) 110px minmax(110px, 1.2fr) 110px 90px 76px',
  gap: '12px',
  alignItems: 'center',
}

function PurchaseRow({ p, onEdit, onDelete }) {
  const cat = CATEGORIES.find(c => c.key === p.category) || CATEGORIES[CATEGORIES.length - 1]
  const jobTagged = p.customer_name || p.vehicle_reg
  return (
    <div style={{ ...rowGrid, padding: '12px 16px', borderBottom: `0.5px solid ${T.border}`, fontSize: '13px' }}>
      {/* Item / supplier */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
        <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.supplier} · {fmtDate(p.purchase_date)}{p.supplier_ref ? ` · ref ${p.supplier_ref}` : ''}
        </div>
      </div>

      {/* Category */}
      <div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: cat.color }}>
          <i className={`ti ${cat.icon}`} style={{ fontSize: '12px' }} aria-hidden="true" /> {cat.label}
        </span>
      </div>

      {/* Job tag */}
      <div style={{ minWidth: 0 }}>
        {jobTagged ? (
          <div>
            <div style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customer_name || '—'}</div>
            {p.vehicle_reg && <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', marginTop: '1px' }}>{p.vehicle_reg}</div>}
          </div>
        ) : (
          <span style={{ fontSize: '11px', color: T.text3 }}>Workshop</span>
        )}
      </div>

      {/* Money */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{money(p.gross)}</div>
        <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace' }}>VAT {money(p.vat)}</div>
      </div>

      {/* Billed status */}
      <div style={{ textAlign: 'center' }}>
        {p.invoice_id ? (
          <span style={pill('rgba(76,175,80,0.12)', T.green)} title={`On invoice ${p.invoice_id}`}>
            <i className="ti ti-check" style={{ fontSize: '10px' }} aria-hidden="true" /> Billed
          </span>
        ) : jobTagged ? (
          <span style={pill('rgba(255,179,0,0.12)', T.amber)}>Unbilled</span>
        ) : p.payment_status === 'unpaid' ? (
          <span style={pill('rgba(229,57,53,0.12)', T.red)}>Unpaid</span>
        ) : (
          <span style={pill(T.surface3, T.text3)}>—</span>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
        <button onClick={() => onEdit(p)} style={iconBtn} title="Edit"><i className="ti ti-edit" /></button>
        <button onClick={() => onDelete(p)} style={{ ...iconBtn, color: T.red }} title="Delete"><i className="ti ti-trash" /></button>
      </div>
    </div>
  )
}

function pill(bg, color) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '2px 8px', borderRadius: '20px',
    fontSize: '10px', fontWeight: 600, fontFamily: 'monospace',
    background: bg, color,
  }
}

// ============================================================
// EMPTY STATE
// ============================================================
function EmptyState({ anyAtAll, onAdd }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '50px 20px', textAlign: 'center' }}>
      <i className="ti ti-shopping-cart" style={{ fontSize: '36px', color: T.text3, marginBottom: '12px' }} aria-hidden="true" />
      {anyAtAll ? (
        <>
          <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>No purchases match those filters</div>
          <div style={{ fontSize: '12px', color: T.text2 }}>Try clearing the search or changing the filters above</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>No purchases recorded yet</div>
          <div style={{ fontSize: '12px', color: T.text2, maxWidth: '420px', margin: '0 auto 16px' }}>
            Log what you buy from suppliers. Tag a customer and reg on job-specific purchases and they'll be waiting for you on the invoice form.
          </div>
          <button onClick={onAdd} style={primaryBtn}>
            <i className="ti ti-plus" aria-hidden="true" /> Add your first purchase
          </button>
        </>
      )}
    </div>
  )
}

// ============================================================
// PURCHASE FORM (create/edit)
// ============================================================
function PurchaseForm({ mode, initial, onClose, onSave }) {
  const customers = useStore(s => s.customers) || []
  const vehicles = useStore(s => s.vehicles) || []

  const [form, setForm] = useState(() => ({
    id: initial.id || null,
    supplier: initial.supplier || '',
    purchase_date: initial.purchase_date || todayStr(),
    description: initial.description || '',
    category: initial.category || 'parts',
    supplier_ref: initial.supplier_ref || '',
    notes: initial.notes || '',
    net: initial.net ?? '',
    vat: initial.vat ?? '',
    payment_status: initial.payment_status || 'paid',
    customer_id: initial.customer_id || '',
    customer_name: initial.customer_name || '',
    vehicle_reg: initial.vehicle_reg || '',
    invoice_id: initial.invoice_id || null,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Customer search (same pattern as the booking form)
  const [custQuery, setCustQuery] = useState(form.customer_name || '')
  const [showCustList, setShowCustList] = useState(false)
  const filteredCustomers = useMemo(() => {
    const q = custQuery.toLowerCase().trim()
    if (!q) return customers.slice(0, 20)
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.reg || '').toLowerCase().includes(q)
    ).slice(0, 20)
  }, [customers, custQuery])

  const customerVehicles = useMemo(() => {
    if (!form.customer_id) return []
    return vehicles.filter(v => v.customer_id === form.customer_id)
  }, [vehicles, form.customer_id])

  const pickCustomer = (c) => {
    setForm(f => ({ ...f, customer_id: c.id, customer_name: c.name, vehicle_reg: c.reg || '' }))
    setCustQuery(c.name)
    setShowCustList(false)
  }

  const clearCustomer = () => {
    setForm(f => ({ ...f, customer_id: '', customer_name: '', vehicle_reg: '' }))
    setCustQuery('')
  }

  // Money helpers
  const netNum = parseFloat(form.net) || 0
  const vatNum = parseFloat(form.vat) || 0
  const gross = Math.round((netNum + vatNum) * 100) / 100
  const setVat20 = () => setForm(f => ({ ...f, vat: (Math.round((parseFloat(f.net) || 0) * 20) / 100).toFixed(2) }))
  const setVat0 = () => setForm(f => ({ ...f, vat: '0.00' }))

  const submit = async () => {
    setError('')
    if (!form.supplier.trim()) { setError('Supplier is required'); return }
    if (!form.description.trim()) { setError('Description is required — what did you buy?'); return }
    if (!form.purchase_date) { setError('Date is required'); return }
    if (form.net === '' || isNaN(parseFloat(form.net))) { setError('Net amount is required (enter 0 if free)'); return }
    setSaving(true)
    try { await onSave(form) }
    catch (err) { setError(err.message || 'Failed to save'); setSaving(false) }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }} style={modalOverlay}>
      <div className="modal-content" style={{ ...modalCard, maxWidth: '540px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {mode === 'edit' ? 'Edit purchase' : 'New purchase'}
          </div>
          <button onClick={onClose} disabled={saving} style={closeXBtn}><i className="ti ti-x" /></button>
        </div>

        {form.invoice_id && (
          <div style={{ background: 'rgba(76,175,80,0.08)', border: `1px solid rgba(76,175,80,0.25)`, color: T.green, padding: '9px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            <i className="ti ti-check" aria-hidden="true" /> Already billed on invoice {form.invoice_id}. Money changes here won't update that invoice.
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {/* Supplier + date */}
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>Supplier *</div>
            <input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="e.g. Euro Car Parts" style={inputStyle} autoFocus />
          </div>
          <div>
            <div style={fieldLbl}>Date *</div>
            <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} style={inputStyle} />
          </div>
        </div>

        {/* Description + category */}
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>What did you buy? *</div>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Front brake pads — Bosch" style={inputStyle} />
          </div>
          <div>
            <div style={fieldLbl}>Category</div>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Money */}
        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <div style={fieldLbl}>Net (£) *</div>
              <input type="number" step="0.01" min="0" value={form.net} onChange={e => setForm(f => ({ ...f, net: e.target.value }))} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <div style={fieldLbl}>VAT (£)</div>
              <input type="number" step="0.01" min="0" value={form.vat} onChange={e => setForm(f => ({ ...f, vat: e.target.value }))} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <div style={fieldLbl}>Total</div>
              <div style={{ ...inputStyle, background: T.surface3, fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                {money(gross)}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace' }}>QUICK VAT:</span>
            <button onClick={setVat20} style={chipBtn}>20% of net</button>
            <button onClick={setVat0} style={chipBtn}>No VAT</button>
          </div>
        </div>

        {/* Job link (optional) */}
        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: T.text2, marginBottom: '10px' }}>
            <i className="ti ti-link" aria-hidden="true" /> <strong>Bought for a specific job?</strong> Tag the customer — it'll be offered when you raise their invoice. Leave blank for general workshop spend.
          </div>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <div style={fieldLbl}>Customer (optional)</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                value={custQuery}
                onChange={e => { setCustQuery(e.target.value); setShowCustList(true); setForm(f => ({ ...f, customer_id: '', customer_name: e.target.value })) }}
                onFocus={() => setShowCustList(true)}
                onBlur={() => setTimeout(() => setShowCustList(false), 150)}
                placeholder="Type to search customers"
                style={inputStyle}
              />
              {(form.customer_name || form.customer_id) && (
                <button onClick={clearCustomer} style={{ ...chipBtn, padding: '0 10px' }} title="Clear customer">✕</button>
              )}
            </div>
            {showCustList && filteredCustomers.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px',
                background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px',
                maxHeight: '180px', overflowY: 'auto',
              }}>
                {filteredCustomers.map(c => (
                  <div key={c.id} onMouseDown={() => pickCustomer(c)} style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
                    borderBottom: `0.5px solid ${T.border}`,
                  }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surface3}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', marginTop: '2px' }}>
                      {c.phone || c.email || ''} {c.reg ? `· ${c.reg}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={fieldLbl}>Vehicle</div>
            {customerVehicles.length > 0 ? (
              <select value={form.vehicle_reg || ''} onChange={e => setForm(f => ({ ...f, vehicle_reg: e.target.value }))} style={inputStyle}>
                <option value="">— No vehicle —</option>
                {customerVehicles.map(v => (
                  <option key={v.id} value={v.reg}>{v.reg} {v.make ? `· ${v.make}` : ''} {v.model || ''}</option>
                ))}
              </select>
            ) : (
              <input
                value={form.vehicle_reg}
                onChange={e => setForm(f => ({ ...f, vehicle_reg: e.target.value.toUpperCase() }))}
                placeholder="Vehicle reg (e.g. MK21 ABC)"
                style={{ ...inputStyle, textTransform: 'uppercase' }}
              />
            )}
          </div>
        </div>

        {/* Ref / paid / notes */}
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>Supplier invoice / receipt no.</div>
            <input value={form.supplier_ref} onChange={e => setForm(f => ({ ...f, supplier_ref: e.target.value }))} placeholder="Optional" style={inputStyle} />
          </div>
          <div>
            <div style={fieldLbl}>Payment</div>
            <select value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))} style={inputStyle}>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid (on account)</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={fieldLbl}>Notes</div>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" style={inputStyle} />
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : (mode === 'edit' ? 'Save changes' : 'Add purchase')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// STYLES (match Items.jsx)
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
const chipBtn = {
  background: T.surface3, color: T.text2, border: `1px solid ${T.border2}`,
  padding: '4px 10px', borderRadius: '6px',
  fontFamily: 'inherit', fontSize: '10px', cursor: 'pointer',
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
const selectStyle = {
  background: 'var(--surface2)', border: `1px solid ${T.border2}`, borderRadius: '8px',
  padding: '8px 10px', color: T.text, fontSize: '12px',
  fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
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
