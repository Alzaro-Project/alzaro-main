import { useState, useMemo, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import {
  usePurchases, PAYMENT_METHODS,
  uploadReceipt, removeReceiptObject, getReceiptSignedUrl,
} from '../hooks/usePurchases'
import RegLink from '../components/RegLink'

// ============================================================
// Purchases — full CRUD + receipts
// ------------------------------------------------------------
// One row per item bought, with an optional vehicle reg on
// job-specific spend; blank reg = general workshop spend.
// Legacy rows may still carry customer/invoice tags — they
// load and display fine, but the form no longer sets them.
// Receipts live in the private 'receipts' storage bucket;
// receipt_url holds the storage path, viewing uses signed URLs.
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

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Round half-up to 2dp. Goes via a 6dp string so binary noise like
// 0.825 * 100 === 82.49999999999999 still rounds up to 0.83.
function roundMoney(n) {
  return Math.round(Number((n * 100).toFixed(6))) / 100
}

// ---------- Payment method memory ----------
const LAST_METHOD_KEY = 'garageops_last_payment_method'

function getLastPaymentMethod() {
  try {
    const v = localStorage.getItem(LAST_METHOD_KEY)
    if (PAYMENT_METHODS.some(m => m.value === v)) return v
  } catch { /* ignore — private mode etc. */ }
  return 'business_debit_card'
}

function rememberPaymentMethod(v) {
  try { localStorage.setItem(LAST_METHOD_KEY, v) } catch { /* ignore */ }
}

// ---------- Receipt helpers ----------
const RECEIPT_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf'
const RECEIPT_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'pdf']
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024

function receiptExt(nameOrPath) {
  return (nameOrPath || '').split('.').pop().toLowerCase()
}

function receiptKind(nameOrPath) {
  return receiptExt(nameOrPath) === 'pdf' ? 'pdf' : 'image'
}

// "{garageId}/1723731123123_invoice.pdf" -> "invoice.pdf"
function receiptNameFromPath(path) {
  const last = (path || '').split('/').pop() || ''
  return last.replace(/^\d+_/, '') || 'receipt'
}

// ---------- Date-range filter ----------
const DATE_FILTERS = [
  { key: 'all',       label: 'All time' },
  { key: 'today',     label: 'Today' },
  { key: 'week',      label: 'This week' },
  { key: 'month',     label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: 'custom',    label: 'Custom…' },
]

