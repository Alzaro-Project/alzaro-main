import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useIsMobile } from '../hooks/useIsMobile'
import { supabase } from '../lib/supabase'

// ============================================================
// Database — vehicle history lookup (replaces Stock)
// ------------------------------------------------------------
// Search any car reg and see everything the garage knows about
// it: the owner, every invoice (sales), every purchase (parts
// bought for it) and every booking (when it came in and why).
// Pulls invoices + customers from the store, and fetches
// purchases + bookings straight from Supabase.
// Global search deep-links here with ?reg=…
// ============================================================

const T = {
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
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
}

const BOOKING_STATUS = {
  booked: { label: 'Booked', color: T.blue },
  in_progress: { label: 'In progress', color: T.amber },
  complete: { label: 'Complete', color: T.green },
  cancelled: { label: 'Cancelled', color: T.text3 },
  no_show: { label: 'No show', color: T.red },
}

const INVOICE_STATUS = {
  draft: { label: 'Draft', color: T.text3 },
  sent: { label: 'Sent', color: T.blue },
  paid: { label: 'Paid', color: T.green },
  overdue: { label: 'Overdue', color: T.red },
}

function money(n) { return `£${(Number(n) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function normReg(r) { return (r || '').replace(/\s+/g, '').toUpperCase() }
function fmtDate(d) {
  if (!d) return '—'
  const dt = new Date(String(d).length === 10 ? d + 'T00:00:00' : d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Invoice total inc. VAT — same maths as the dashboard tiles.
// Uses the invoice's stored vat_rate (old invoices default to 20).
function invoiceTotal(inv) {
  const rate = (inv.vatRate != null ? Number(inv.vatRate) : 20) / 100
  return (inv.lines || []).reduce((sum, l) => {
    const lineTotal = (l.qty || 0) * (l.unit || 0)
    const vat = l.lineType === 'used' && l.marginScheme
      ? (l.qty || 0) * ((l.unit || 0) - (l.cost || 0)) * 0.2
      : (inv.vatScheme === 'standard' ? lineTotal * rate : 0)
    return sum + lineTotal + vat
  }, 0)
}

// ============================================================
// MAIN
// ============================================================
export default function Database() {
  const navigate = useNavigate()
  const location = useLocation()
  const { invoices, customers, garageId, vehicles: dbVehicles } = useStore()

  const [query, setQuery] = useState('')
  const [purchases, setPurchases] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ---------- LOAD purchases + bookings ----------
  useEffect(() => {
    if (!garageId) { setLoading(false); return }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [pRes, bRes] = await Promise.all([
          supabase.from('purchases').select('*').eq('account_id', garageId)
            .order('purchase_date', { ascending: false }),
          supabase.from('bookings').select('*').eq('account_id', garageId)
            .order('booking_date', { ascending: false }),
        ])
        if (pRes.error) throw pRes.error
        if (bRes.error) throw bRes.error
        if (!cancelled) {
          setPurchases(pRes.data || [])
          setBookings(bRes.data || [])
        }
      } catch (err) {
        console.error('Database:', err)
        if (!cancelled) setError(err.message || 'Failed to load vehicle history')
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [garageId])

  // ---------- Deep link ?reg=… (from global search) ----------
  useEffect(() => {
    const reg = new URLSearchParams(location.search).get('reg')
    if (reg) setQuery(reg.toUpperCase())
  }, [location.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Build the vehicle index ----------
  const vehicles = useMemo(() => {
    const map = new Map() // normReg -> vehicle record
    const ensure = (rawReg) => {
      const key = normReg(rawReg)
      if (!key) return null
      if (!map.has(key)) {
        map.set(key, {
          key, reg: (rawReg || '').toUpperCase().trim(),
          owner: null, make: '', model: '',
          vehicleRow: null, ownerLocked: false,
          invoices: [], purchases: [], bookings: [],
          lastActivity: '',
        })
      }
      return map.get(key)
    }
    const bump = (v, date) => { if (date && date > v.lastActivity) v.lastActivity = date }

    // Vehicles table first — the editable source of truth for
    // make/model/owner ("Edit details" writes here). An explicit
    // row decides ownership even when it says "no owner".
    dbVehicles.forEach(vr => {
      const v = ensure(vr.reg)
      if (!v) return
      v.vehicleRow = vr
      if (vr.make) v.make = vr.make
      if (vr.model) v.model = vr.model
      v.owner = vr.customerId ? (customers.find(c => c.id === vr.customerId) || null) : null
      v.ownerLocked = true
    })

    // Customers next — they carry the owner + make/model for regs
    // that only live on customer records
    customers.forEach(c => {
      const regs = []
      if (c.reg) regs.push({ reg: c.reg, make: '', model: c.vehicle || '' })
      ;(c.vehicles || []).forEach(vh => { if (vh.reg) regs.push(vh) })
      regs.forEach(vh => {
        const v = ensure(vh.reg)
        if (!v) return
        if (!v.owner && !v.ownerLocked) v.owner = c
        if (!v.make && vh.make) v.make = vh.make
        if (!v.model && vh.model) v.model = vh.model
      })
    })

    invoices.forEach(inv => {
      const v = ensure(inv.reg)
      if (!v) return
      v.invoices.push(inv)
      bump(v, inv.date || '')
      if (!v.owner && !v.ownerLocked && inv.custId) v.owner = customers.find(c => c.id === inv.custId) || null
    })

    purchases.forEach(p => {
      const v = ensure(p.vehicle_reg)
      if (!v) return
      v.purchases.push(p)
      bump(v, p.purchase_date || '')
    })

    bookings.forEach(b => {
      const v = ensure(b.vehicle_reg)
      if (!v) return
      v.bookings.push(b)
      bump(v, b.booking_date || '')
    })

    return Array.from(map.values())
      .sort((a, b) => (b.lastActivity || '').localeCompare(a.lastActivity || ''))
  }, [customers, invoices, purchases, bookings, dbVehicles])

  // ---------- Search ----------
  const q = normReg(query)
  const matches = q ? vehicles.filter(v => v.key.includes(q)) : vehicles
  const exact = q ? vehicles.find(v => v.key === q) : null
  const selected = exact || (q && matches.length === 1 ? matches[0] : null)

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }} className="page-header">
        <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Database</div>
        <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
          Search any car reg — every invoice, purchase and booking for that vehicle in one place
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: T.surface, border: `1px solid ${T.border2}`, borderRadius: '12px', padding: '13px 16px', marginBottom: '16px', maxWidth: '460px' }}>
        <i className="ti ti-search" style={{ color: T.text3, fontSize: '16px' }} aria-hidden="true" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value.toUpperCase())}
          placeholder="Search a car reg — e.g. MK21 ABC"
          autoFocus
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: T.text, fontSize: '14px', fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: T.text3, cursor: 'pointer', padding: 0, fontSize: '13px' }}>✕</button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: T.text3, background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px' }}>
          <i className="ti ti-loader-2" style={{ fontSize: '28px', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '13px', marginTop: '12px' }}>Loading vehicle history...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      ) : selected ? (
        <VehicleDetail v={selected} navigate={navigate} />
      ) : (
        <VehicleList vehicles={matches} query={query} onPick={v => setQuery(v.reg)} />
      )}
    </div>
  )
}

// ============================================================
// VEHICLE LIST — all known regs (or partial matches)
// ============================================================
function VehicleList({ vehicles, query, onPick }) {
  const isMobile = useIsMobile()
  if (vehicles.length === 0) {
    return (
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '50px 20px', textAlign: 'center' }}>
        <i className="ti ti-database" style={{ fontSize: '36px', color: T.text3, marginBottom: '12px' }} aria-hidden="true" />
        {query ? (
          <>
            <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>No history for "{query}"</div>
            <div style={{ fontSize: '12px', color: T.text2 }}>
              A vehicle appears here once it's on an invoice, purchase, booking or customer record
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '6px' }}>No vehicles yet</div>
            <div style={{ fontSize: '12px', color: T.text2 }}>
              Add a reg to invoices, purchases or bookings and every vehicle shows up here automatically
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div style={{ fontSize: '12px', color: T.text2, marginBottom: '10px' }}>
        {query ? `${vehicles.length} match${vehicles.length === 1 ? '' : 'es'} — tap one to open it` : `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} known — tap one to see its full history`}
      </div>
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        {!isMobile && (
          <div style={{ ...listGrid, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            <div>Reg / Owner</div>
            <div style={{ textAlign: 'center' }}>Purchases</div>
            <div style={{ textAlign: 'right' }}>Last activity</div>
          </div>
        )}
        {vehicles.map(v => isMobile ? (
          <div
            key={v.key}
            onClick={() => onPick(v)}
            style={{ padding: '12px 14px', borderBottom: `0.5px solid ${T.border}`, fontSize: '13px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{v.reg}</span>
              <span style={{ fontSize: '11px', color: T.text2, fontFamily: 'monospace', flexShrink: 0 }}>{fmtDate(v.lastActivity)}</span>
            </div>
            <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.owner?.name || 'No owner on file'}{(v.make || v.model) ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
            </div>
            <div style={{ fontSize: '11px', color: T.text2, fontFamily: 'monospace', marginTop: '4px' }}>
              {v.purchases.length} purchase{v.purchases.length === 1 ? '' : 's'}
            </div>
          </div>
        ) : (
          <div
            key={v.key}
            onClick={() => onPick(v)}
            style={{ ...listGrid, padding: '12px 16px', borderBottom: `0.5px solid ${T.border}`, fontSize: '13px', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = T.surface2}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.5px' }}>{v.reg}</div>
              <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.owner?.name || 'No owner on file'}{(v.make || v.model) ? ` · ${[v.make, v.model].filter(Boolean).join(' ')}` : ''}
              </div>
            </div>
            <div style={{ textAlign: 'center', fontFamily: 'monospace', color: v.purchases.length ? T.text : T.text3 }}>{v.purchases.length}</div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '11px', color: T.text2 }}>{fmtDate(v.lastActivity)}</div>
          </div>
        ))}
      </div>
    </>
  )
}

const listGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(160px, 2fr) 90px 110px',
  gap: '12px',
  alignItems: 'center',
}

// ============================================================
// VEHICLE DETAIL — full history for one reg
// ============================================================
function VehicleDetail({ v, navigate }) {
  const { customers, addVehicle, updateVehicle } = useStore()
  const [showEdit, setShowEdit] = useState(false)
  const invoicedTotal = v.invoices.reduce((a, inv) => a + invoiceTotal(inv), 0)
  const partsSpend = v.purchases.reduce((a, p) => a + (Number(p.gross) || 0), 0)

  // Upsert into the vehicles table: update the existing row for
  // this reg, or create one (owner-less rows are fine — the table
  // has account_id for RLS and a nullable customer link).
  const saveDetails = async ({ make, model, customerId }) => {
    if (v.vehicleRow) {
      await updateVehicle(v.vehicleRow.id, {
        make: make || null,
        model: model || null,
        customerId: customerId || null,
      })
    } else {
      await addVehicle({
        reg: v.reg,
        make: make || null,
        model: model || null,
        customerId: customerId || null,
      })
    }
    setShowEdit(false)
  }

  // Merge everything into one date-sorted timeline
  const timeline = useMemo(() => {
    const items = []
    v.invoices.forEach(inv => items.push({
      key: 'i-' + inv.id, date: inv.date || '', type: 'invoice',
      icon: 'ti-file-text', color: T.red,
      title: `Invoice ${inv.id} — ${inv.custName || 'Customer'}`,
      sub: (inv.lines || []).map(l => l.desc).filter(Boolean).slice(0, 3).join(', '),
      amount: invoiceTotal(inv),
      status: INVOICE_STATUS[inv.status],
      onClick: () => navigate(`/invoices?focus=${encodeURIComponent(inv.id)}`, { state: { focusInvoiceId: inv.id } }),
    }))
    v.purchases.forEach(p => items.push({
      key: 'p-' + p.id, date: p.purchase_date || '', type: 'purchase',
      icon: 'ti-shopping-cart', color: T.amber,
      title: p.description || 'Purchase',
      sub: [p.supplier, p.mileage != null ? `${Number(p.mileage).toLocaleString('en-GB')} mi` : '']
        .filter(Boolean).join(' · '),
      amount: Number(p.gross) || 0,
      status: p.invoice_id ? { label: 'Billed', color: T.green } : { label: 'Unbilled', color: T.amber },
      onClick: () => navigate(`/purchases?q=${encodeURIComponent(v.reg)}`),
    }))
    v.bookings.forEach(b => items.push({
      key: 'b-' + b.id, date: b.booking_date || '', type: 'booking',
      icon: 'ti-calendar', color: T.blue,
      title: `${b.job_type || 'Booking'}${b.start_time ? ` · ${String(b.start_time).slice(0, 5)}` : ''}`,
      sub: b.description || b.notes || '',
      amount: null,
      status: BOOKING_STATUS[b.status],
      onClick: () => navigate('/calendar'),
    }))
    return items.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [v, navigate])

  return (
    <>
      {/* Vehicle card */}
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '18px 20px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '2px' }}>{v.reg}</div>
          <div style={{ fontSize: '12px', color: T.text2, marginTop: '4px' }}>
            {(v.make || v.model) ? [v.make, v.model].filter(Boolean).join(' ') : 'Make / model not on file'}
          </div>
          <div style={{ fontSize: '12px', color: T.text2, marginTop: '6px' }}>
            {v.owner ? (
              <>
                <i className="ti ti-user" style={{ fontSize: '12px', marginRight: '4px' }} aria-hidden="true" />
                <strong>{v.owner.name}</strong>
                {v.owner.phone && <span style={{ color: T.text3 }}> · {v.owner.phone}</span>}
                {v.owner.email && <span style={{ color: T.text3 }}> · {v.owner.email}</span>}
              </>
            ) : (
              <span style={{ color: T.text3 }}>No owner on file</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/invoices')} style={primaryBtn}>
            <i className="ti ti-plus" aria-hidden="true" /> New invoice
          </button>
          <button onClick={() => navigate(`/purchases?q=${encodeURIComponent(v.reg)}`)} style={ghostBtn}>
            <i className="ti ti-shopping-cart" aria-hidden="true" /> Purchases
          </button>
          <button onClick={() => setShowEdit(true)} style={ghostBtn}>
            <i className="ti ti-edit" aria-hidden="true" /> Edit details
          </button>
        </div>
      </div>

      {showEdit && (
        <EditVehicleModal
          v={v}
          customers={customers}
          onClose={() => setShowEdit(false)}
          onSave={saveDetails}
        />
      )}

      {/* Stats */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatTile label="Invoiced" value={money(invoicedTotal)} sub={`${v.invoices.length} invoice${v.invoices.length === 1 ? '' : 's'}`} color={T.green} />
        <StatTile label="Parts spend" value={money(partsSpend)} sub={`${v.purchases.length} purchase${v.purchases.length === 1 ? '' : 's'}`} color={T.amber} />
        <StatTile label="Visits" value={String(v.bookings.length)} sub="bookings" />
        <StatTile label="Last activity" value={fmtDate(v.lastActivity)} sub="most recent record" />
      </div>

      {/* Timeline */}
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: T.text3, fontFamily: 'monospace', marginBottom: '8px' }}>
        Full history ({timeline.length})
      </div>
      {timeline.length === 0 ? (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '30px 20px', textAlign: 'center', fontSize: '12px', color: T.text3 }}>
          Nothing recorded against this reg yet
        </div>
      ) : (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {timeline.map(item => (
            <div
              key={item.key}
              onClick={item.onClick}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderBottom: `0.5px solid ${T.border}`, cursor: item.onClick ? 'pointer' : 'default', fontSize: '13px', flexWrap: 'wrap' }}
              onMouseEnter={e => { if (item.onClick) e.currentTarget.style.background = T.surface2 }}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `color-mix(in srgb, ${item.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: '15px', color: item.color }} aria-hidden="true" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                {item.sub && (
                  <div style={{ fontSize: '11px', color: T.text3, marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {item.amount != null && (
                  <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{money(item.amount)}</div>
                )}
                <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', marginTop: '1px' }}>{fmtDate(item.date)}</div>
              </div>
              {item.status && (
                <span style={{
                  flexShrink: 0, padding: '2px 8px', borderRadius: '20px',
                  fontSize: '10px', fontWeight: 600, fontFamily: 'monospace',
                  background: `color-mix(in srgb, ${item.status.color} 12%, transparent)`, color: item.status.color,
                }}>
                  {item.status.label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ============================================================
// EDIT VEHICLE MODAL — make / model / owner for one reg
// ------------------------------------------------------------
// Owner is a searchable dropdown of this account's customers,
// plus a "No owner" option. Saving upserts a vehicles-table row.
// ============================================================
function EditVehicleModal({ v, customers, onClose, onSave }) {
  const [make, setMake] = useState(v.vehicleRow?.make || v.make || '')
  const [model, setModel] = useState(v.vehicleRow?.model || v.model || '')
  const [customerId, setCustomerId] = useState(
    v.vehicleRow ? (v.vehicleRow.customerId || '') : (v.owner?.id || '')
  )
  const [ownerQuery, setOwnerQuery] = useState('')
  const [ownerOpen, setOwnerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedOwner = customers.find(c => c.id === customerId) || null

  const filteredCustomers = useMemo(() => {
    const q = ownerQuery.toLowerCase().trim()
    const pool = q
      ? customers.filter(c =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q))
      : customers
    return pool.slice(0, 30)
  }, [customers, ownerQuery])

  const submit = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onSave({ make: make.trim(), model: model.trim(), customerId: customerId || null })
    } catch (err) {
      setError(err.message || 'Failed to save vehicle details')
      setSaving(false)
    }
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: '16px' }}
    >
      <div className="modal-content" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            Edit details — <span style={{ fontFamily: 'monospace', letterSpacing: '1px' }}>{v.reg}</span>
          </div>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', color: T.text3, fontSize: '22px', cursor: 'pointer', padding: 0 }}><i className="ti ti-x" /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {/* Make + model */}
        <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={editFieldLbl}>Make</div>
            <input value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Ford" style={editInputStyle} autoFocus />
          </div>
          <div>
            <div style={editFieldLbl}>Model</div>
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Focus" style={editInputStyle} />
          </div>
        </div>

        {/* Owner (searchable) */}
        <div style={{ marginBottom: '18px', position: 'relative' }}>
          <div style={editFieldLbl}>Owner</div>
          <input
            value={ownerOpen ? ownerQuery : (selectedOwner ? selectedOwner.name : 'No owner')}
            onChange={e => setOwnerQuery(e.target.value)}
            onFocus={() => { setOwnerOpen(true); setOwnerQuery('') }}
            onBlur={() => setTimeout(() => setOwnerOpen(false), 150)}
            placeholder="Search customers…"
            style={{ ...editInputStyle, color: !ownerOpen && !selectedOwner ? T.text3 : T.text }}
          />
          {ownerOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px',
              background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px',
              maxHeight: '200px', overflowY: 'auto',
            }}>
              <div
                onMouseDown={() => { setCustomerId(''); setOwnerOpen(false) }}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', color: T.text3, borderBottom: `0.5px solid ${T.border}`, fontStyle: 'italic' }}
              >
                No owner
              </div>
              {filteredCustomers.map(c => (
                <div
                  key={c.id}
                  onMouseDown={() => { setCustomerId(c.id); setOwnerOpen(false) }}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: `0.5px solid ${T.border}`, background: c.id === customerId ? T.surface3 : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface3}
                  onMouseLeave={e => e.currentTarget.style.background = c.id === customerId ? T.surface3 : 'transparent'}
                >
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  {(c.phone || c.email) && (
                    <div style={{ fontSize: '10px', color: T.text3, marginTop: '1px' }}>{c.phone || c.email}</div>
                  )}
                </div>
              ))}
              {filteredCustomers.length === 0 && (
                <div style={{ padding: '10px 12px', fontSize: '11px', color: T.text3 }}>No customers match "{ownerQuery}"</div>
              )}
            </div>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </div>
    </div>
  )
}

const editInputStyle = {
  width: '100%',
  background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px',
  padding: '9px 12px', color: T.text, fontSize: '13px',
  fontFamily: 'inherit', outline: 'none',
}
const editFieldLbl = {
  fontSize: '10px', color: T.text3, fontFamily: 'monospace',
  letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px',
  fontWeight: 500,
}

// ============================================================
// STAT TILE
// ============================================================
function StatTile({ label, value, sub, color = T.text }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', marginTop: '4px', color }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

// ============================================================
// STYLES
// ============================================================
const primaryBtn = {
  background: T.red, color: '#fff', border: 'none',
  padding: '10px 15px', borderRadius: '9px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const ghostBtn = {
  background: T.surface3, color: T.text, border: `1px solid ${T.border2}`,
  padding: '10px 14px', borderRadius: '9px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
