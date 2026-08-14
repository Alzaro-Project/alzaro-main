import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// Stock — quantity tracking for Parts
// ------------------------------------------------------------
// Reads/writes the same `parts` table the Items → Parts catalog
// uses, plus two new columns: qty (in stock) and min_qty (low-
// stock alert level). Requires the ALTER TABLE migration to be
// run in Supabase first.
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
  text: 'var(--text)',
  text2: 'var(--text2)',
  text3: 'var(--text3)',
}

function money(n) {
  if (n == null || n === '') return '—'
  return `£${Number(n).toFixed(2)}`
}

// ---------- Shared button / input styles ----------
const primaryBtn = {
  background: T.red, color: '#fff', border: 'none',
  padding: '10px 15px', borderRadius: '9px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const ghostBtn = {
  background: 'transparent', color: T.text2, border: `1px solid ${T.border2}`,
  padding: '9px 13px', borderRadius: '9px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  background: T.surface2, border: `1px solid ${T.border2}`,
  borderRadius: '8px', padding: '10px 12px',
  color: T.text, fontFamily: 'inherit', fontSize: '13px', outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: T.text2, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px',
}

// ============================================================
// MAIN
// ============================================================
export default function Stock() {
  const navigate = useNavigate()
  const garageId = useStore(s => s.garageId)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | { mode: 'intake' } | { mode: 'edit', part }
  const [busyId, setBusyId] = useState(null) // part id currently saving a +/- adjust

  // ---------- LOAD ----------
  const fetchAll = useCallback(async () => {
    if (!garageId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('parts')
        .select('*')
        .eq('account_id', garageId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (err) throw err
      setRows(data || [])
    } catch (err) {
      console.error('Stock:', err)
      setError(err.message || 'Failed to load stock')
    }
    setLoading(false)
  }, [garageId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ---------- SAVE HELPERS ----------
  const savePart = useCallback(async (id, patch) => {
    const { data: updated, error: err } = await supabase
      .from('parts').update(patch).eq('id', id).select().single()
    if (err) throw err
    setRows(prev => prev.map(r => r.id === id ? updated : r))
    return updated
  }, [])

  const adjustQty = async (part, delta) => {
    const next = Math.max(0, Number(part.qty || 0) + delta)
    if (next === Number(part.qty || 0)) return
    setBusyId(part.id)
    // Optimistic
    setRows(prev => prev.map(r => r.id === part.id ? { ...r, qty: next } : r))
    try {
      await savePart(part.id, { qty: next })
    } catch (err) {
      // Roll back on failure
      setRows(prev => prev.map(r => r.id === part.id ? { ...r, qty: part.qty } : r))
      alert('Could not update stock: ' + (err.message || err))
    }
    setBusyId(null)
  }

  // ---------- DERIVED ----------
  const active = useMemo(() => rows.filter(r => !r.archived), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return active
    return active.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.part_number || '').toLowerCase().includes(q)
    )
  }, [active, search])

  const stats = useMemo(() => {
    let units = 0, value = 0, low = 0, out = 0
    for (const r of active) {
      const qty = Number(r.qty || 0)
      units += qty
      value += qty * Number(r.cost || 0)
      if (qty <= 0) out++
      else if (Number(r.min_qty || 0) > 0 && qty <= Number(r.min_qty)) low++
    }
    return { parts: active.length, units, value, low, out }
  }, [active])

  const statusOf = (r) => {
    const qty = Number(r.qty || 0)
    if (qty <= 0) return { label: 'OUT', color: T.red, bg: 'rgba(229,57,53,0.12)' }
    if (Number(r.min_qty || 0) > 0 && qty <= Number(r.min_qty)) return { label: 'LOW', color: '#d97706', bg: 'rgba(217,119,6,0.12)' }
    return { label: 'OK', color: '#16a34a', bg: 'rgba(22,163,74,0.10)' }
  }

  // Detect missing-column migration (qty/min_qty not added yet)
  const needsMigration = error && /qty|min_qty|column/i.test(error)

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>

      {/* ===== HEADER ===== */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Stock</div>
          <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
            How many of each part you actually have on the shelf
          </div>
        </div>
        <button onClick={() => setModal({ mode: 'intake' })} style={primaryBtn} disabled={!active.length}>
          <i className="ti ti-truck-delivery" aria-hidden="true" /> Add stock
        </button>
      </div>

      {/* ===== ERROR ===== */}
      {error && (
        <div style={{ background: 'rgba(229,57,53,0.1)', border: '1px solid rgba(229,57,53,0.3)', color: T.red, padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '14px', lineHeight: 1.5 }}>
          ⚠ Couldn't load stock: {error}
          {needsMigration && (
            <div style={{ marginTop: '6px', color: T.text2 }}>
              Looks like the qty / min_qty columns haven't been added to the parts table yet — run the Stock migration in the Supabase SQL Editor.
            </div>
          )}
          <button onClick={fetchAll} style={{ marginLeft: '8px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, padding: '3px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Retry</button>
        </div>
      )}

      {/* ===== SUMMARY TILES ===== */}
      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
        <StatTile label="Parts tracked" value={stats.parts} />
        <StatTile label="Units in stock" value={stats.units} />
        <StatTile label="Stock value (cost)" value={money(stats.value)} color={T.green} />
        <StatTile
          label="Low / out of stock"
          value={`${stats.low + stats.out}`}
          color={stats.low + stats.out > 0 ? T.red : T.text}
          sub={stats.out > 0 ? `${stats.out} out` : undefined}
        />
      </div>

      {/* ===== SEARCH ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: T.surface2, border: `1px solid ${T.border}`, padding: '10px 13px', borderRadius: '10px', marginBottom: '14px', maxWidth: '340px' }}>
        <i className="ti ti-search" style={{ color: T.text3 }} aria-hidden="true" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search parts or part numbers..."
          style={{ background: 'none', border: 'none', outline: 'none', color: T.text, fontFamily: 'inherit', fontSize: '13px', width: '100%' }}
        />
      </div>

      {/* ===== LIST ===== */}
      {loading ? (
        <div style={{ color: T.text2, fontSize: '13px', padding: '30px 0', textAlign: 'center' }}>Loading stock…</div>
      ) : !active.length ? (
        <div style={{ background: T.surface, border: `1px dashed ${T.border2}`, borderRadius: '14px', padding: '40px 20px', textAlign: 'center' }}>
          <i className="ti ti-stack-2" style={{ fontSize: '28px', color: T.text3 }} aria-hidden="true" />
          <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '10px' }}>No parts to track yet</div>
          <div style={{ fontSize: '12px', color: T.text2, marginTop: '4px', marginBottom: '16px' }}>
            Add parts to your catalog first — stock levels live on top of them.
          </div>
          <button onClick={() => navigate('/items')} style={primaryBtn}>
            <i className="ti ti-box" aria-hidden="true" /> Go to Items → Parts
          </button>
        </div>
      ) : (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '14px', overflow: 'hidden' }}>
          {/* Table head */}
          <div className="stock-row" style={{
            display: 'grid', gridTemplateColumns: '1.6fr 150px 90px 100px 80px 40px',
            gap: '10px', alignItems: 'center',
            padding: '10px 16px', borderBottom: `1px solid ${T.border}`,
            fontSize: '10px', fontWeight: 700, color: T.text3,
            textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'monospace',
          }}>
            <div>Part</div>
            <div style={{ textAlign: 'center' }}>In stock</div>
            <div style={{ textAlign: 'center' }}>Min level</div>
            <div style={{ textAlign: 'right' }}>Value</div>
            <div style={{ textAlign: 'center' }}>Status</div>
            <div />
          </div>

          {filtered.map(r => {
            const st = statusOf(r)
            const qty = Number(r.qty || 0)
            return (
              <div key={r.id} className="stock-row" style={{
                display: 'grid', gridTemplateColumns: '1.6fr 150px 90px 100px 80px 40px',
                gap: '10px', alignItems: 'center',
                padding: '11px 16px', borderBottom: `1px solid ${T.border}`,
                fontSize: '13px',
              }}>
                {/* Part */}
                <div>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  {r.part_number && <div style={{ fontSize: '11px', color: T.text3, marginTop: '2px', fontFamily: 'monospace' }}>{r.part_number}</div>}
                </div>

                {/* Qty with +/- */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <button onClick={() => adjustQty(r, -1)} disabled={busyId === r.id || qty <= 0} style={qtyBtn} title="Remove one">
                    <i className="ti ti-minus" aria-hidden="true" />
                  </button>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, minWidth: '32px', textAlign: 'center', fontSize: '14px', opacity: busyId === r.id ? 0.5 : 1 }}>
                    {qty}
                  </span>
                  <button onClick={() => adjustQty(r, 1)} disabled={busyId === r.id} style={qtyBtn} title="Add one">
                    <i className="ti ti-plus" aria-hidden="true" />
                  </button>
                </div>

                {/* Min level */}
                <div style={{ textAlign: 'center', fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>
                  {Number(r.min_qty || 0) > 0 ? r.min_qty : '—'}
                </div>

                {/* Value */}
                <div style={{ textAlign: 'right', fontFamily: 'monospace', color: T.text2, fontSize: '12px' }}>
                  {money(qty * Number(r.cost || 0))}
                </div>

                {/* Status */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 9px', borderRadius: '12px',
                    fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
                    background: st.bg, color: st.color,
                  }}>{st.label}</span>
                </div>

                {/* Edit */}
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => setModal({ mode: 'edit', part: r })} style={{ ...qtyBtn, border: 'none' }} title="Edit stock level">
                    <i className="ti ti-pencil" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}

          {!filtered.length && (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: T.text2 }}>
              No parts match "{search}"
            </div>
          )}
        </div>
      )}

      {/* ===== MODALS ===== */}
      {modal?.mode === 'intake' && (
        <IntakeModal
          parts={active}
          onClose={() => setModal(null)}
          onSave={async ({ partId, qty }) => {
            const part = rows.find(r => r.id === partId)
            if (!part) throw new Error('Pick a part')
            await savePart(partId, { qty: Number(part.qty || 0) + qty })
            setModal(null)
          }}
        />
      )}
      {modal?.mode === 'edit' && (
        <EditModal
          part={modal.part}
          onClose={() => setModal(null)}
          onSave={async ({ qty, minQty }) => {
            await savePart(modal.part.id, { qty, min_qty: minQty })
            setModal(null)
          }}
        />
      )}

      {/* Responsive */}
      <style>{`
        @media (max-width: 760px) {
          .stock-row { grid-template-columns: 1.4fr 130px 70px 40px !important; }
          .stock-row > div:nth-child(4), .stock-row > div:nth-child(5) { display: none; }
        }
      `}</style>
    </div>
  )
}