function dateRangeFor(key, customFrom, customTo) {
  if (key === 'all') return null
  if (key === 'custom') {
    if (!customFrom && !customTo) return null
    return { from: customFrom || null, to: customTo || null }
  }
  const now = new Date()
  if (key === 'today') {
    const t = isoDate(now)
    return { from: t, to: t }
  }
  if (key === 'week') { // Monday–Sunday
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { from: isoDate(mon), to: isoDate(sun) }
  }
  if (key === 'month') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    }
  }
  if (key === 'lastmonth') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  return null
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
  const [methodFilter, setMethodFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // key from DATE_FILTERS
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [viewer, setViewer] = useState(null) // { url, revoke? } — image overlay
  const isMobile = useIsMobile()

  // Global search can deep-link here with ?q=… (e.g. a car reg)
  const location = useLocation()
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q')
    if (q) setSearch(q)
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Receipt viewing ----------
  const openReceiptPath = async (path) => {
    try {
      if (receiptKind(path) === 'pdf') {
        // open the tab synchronously (inside the click) so popup blockers allow it
        const w = window.open('', '_blank')
        try {
          const url = await getReceiptSignedUrl(path)
          if (w) w.location = url
          else window.open(url, '_blank', 'noopener')
        } catch (err) {
          if (w) w.close()
          throw err
        }
      } else {
        const url = await getReceiptSignedUrl(path)
        setViewer({ url })
      }
    } catch (err) {
      alert('Could not open receipt: ' + (err.message || err))
    }
  }
  const closeViewer = () => {
    if (viewer?.revoke) URL.revokeObjectURL(viewer.url)
    setViewer(null)
  }

  // ---------- Autocomplete pools (distinct, most-recent first) ----------
  const supplierSuggestions = useMemo(() => {
    const seen = new Set(), out = []
    purchases.forEach(p => { // purchases are date-desc, so first hit = most recent
      const s = (p.supplier || '').trim()
      if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s) }
    })
    return out
  }, [purchases])

  const regSuggestions = useMemo(() => {
    const seen = new Set(), out = []
    purchases.forEach(p => {
      const v = (p.vehicle_reg || '').trim().toUpperCase()
      if (v && !seen.has(v)) { seen.add(v); out.push(v) }
    })
    return out
  }, [purchases])

  // ---------- Stats ----------
  const stats = useMemo(() => {
    const now = new Date()
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let monthGross = 0, monthVat = 0
    purchases.forEach(p => {
      if ((p.purchase_date || '').startsWith(monthPrefix)) {
        monthGross += Number(p.gross) || 0
        monthVat += Number(p.vat) || 0
      }
    })
    return { monthGross, monthVat }
  }, [purchases])

  // ---------- Filtering ----------
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const range = dateRangeFor(dateFilter, customFrom, customTo)
    return purchases.filter(p => {
      if (catFilter !== 'all' && p.category !== catFilter) return false
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false
      if (range) {
        const d = p.purchase_date || ''
        if (range.from && d < range.from) return false
        if (range.to && d > range.to) return false
      }
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
  }, [purchases, search, catFilter, methodFilter, dateFilter, customFrom, customTo])

  const anyFilterActive =
    search.trim() !== '' || catFilter !== 'all' ||
    methodFilter !== 'all' || dateFilter !== 'all'

  const filteredTotals = useMemo(() => {
    let net = 0, vat = 0, gross = 0
    filtered.forEach(p => {
      net += Number(p.net) || 0
      vat += Number(p.vat) || 0
      gross += Number(p.gross) || 0
    })
    return { net, vat, gross }
  }, [filtered])

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
        mileage: (() => { const n = parseInt(data.mileage, 10); return Number.isFinite(n) && n >= 0 ? n : null })(),
        net, vat, gross: Math.round((net + vat) * 100) / 100,
        payment_status: data.payment_status,
        payment_method: data.payment_method || null,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name || null,
        vehicle_reg: data.vehicle_reg ? data.vehicle_reg.toUpperCase() : null,
        receipt_url: data.receipt_url || null,
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
            Everything you buy from suppliers — receipts, VAT and spend in one place
          </div>
        </div>
        <button onClick={openCreate} style={primaryBtn}>
          <i className="ti ti-plus" aria-hidden="true" /> Add purchase
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatTile label="Spend this month" value={money(stats.monthGross)} sub="inc. VAT" />
        <StatTile label="VAT this month" value={money(stats.monthVat)} sub="reclaimable" color={T.teal} />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px', padding: '8px 12px', flex: '1 1 220px', maxWidth: '340px' }}>
          <i className="ti ti-search" style={{ color: T.text3, fontSize: '14px' }} aria-hidden="true" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search supplier, item, reg..."
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
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} style={selectStyle}>
          <option value="all">All payment methods</option>
          {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={selectStyle}>
          {DATE_FILTERS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        {dateFilter === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={selectStyle} title="From" />
            <span style={{ fontSize: '11px', color: T.text3 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={selectStyle} title="To" />
          </>
        )}
        <div style={{ fontSize: '11px', color: T.text3, fontFamily: 'monospace', marginLeft: 'auto' }}>
          {filtered.length} of {purchases.length}
        </div>
      </div>

      {/* Filtered totals */}
      {anyFilterActive && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
          background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '10px',
          padding: '8px 14px', marginBottom: '12px', fontSize: '12px', fontFamily: 'monospace',
        }}>
          <span style={{ fontSize: '10px', color: T.text3, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Filtered total</span>
          <span>Net <strong>{money(filteredTotals.net)}</strong></span>
          <span style={{ color: T.text3 }}>·</span>
          <span>VAT <strong>{money(filteredTotals.vat)}</strong></span>
          <span style={{ color: T.text3 }}>·</span>
          <span>Gross <strong>{money(filteredTotals.gross)}</strong></span>
        </div>
      )}

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
          {/* Column headings (desktop only) */}
          {!isMobile && (
            <div style={{ ...rowGrid, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              <div>Reg / Supplier</div>
              <div>Category</div>
              <div>Item</div>
              <div style={{ textAlign: 'right' }}>Cost</div>
              <div style={{ textAlign: 'center' }}>Paid via</div>
              <div style={{ textAlign: 'center' }}>Status</div>
              <div />
            </div>
          )}
          {filtered.map(p => isMobile ? (
            <MobilePurchaseCard key={p.id} p={p} onEdit={openEdit} onDelete={handleDelete} onViewReceipt={openReceiptPath} />
          ) : (
            <PurchaseRow key={p.id} p={p} onEdit={openEdit} onDelete={handleDelete} onViewReceipt={openReceiptPath} />
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
          supplierSuggestions={supplierSuggestions}
          regSuggestions={regSuggestions}
          onViewReceiptPath={openReceiptPath}
          onPreviewLocalImage={url => setViewer({ url, revoke: true })}
          viewerOpen={!!viewer}
        />
      )}

      {/* Receipt image overlay */}
      {viewer && <ReceiptViewer url={viewer.url} onClose={closeViewer} />}
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
  gridTemplateColumns: 'minmax(160px, 2fr) 100px minmax(110px, 1.2fr) 110px 90px 90px 100px',
  gap: '12px',
  alignItems: 'center',
}

function PurchaseRow({ p, onEdit, onDelete, onViewReceipt }) {
  const cat = CATEGORIES.find(c => c.key === p.category) || CATEGORIES[CATEGORIES.length - 1]
  const jobTagged = p.customer_name || p.vehicle_reg
  const method = PAYMENT_METHODS.find(m => m.value === p.payment_method)
  return (
    <div style={{ ...rowGrid, padding: '12px 16px', borderBottom: `0.5px solid ${T.border}`, fontSize: '13px' }}>
      {/* Reg / supplier */}
      <div style={{ minWidth: 0 }}>
        {p.vehicle_reg ? (
          <div style={{ fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <RegLink reg={p.vehicle_reg} />
            {p.mileage != null && (
              <span style={{ fontWeight: 400, fontSize: '10px', color: T.text3, marginLeft: '6px' }}>{Number(p.mileage).toLocaleString('en-GB')} mi</span>
            )}
          </div>
        ) : (
          <div style={{ fontWeight: 500, color: T.text3 }}>Workshop</div>
        )}
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

      {/* Item */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
        {p.customer_name && (
          <div style={{ fontSize: '10px', color: T.text3, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.customer_name}</div>
        )}
      </div>

      {/* Money */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{money(p.gross)}</div>
        <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace' }}>VAT {money(p.vat)}</div>
      </div>

      {/* Payment method */}
      <div style={{ textAlign: 'center' }}>
        {method ? (
          <span style={pill(T.surface3, T.text2)} title={method.label}>{method.short}</span>
        ) : (
          <span style={{ fontSize: '11px', color: T.text3 }}>—</span>
        )}
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
        {p.receipt_url && (
          <button onClick={() => onViewReceipt(p.receipt_url)} style={{ ...iconBtn, color: T.teal }} title="View receipt"><i className="ti ti-receipt" /></button>
        )}
        <button onClick={() => onEdit(p)} style={iconBtn} title="Edit"><i className="ti ti-edit" /></button>
        <button onClick={() => onDelete(p)} style={{ ...iconBtn, color: T.red }} title="Delete"><i className="ti ti-trash" /></button>
      </div>
    </div>
  )
}

// ============================================================
// MOBILE CARD — stacked layout replacing the 7-column row
// ============================================================
function MobilePurchaseCard({ p, onEdit, onDelete, onViewReceipt }) {
  const cat = CATEGORIES.find(c => c.key === p.category) || CATEGORIES[CATEGORIES.length - 1]
  const jobTagged = p.customer_name || p.vehicle_reg
  const method = PAYMENT_METHODS.find(m => m.value === p.payment_method)
  return (
    <div style={{ padding: '12px 14px', borderBottom: `0.5px solid ${T.border}`, fontSize: '13px' }}>
      {/* Reg + cost */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
        {p.vehicle_reg ? (
          <span style={{ fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
            <RegLink reg={p.vehicle_reg} />
            {p.mileage != null && (
              <span style={{ fontWeight: 400, fontSize: '10px', color: T.text3, marginLeft: '6px' }}>{Number(p.mileage).toLocaleString('en-GB')} mi</span>
            )}
          </span>
        ) : (
          <span style={{ fontWeight: 500, color: T.text3 }}>Workshop</span>
        )}
        <span style={{ textAlign: 'right', flexShrink: 0 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{money(p.gross)}</span>
          <span style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', marginLeft: '6px' }}>VAT {money(p.vat)}</span>
        </span>
      </div>

      {/* Item */}
      <div style={{ fontSize: '12px', fontWeight: 500, marginTop: '4px' }}>{p.description}</div>

      {/* Supplier · date · ref */}
      <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px' }}>
        {p.supplier} · {fmtDate(p.purchase_date)}{p.supplier_ref ? ` · ref ${p.supplier_ref}` : ''}
      </div>

      {/* Pills + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: cat.color }}>
          <i className={`ti ${cat.icon}`} style={{ fontSize: '12px' }} aria-hidden="true" /> {cat.label}
        </span>
        {method && <span style={pill(T.surface3, T.text2)}>{method.short}</span>}
        {p.invoice_id ? (
          <span style={pill('rgba(76,175,80,0.12)', T.green)} title={`On invoice ${p.invoice_id}`}>
            <i className="ti ti-check" style={{ fontSize: '10px' }} aria-hidden="true" /> Billed
          </span>
        ) : jobTagged ? (
          <span style={pill('rgba(255,179,0,0.12)', T.amber)}>Unbilled</span>
        ) : p.payment_status === 'unpaid' ? (
          <span style={pill('rgba(229,57,53,0.12)', T.red)}>Unpaid</span>
        ) : null}
        <span style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          {p.receipt_url && (
            <button onClick={() => onViewReceipt(p.receipt_url)} style={{ ...iconBtn, color: T.teal }} title="View receipt"><i className="ti ti-receipt" /></button>
          )}
          <button onClick={() => onEdit(p)} style={iconBtn} title="Edit"><i className="ti ti-edit" /></button>
          <button onClick={() => onDelete(p)} style={{ ...iconBtn, color: T.red }} title="Delete"><i className="ti ti-trash" /></button>
        </span>
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
            Log what you buy from suppliers. Add a vehicle reg on job-specific purchases; leave it blank for general workshop spend.
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
function PurchaseForm({
  mode, initial, onClose, onSave,
  supplierSuggestions = [], regSuggestions = [],
  onViewReceiptPath, onPreviewLocalImage, viewerOpen,
}) {
  const garageId = useStore(s => s.garageId)

  // customer_id / customer_name / invoice_id are pass-through only: the
  // form no longer sets them, but keeping them in state means editing a
  // legacy row preserves its existing tags instead of nulling them.
  const [form, setForm] = useState(() => ({
    id: initial.id || null,
    supplier: initial.supplier || '',
    purchase_date: initial.purchase_date || todayStr(),
    description: initial.description || '',
    category: initial.category || 'parts',
    supplier_ref: initial.supplier_ref || '',
    notes: initial.notes || '',
    mileage: initial.mileage ?? '',
    net: initial.net ?? '',
    vat: initial.vat ?? '',
    payment_status: initial.payment_status || 'paid',
    payment_method: initial.payment_method || getLastPaymentMethod(),
    customer_id: initial.customer_id || '',
    customer_name: initial.customer_name || '',
    vehicle_reg: initial.vehicle_reg || '',
    invoice_id: initial.invoice_id || null,
    receipt_url: initial.receipt_url || null,
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Receipt state — the file only uploads on Save, so a failed upload
  // never costs the user their typed data.
  const [receiptFile, setReceiptFile] = useState(null)
  const [removeReceipt, setRemoveReceipt] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const fileInputRef = useRef(null)

  // Dirty check for Esc-to-close (Feature 6)
  const [initialJson] = useState(() => JSON.stringify(form))
  const isDirty = () => JSON.stringify(form) !== initialJson || receiptFile !== null || removeReceipt

  // ---------- Money (net or gross entry) ----------
  const [amountMode, setAmountMode] = useState('net') // 'net' | 'gross'
  const [grossInput, setGrossInput] = useState('')
  const [grossVatRate, setGrossVatRate] = useState('20') // '20' | '5' | '0'

  const netNum = parseFloat(form.net) || 0
  const vatNum = parseFloat(form.vat) || 0
  const gross = Math.round((netNum + vatNum) * 100) / 100

  // Net mode: one-shot quick-VAT chips
  const setVat20 = () => setForm(f => ({ ...f, vat: roundMoney((parseFloat(f.net) || 0) * 0.2).toFixed(2) }))
  const setVat5 = () => setForm(f => ({ ...f, vat: roundMoney((parseFloat(f.net) || 0) * 0.05).toFixed(2) }))
  const setVat0 = () => setForm(f => ({ ...f, vat: '0.00' }))

  // Gross mode: back-calculate so net + vat always equals gross exactly
  const applyGross = (grossStr, rate) => {
    setGrossInput(grossStr)
    setGrossVatRate(rate)
    const g = parseFloat(grossStr)
    if (!Number.isFinite(g)) { setForm(f => ({ ...f, net: '', vat: '' })); return }
    const grossR = roundMoney(g)
    const divisor = rate === '20' ? 1.2 : rate === '5' ? 1.05 : 1
    const net = roundMoney(grossR / divisor)
    const vat = roundMoney(grossR - net) // absorbs any rounding penny
    setForm(f => ({ ...f, net: net.toFixed(2), vat: vat.toFixed(2) }))
  }

  const switchAmountMode = (m) => {
    if (m === amountMode) return
    setAmountMode(m)
    if (m === 'gross') {
      // prefill from current values; don't recompute until the user edits
      setGrossInput(gross > 0 ? gross.toFixed(2) : '')
      const ratio = netNum > 0 ? vatNum / netNum : null
      setGrossVatRate(
        ratio !== null && Math.abs(ratio - 0.05) < 0.005 ? '5'
          : netNum > 0 && vatNum === 0 ? '0'
          : '20'
      )
    }
  }

  // ---------- Receipt ----------
  const currentReceiptName = receiptFile
    ? receiptFile.name
    : (!removeReceipt && form.receipt_url ? receiptNameFromPath(form.receipt_url) : null)

  const pickReceiptFile = () => fileInputRef.current?.click()

  const onReceiptPicked = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // so re-picking the same file fires onChange again
    if (!file) return
    if (!RECEIPT_EXTS.includes(receiptExt(file.name))) {
      setFieldErrors(fe => ({ ...fe, receipt: 'Use a jpg, png, webp or pdf file' }))
      return
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      setFieldErrors(fe => ({ ...fe, receipt: 'File is too big — 10MB max' }))
      return
    }
    setFieldErrors(fe => ({ ...fe, receipt: undefined }))
    setReceiptFile(file)
    setRemoveReceipt(false)
  }

  const clearReceipt = () => {
    setReceiptFile(null)
    if (form.receipt_url) setRemoveReceipt(true)
    setFieldErrors(fe => ({ ...fe, receipt: undefined }))
  }

  const viewReceipt = () => {
    if (receiptFile) {
      const url = URL.createObjectURL(receiptFile)
      if (receiptKind(receiptFile.name) === 'pdf') {
        window.open(url, '_blank', 'noopener')
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } else {
        onPreviewLocalImage?.(url)
      }
    } else if (form.receipt_url) {
      onViewReceiptPath?.(form.receipt_url)
    }
  }

  // ---------- Save ----------
  const submit = async () => {
    if (saving) return
    setError('')
    const errs = {}
    if (!form.supplier.trim()) errs.supplier = 'Supplier is required'
    if (!form.description.trim()) errs.description = 'Required — what did you buy?'
    if (!form.purchase_date || isNaN(new Date(form.purchase_date).getTime())) errs.purchase_date = 'Enter a valid date'
    if (amountMode === 'gross') {
      const g = parseFloat(grossInput)
      if (grossInput === '' || isNaN(g) || g < 0) errs.amount = 'Gross amount is required (enter 0 if free)'
    } else {
      const n = parseFloat(form.net)
      if (form.net === '' || isNaN(n) || n < 0) errs.amount = 'Net amount is required (enter 0 if free)'
    }
    if (!form.payment_method) errs.payment_method = 'Choose a payment method'
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSaving(true)
    let uploadedPath = null
    try {
      let receiptPath = removeReceipt ? null : (form.receipt_url || null)
      if (receiptFile) {
        setUploadingReceipt(true)
        try {
          uploadedPath = await uploadReceipt(garageId, receiptFile)
          receiptPath = uploadedPath
        } catch (err) {
          setFieldErrors(fe => ({ ...fe, receipt: `Upload failed: ${err.message || err}. Your details are still here — try again or remove the file.` }))
          setUploadingReceipt(false)
          setSaving(false)
          return
        }
        setUploadingReceipt(false)
      }

      await onSave({ ...form, receipt_url: receiptPath })
      rememberPaymentMethod(form.payment_method)

      // best-effort: the replaced/removed old file is no longer referenced
      const oldPath = initial.receipt_url
      if (oldPath && oldPath !== receiptPath) {
        removeReceiptObject(oldPath).catch(err => console.error('old receipt cleanup failed:', err))
      }
    } catch (err) {
      // save failed after a successful upload — don't leave an orphaned file
      if (uploadedPath) removeReceiptObject(uploadedPath).catch(() => {})
      setError(err.message || 'Failed to save')
      setSaving(false)
    }
  }

  // ---------- Keyboard: Esc closes (confirm if dirty), Ctrl/Cmd+Enter saves ----------
  const attemptClose = () => {
    if (saving) return
    if (isDirty() && !window.confirm('Discard unsaved changes?')) return
    onClose()
  }

  const keysRef = useRef(null)
  keysRef.current = { attemptClose, submit, viewerOpen }
  useEffect(() => {
    const onKey = (e) => {
      const k = keysRef.current
      if (e.key === 'Escape') {
        if (!k.viewerOpen) { e.preventDefault(); k.attemptClose() } // viewer's own Esc wins while open
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        k.submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
            <SuggestInput
              value={form.supplier}
              onChange={v => setForm(f => ({ ...f, supplier: v }))}
              suggestions={supplierSuggestions}
              placeholder="e.g. Euro Car Parts"
              autoFocus
              dropdown
              dropdownHint="Previous suppliers · or type a new one"
            />
            {fieldErrors.supplier && <div style={fieldErr}>{fieldErrors.supplier}</div>}
          </div>
          <div>
            <div style={fieldLbl}>Date *</div>
            <input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} style={inputStyle} />
            {fieldErrors.purchase_date && <div style={fieldErr}>{fieldErrors.purchase_date}</div>}
          </div>
        </div>

        {/* Car registration + category */}
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>Car registration</div>
            <SuggestInput
              value={form.vehicle_reg}
              onChange={v => setForm(f => ({ ...f, vehicle_reg: v.toUpperCase() }))}
              suggestions={regSuggestions}
              placeholder="e.g. MK21 ABC — blank = workshop"
              inputStyleExtra={{ textTransform: 'uppercase' }}
              dropdown
            />
          </div>
          <div>
            <div style={fieldLbl}>Category</div>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Description + mileage */}
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>What did you buy? *</div>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Front brake pads — Bosch" style={inputStyle} />
            {fieldErrors.description && <div style={fieldErr}>{fieldErrors.description}</div>}
          </div>
          <div>
            <div style={fieldLbl}>Mileage</div>
            <input
              type="number" min="0" step="1"
              value={form.mileage}
              onChange={e => setForm(f => ({ ...f, mileage: e.target.value.replace(/[^\d]/g, '') }))}
              placeholder="Optional"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Money */}
        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace' }}>AMOUNT IS:</span>
            <button onClick={() => switchAmountMode('net')} style={amountMode === 'net' ? chipBtnActive : chipBtn}>Net</button>
            <button onClick={() => switchAmountMode('gross')} style={amountMode === 'gross' ? chipBtnActive : chipBtn}>Gross</button>
          </div>

          {amountMode === 'net' ? (
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
          ) : (
            <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <div style={fieldLbl}>Gross (£) *</div>
                <input type="number" step="0.01" min="0" value={grossInput} onChange={e => applyGross(e.target.value, grossVatRate)} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <div style={fieldLbl}>Net</div>
                <div style={{ ...inputStyle, background: T.surface3, fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                  {money(form.net)}
                </div>
              </div>
              <div>
                <div style={fieldLbl}>VAT</div>
                <div style={{ ...inputStyle, background: T.surface3, fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
                  {money(form.vat)}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace' }}>QUICK VAT:</span>
            {amountMode === 'net' ? (
              <>
                <button onClick={setVat20} style={chipBtn}>20% of net</button>
                <button onClick={setVat5} style={chipBtn}>5% of net</button>
                <button onClick={setVat0} style={chipBtn}>No VAT</button>
              </>
            ) : (
              <>
                <button onClick={() => applyGross(grossInput, '20')} style={grossVatRate === '20' ? chipBtnActive : chipBtn}>Includes 20%</button>
                <button onClick={() => applyGross(grossInput, '5')} style={grossVatRate === '5' ? chipBtnActive : chipBtn}>Includes 5%</button>
                <button onClick={() => applyGross(grossInput, '0')} style={grossVatRate === '0' ? chipBtnActive : chipBtn}>No VAT</button>
              </>
            )}
          </div>
          {fieldErrors.amount && <div style={fieldErr}>{fieldErrors.amount}</div>}
        </div>

        {/* Supplier ref */}
        <div style={{ marginBottom: '12px' }}>
          <div style={fieldLbl}>Supplier invoice / receipt no.</div>
          <input value={form.supplier_ref} onChange={e => setForm(f => ({ ...f, supplier_ref: e.target.value }))} placeholder="Optional" style={inputStyle} />
        </div>

        {/* Paid / payment method */}
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>Payment</div>
            <select value={form.payment_status} onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))} style={inputStyle}>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid (on account)</option>
            </select>
          </div>
          <div>
            <div style={fieldLbl}>Payment method *</div>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={inputStyle}>
              {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {fieldErrors.payment_method && <div style={fieldErr}>{fieldErrors.payment_method}</div>}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '12px' }}>
          <div style={fieldLbl}>Notes</div>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" style={inputStyle} />
        </div>

        {/* Receipt */}
        <div style={{ marginBottom: '18px' }}>
          <div style={fieldLbl}>Receipt</div>
          {currentReceiptName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px', padding: '7px 12px' }}>
              <i className="ti ti-receipt" style={{ color: T.teal, fontSize: '15px' }} aria-hidden="true" />
              <span style={{ fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentReceiptName}>
                {currentReceiptName}
              </span>
              <button onClick={viewReceipt} disabled={saving} style={chipBtn}>View</button>
              <button onClick={pickReceiptFile} disabled={saving} style={chipBtn}>Replace</button>
              <button onClick={clearReceipt} disabled={saving} style={{ ...chipBtn, color: T.red }}>Remove</button>
            </div>
          ) : (
            <button onClick={pickReceiptFile} disabled={saving} style={ghostBtn}>
              <i className="ti ti-upload" aria-hidden="true" /> Upload receipt
              <span style={{ fontSize: '10px', color: T.text3 }}>jpg / png / pdf</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept={RECEIPT_ACCEPT} onChange={onReceiptPicked} style={{ display: 'none' }} />
          {fieldErrors.receipt && <div style={fieldErr}>{fieldErrors.receipt}</div>}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {uploadingReceipt ? 'Uploading receipt…' : saving ? 'Saving...' : (mode === 'edit' ? 'Save changes' : 'Add purchase')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SUGGEST INPUT — free-text input with a history dropdown
// ------------------------------------------------------------
// Keyboard: arrows move, Enter picks, Esc closes the list
// (without closing the modal). Typing a brand-new value is
// always fine — the list is just a shortcut.
// ============================================================
function SuggestInput({ value, onChange, suggestions, placeholder, autoFocus, inputStyleExtra, dropdown, dropdownHint }) {
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(-1)

  const matches = useMemo(() => {
    const q = (value || '').toLowerCase().trim()
    const pool = q
      ? suggestions.filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      : suggestions
    return pool.slice(0, 8)
  }, [suggestions, value])

  const pick = (s) => {
    onChange(s)
    setOpen(false)
    setIdx(-1)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setIdx(i => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (open && idx >= 0 && matches[idx]) { e.preventDefault(); pick(matches[idx]) }
      else setOpen(false)
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false); setIdx(-1) } // keep the modal open
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setIdx(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ ...inputStyle, ...(dropdown ? { paddingRight: '28px' } : {}), ...inputStyleExtra }}
      />
      {dropdown && (
        <span
          onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
          style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: T.text3, fontSize: '9px', cursor: 'pointer', userSelect: 'none' }}
        >
          {open ? '▲' : '▼'}
        </span>
      )}
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px',
          background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px',
          maxHeight: '180px', overflowY: 'auto',
        }}>
          {dropdown && dropdownHint && (
            <div style={{ padding: '6px 12px', fontSize: '9px', color: T.text3, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `0.5px solid ${T.border}`, background: T.surface3 }}>
              {dropdownHint}
            </div>
          )}
          {matches.map((s, i) => (
            <div
              key={s}
              onMouseDown={() => pick(s)}
              onMouseEnter={() => setIdx(i)}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: '12px',
                borderBottom: `0.5px solid ${T.border}`,
                background: i === idx ? T.surface3 : 'transparent',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// RECEIPT VIEWER — in-app image overlay (PDFs open in a tab)
// ============================================================
function ReceiptViewer({ url, onClose }) {
  useEffect(() => {
    // capture phase + stopPropagation so the purchase modal's own
    // Esc handler doesn't fire while the viewer is on top
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
    >
      <button
        onClick={onClose}
        title="Close"
        style={{ ...closeXBtn, position: 'absolute', top: '14px', right: '18px', color: '#fff', zIndex: 1 }}
      >
        <i className="ti ti-x" />
      </button>
      <img
        src={url}
        alt="Receipt"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }}
      />
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
const chipBtnActive = {
  ...chipBtn,
  background: T.red, color: '#fff', border: `1px solid ${T.red}`,
  fontWeight: 600,
}
const fieldErr = {
  fontSize: '10px', color: T.red, marginTop: '4px',
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