const qtyBtn = {
  width: '24px', height: '24px',
  background: 'var(--surface2)', border: '1px solid var(--border2)',
  borderRadius: '6px', color: 'var(--text2)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatTile({ label, value, color = 'var(--text)', sub }) {
  return (
    <div style={{
      background: T.surface, border: `0.5px solid ${T.border}`,
      borderRadius: '12px', padding: '14px 16px',
    }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'monospace', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: T.text2, marginTop: '3px' }}>{sub}</div>}
    </div>
  )
}

function ModalShell({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="modal-content"
        style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: '16px', padding: '22px', width: '420px', maxWidth: '95vw',
          fontFamily: "'Space Grotesk', sans-serif", color: T.text,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ ...qtyBtn, border: 'none' }} title="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function IntakeModal({ parts, onClose, onSave }) {
  const [partId, setPartId] = useState(parts[0]?.id || '')
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async () => {
    const n = Number(qty)
    if (!partId) { setErr('Pick a part'); return }
    if (!n || n <= 0) { setErr('Enter how many arrived'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({ partId, qty: n })
    } catch (e) {
      setErr(e.message || 'Could not save')
      setSaving(false)
    }
  }

  return (
    <ModalShell title="Add stock" onClose={onClose}>
      <div style={{ marginBottom: '14px' }}>
        <label style={labelStyle}>Part</label>
        <select value={partId} onChange={e => setPartId(e.target.value)} style={inputStyle}>
          {parts.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{p.part_number ? ` (${p.part_number})` : ''} — {Number(p.qty || 0)} in stock
            </option>
          ))}
        </select>
      </div>
      <div style={{ marginBottom: '18px' }}>
        <label style={labelStyle}>Quantity received</label>
        <input type="number" min="1" step="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 10" style={inputStyle} autoFocus />
      </div>
      {err && <div style={{ color: T.red, fontSize: '12px', marginBottom: '12px' }}>⚠ {err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Add to stock'}
        </button>
      </div>
    </ModalShell>
  )
}

function EditModal({ part, onClose, onSave }) {
  const [qty, setQty] = useState(String(Number(part.qty || 0)))
  const [minQty, setMinQty] = useState(String(Number(part.min_qty || 0)))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const submit = async () => {
    const q = Number(qty)
    const m = Number(minQty)
    if (Number.isNaN(q) || q < 0) { setErr('Stock level must be 0 or more'); return }
    if (Number.isNaN(m) || m < 0) { setErr('Min level must be 0 or more'); return }
    setSaving(true)
    setErr(null)
    try {
      await onSave({ qty: q, minQty: m })
    } catch (e) {
      setErr(e.message || 'Could not save')
      setSaving(false)
    }
  }

  return (
    <ModalShell title={`Edit — ${part.name}`} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
        <div>
          <label style={labelStyle}>In stock</label>
          <input type="number" min="0" step="1" value={qty} onChange={e => setQty(e.target.value)} style={inputStyle} autoFocus />
        </div>
        <div>
          <label style={labelStyle}>Min level (alert)</label>
          <input type="number" min="0" step="1" value={minQty} onChange={e => setMinQty(e.target.value)} style={inputStyle} placeholder="0 = no alert" />
        </div>
      </div>
      <div style={{ fontSize: '11px', color: T.text3, marginBottom: '14px', lineHeight: 1.5 }}>
        When stock drops to the min level or below, the part shows as LOW on this page.
      </div>
      {err && <div style={{ color: T.red, fontSize: '12px', marginBottom: '12px' }}>⚠ {err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
        <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </ModalShell>
  )
}
