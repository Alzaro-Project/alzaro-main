import { useState, useRef } from 'react'
import { useStore, TIER_ORDER } from '../store/useStore'
import { PageHeader, Card, Badge, Btn, UndoToast } from '../components/UI'
import GlobalSearch from '../components/GlobalSearch'
import { supabase } from '../lib/supabase'
import { deletePurchaseInvoice, getInvoiceSignedUrl } from '../lib/db'

export default function Purchases() {
  const { skus, batches, usedTyres, tier, addBatch, addUsedTyre, updateBatch, deleteBatch, updateUsedTyre, deleteUsedTyre, garageId } = useStore()
  const [search, setSearch] = useState('')
  const [showBatch, setShowBatch] = useState(false)
  const [showUsed, setShowUsed] = useState(false)
  const [editingBatch, setEditingBatch] = useState(null)
  const [editingUsed, setEditingUsed] = useState(null)
  const [restock, setRestock] = useState(null)

  // Open a private invoice by minting a short-lived signed URL on demand.
  const openInvoice = async (pathOrUrl) => {
    const url = await getInvoiceSignedUrl(pathOrUrl)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else alert('Could not open the invoice. Please try again.')
  }

  // Pending delete with Undo: the record vanishes from the list immediately,
  // but the real deletion only runs after the toast expires. Undo cancels it
  // entirely — nothing is touched in the database, so even attached invoice
  // files survive.
  const [pendingDelete, setPendingDelete] = useState(null) // { id, label, commit, timerId }
  const scheduleDelete = (id, label, commit) => {
    // Only one pending delete at a time — commit any previous one first
    setPendingDelete(prev => {
      if (prev) { clearTimeout(prev.timerId); prev.commit() }
      const timerId = setTimeout(() => {
        commit()
        setPendingDelete(null)
      }, 8000)
      return { id, label, commit, timerId }
    })
  }
  const undoDelete = () => {
    setPendingDelete(prev => {
      if (prev) clearTimeout(prev.timerId)
      return null
    })
  }

  // + Stock: reorder the same tyre — opens a new batch prefilled with
  // this purchase's SKU and supplier
  const handleRestock = (r) => {
    const b = batches.find(x => x.id === r.id)
    if (b) setRestock({ skuId: b.skuId, supplier: b.supplier || '' })
  }

  const handleEdit = (r) => {
    if (r.type === 'used') {
      const u = usedTyres.find(x => x.id === r.id)
      if (u) setEditingUsed(u)
    } else {
      const b = batches.find(x => x.id === r.id)
      if (b) setEditingBatch(b)
    }
  }

  const handleDelete = (r) => {
    if (r.type === 'used') {
      const u = usedTyres.find(x => x.id === r.id)
      if (!u) return
      if (u.sold) return alert('This used tyre has been sold on an invoice, so the record can\'t be deleted.')
      if (confirm(`Delete this used tyre (${r.tyreLabel})? Used stock will go down by 1.`)) {
        scheduleDelete(u.id, `Deleted used tyre — ${r.tyreLabel}`, () => deleteUsedTyre(u.id))
      }
    } else {
      const b = batches.find(x => x.id === r.id)
      if (!b) return
      const sold = b.qty - b.remaining
      if (sold > 0) {
        return alert(`${sold} tyre${sold === 1 ? ' has' : 's have'} been sold from this batch on invoices, so it can't be deleted. You can edit its details instead.`)
      }
      if (confirm(`Delete this batch of ${b.qty}? Stock for this tyre will go down by ${b.remaining}.`)) {
        scheduleDelete(b.id, `Deleted batch of ${b.qty} — ${r.tyreLabel}`, () => deleteBatch(b.id))
      }
    }
  }

  const isSilverPlus = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('silver')

  const skuLabel = sk => `${sk.brand} ${sk.model} ${sk.w}/${sk.p}R${sk.r}`

  const allRecords = [
    ...batches.map(b => {
      const sk = skus.find(s => s.id === b.skuId)
      return { ...b, type: 'new', tyreLabel: sk ? skuLabel(sk) : 'Unknown', totalCost: (b.qty || 0) * (b.cost || 0) }
    }),
    ...usedTyres.map(u => ({
      id: u.id, type: 'used', date: u.date, qty: 1, remaining: u.sold ? 0 : 1,
      cost: u.cost, totalCost: u.cost, supplier: u.sourceCust || 'Part-exchange',
      ref: '—', notes: u.notes, tyreLabel: `${u.brand} ${u.model} ${u.w}/${u.p}R${u.r}`
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter(r => r.id !== pendingDelete?.id)

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

  const totalSpend = allRecords.reduce((a, r) => a + (r.totalCost || 0), 0)
  const activeBatches = batches.filter(b => b.remaining > 0).length

  return (
    <div>
      <PageHeader title="Purchase History" subtitle="All supplier batches and part-exchange records">
        {isSilverPlus && <Btn variant="teal" onClick={() => setShowUsed(true)}>♻ Add Used</Btn>}
        <Btn variant="primary" onClick={() => setShowBatch(true)}>+ Purchase Batch</Btn>
      </PageHeader>

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
              <tr>{['Date', 'Tyre', 'Type', 'Qty', 'Cost/ea', 'Total', 'Supplier', 'Ref', 'Actions'].map(h => (
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
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace' }}>£{(r.cost || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>£{(r.totalCost || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px', fontSize: '11px' }}>{r.supplier || '—'}</td>
                  <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', fontSize: '10px' }}>
                    {r.invoiceUrl ? (
                      <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); openInvoice(r.invoiceUrl) }}
                        title="View supplier invoice"
                        style={{ color: 'var(--blue)', textDecoration: 'underline', fontWeight: 600 }}
                      >
                        📄 {r.ref && r.ref !== '—' ? r.ref : 'Invoice'}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text2)' }}>{r.ref || '—'}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                    <span style={{ display: 'inline-flex', gap: '6px' }}>
                      {r.type === 'new' && (
                        <Btn sm variant="success" onClick={() => handleRestock(r)}>+ Stock</Btn>
                      )}
                      <Btn sm variant="ghost" onClick={() => handleEdit(r)}>✏️</Btn>
                      <Btn sm variant="danger" onClick={() => handleDelete(r)}>🗑</Btn>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Batch Modal */}
      {showBatch && <BatchModal skus={skus} preSkuId="" garageId={garageId} onClose={() => setShowBatch(false)} onSave={(data) => {
        addBatch({ id: 'B' + Date.now(), ...data, remaining: data.qty })
        setShowBatch(false)
      }} />}

      {/* Add Used Tyre Modal */}
      {showUsed && <UsedModal onClose={() => setShowUsed(false)} onSave={(data) => {
        addUsedTyre({ id: 'U' + Date.now(), ...data, sold: false })
        setShowUsed(false)
      }} />}

      {/* Edit Batch Modal */}
      {editingBatch && <BatchModal skus={skus} preSkuId="" garageId={garageId} initial={editingBatch} onClose={() => setEditingBatch(null)} onSave={(data) => {
        const sold = editingBatch.qty - editingBatch.remaining
        if (data.qty < sold) {
          alert(`Quantity can't go below ${sold} — that many have already been sold from this batch.`)
          return
        }
        const updates = { ...data, remaining: data.qty - sold }
        // invoiceUrl: null = no change (keep existing), '' = removed, string = new upload
        if (updates.invoiceUrl === null || updates.invoiceUrl === undefined) delete updates.invoiceUrl
        updateBatch(editingBatch.id, updates)
        setEditingBatch(null)
      }} />}

      {/* Edit Used Tyre Modal */}
      {editingUsed && <UsedModal initial={editingUsed} onClose={() => setEditingUsed(null)} onSave={(data) => {
        updateUsedTyre(editingUsed.id, data)
        setEditingUsed(null)
      }} />}

      {/* Restock (+ Stock) Modal — new batch, prefilled with same tyre & supplier */}
      {restock && <BatchModal skus={skus} preSkuId={restock.skuId} garageId={garageId} initial={{ skuId: restock.skuId, supplier: restock.supplier }} onClose={() => setRestock(null)} onSave={(data) => {
        addBatch({ id: 'B' + Date.now(), ...data, remaining: data.qty })
        setRestock(null)
      }} />}
      {pendingDelete && <UndoToast message={pendingDelete.label} onUndo={undoDelete} />}
    </div>
  )
}
function BatchModal({ skus, preSkuId, garageId, onClose, onSave, initial }) {
  const [form, setForm] = useState(initial ? {
    skuId: initial.skuId || '',
    date: initial.date || new Date().toISOString().split('T')[0],
    qty: initial.qty ?? '',
    cost: initial.cost ?? '',
    supplier: initial.supplier || '',
    ref: initial.ref || '',
    notes: initial.notes || '',
  } : { skuId: preSkuId || '', date: new Date().toISOString().split('T')[0], qty: '', cost: '', supplier: '', ref: '', notes: '' })
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)
  // Invoice already attached to this batch (when editing)
  const [existingInvoice, setExistingInvoice] = useState(initial?.invoiceUrl || null)

  // Previously used suppliers, for the dropdown
  const allBatches = useStore(s => s.batches)
  const supplierOptions = [...new Set(allBatches.map(b => b.supplier).filter(Boolean))].sort()

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Please upload a PDF or image file (JPG, PNG, WebP)')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('File too large. Maximum size is 5MB')
        return
      }
      setInvoiceFile(file)
      setUploadError('')
    }
  }

  const uploadInvoice = async () => {
    if (!invoiceFile || !garageId) return null
    setUploading(true)
    try {
      const fileExt = invoiceFile.name.split('.').pop()
      const fileName = `${garageId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const { error } = await supabase.storage.from('purchase-invoices').upload(fileName, invoiceFile)
      if (error) throw error
      setUploading(false)
      return fileName // store the path, not a public URL (bucket is private)
    } catch (err) {
      console.error('Upload failed:', err)
      setUploadError('Upload failed. Please try again.')
      setUploading(false)
      return null
    }
  }

  const handleSave = async () => {
    if (!form.skuId || !form.qty || !form.cost) {
      return alert('Please select a tyre and enter quantity and cost')
    }
    let invoiceUrl
    if (invoiceFile) {
      // New file staged — upload it, and remove the old one if there was one
      invoiceUrl = await uploadInvoice()
      if (invoiceUrl === null) return // upload failed, error already shown
      if (initial?.invoiceUrl) {
        try { await deletePurchaseInvoice(initial.invoiceUrl) } catch (e) { console.error('Old invoice cleanup failed:', e) }
      }
    } else if (initial?.invoiceUrl && !existingInvoice) {
      // User removed the existing invoice without adding a new one
      try { await deletePurchaseInvoice(initial.invoiceUrl) } catch (e) { console.error('Invoice delete failed:', e) }
      invoiceUrl = '' // explicit clear
    } else {
      invoiceUrl = null // no change — parent leaves existing invoice untouched
    }
    onSave({ ...form, qty: parseInt(form.qty), cost: parseFloat(form.cost), invoiceUrl })
  }

  return (
    <Modal title="Purchase Stock Batch" onClose={onClose} onSave={handleSave} saveDisabled={uploading} saveText={uploading ? 'Uploading...' : 'Save Batch'}>
      <Field label="Select Tyre SKU">
        <select style={inputStyle} value={form.skuId} onChange={e => f('skuId', e.target.value)}>
          <option value="">-- Select tyre --</option>
          {skus.map(sk => <option key={sk.id} value={sk.id}>{sk.brand} {sk.model} {sk.w}/{sk.p}R{sk.r}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '12px' }}>
        <Field label="Date"><input style={inputStyle} type="date" value={form.date} onChange={e => f('date', e.target.value)} /></Field>
        <Field label="Quantity"><input style={inputStyle} type="number" value={form.qty} onChange={e => f('qty', e.target.value)} placeholder="10" /></Field>
        <Field label="Cost/ea (£)"><input style={inputStyle} type="number" step="0.01" value={form.cost} onChange={e => f('cost', e.target.value)} placeholder="85.00" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }} className="form-grid-2">
        <Field label="Supplier">
          <input style={inputStyle} list="supplier-history" value={form.supplier} onChange={e => f('supplier', e.target.value)} placeholder="Aldridge Tyres Ltd" />
          <datalist id="supplier-history">
            {supplierOptions.map(s => <option key={s} value={s} />)}
          </datalist>
        </Field>
        <Field label="Invoice Ref"><input style={inputStyle} value={form.ref} onChange={e => f('ref', e.target.value)} placeholder="ALD-2025-0123" /></Field>
      </div>
      <div style={{ marginTop: '12px' }}>
        <Field label="Notes"><input style={inputStyle} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes..." /></Field>
      </div>
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <Field label="Purchase Invoice (optional)">
          <input ref={fileInputRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" onChange={handleFileSelect} style={{ display: 'none' }} />
          {invoiceFile ? (
            <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '6px' }}>✓ {invoiceFile.name}</span>
              <button onClick={() => setInvoiceFile(null)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>✕</button>
            </div>
          ) : existingInvoice ? (
            <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); getInvoiceSignedUrl(existingInvoice).then(u => u ? window.open(u, '_blank', 'noopener,noreferrer') : alert('Could not open the invoice. Please try again.')) }} style={{ color: 'var(--blue)', textDecoration: 'underline', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>📄 View invoice</a>
              <span style={{ display: 'inline-flex', gap: '10px' }}>
                <button onClick={() => fileInputRef.current?.click()} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Replace</button>
                <button onClick={() => { if (confirm('Remove this invoice? It will be deleted when you save.')) setExistingInvoice(null) }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
              </span>
            </div>
          ) : (
            <div onClick={() => fileInputRef.current?.click()} style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', cursor: 'pointer', border: '2px dashed var(--border)' }}>
              <span>📄</span>
              <span style={{ color: 'var(--text2)' }}>Click to upload PDF or image</span>
            </div>
          )}
        </Field>
        {uploadError && <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '6px' }}>{uploadError}</div>}
      </div>
    </Modal>
  )
}

function UsedModal({ onClose, onSave, initial }) {
  const [form, setForm] = useState(initial ? {
    brand: initial.brand || '',
    model: initial.model || '',
    w: initial.w ?? '',
    p: initial.p ?? '',
    r: initial.r ?? '',
    tread: initial.tread ?? '',
    year: initial.year || new Date().getFullYear(),
    cost: initial.cost ?? 0,
    sell: initial.sell ?? '',
    sourceCust: initial.sourceCust || '',
    date: initial.date || new Date().toISOString().split('T')[0],
    notes: initial.notes || '',
  } : { brand: '', model: '', w: '', p: '', r: '', tread: '', year: new Date().getFullYear(), cost: 0, sell: '', sourceCust: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // Dropdown suggestions: people we've bought from before + existing customers
  const usedTyresAll = useStore(s => s.usedTyres)
  const customersAll = useStore(s => s.customers)
  const sourceOptions = [...new Set([
    ...usedTyresAll.map(u => u.sourceCust),
    ...customersAll.map(c => c.name),
  ].filter(Boolean))].sort()
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }
  return (
    <Modal title="Add Used / Part-Ex Tyre" onClose={onClose} onSave={() => {
      if (!form.brand || !form.model) return alert('Brand and model required')
      onSave({ ...form, w: parseInt(form.w), p: parseInt(form.p), r: parseInt(form.r), tread: parseFloat(form.tread), cost: parseFloat(form.cost) || 0, sell: parseFloat(form.sell) })
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }} className="form-grid-2">
        <Field label="Brand"><input style={inputStyle} value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="Michelin" /></Field>
        <Field label="Model"><input style={inputStyle} value={form.model} onChange={e => f('model', e.target.value)} placeholder="Pilot Sport 4" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <Field label="Width (mm)"><input style={inputStyle} type="number" value={form.w} onChange={e => f('w', e.target.value)} placeholder="225" /></Field>
        <Field label="Profile (%)"><input style={inputStyle} type="number" value={form.p} onChange={e => f('p', e.target.value)} placeholder="45" /></Field>
        <Field label="Rim (inch)"><input style={inputStyle} type="number" value={form.r} onChange={e => f('r', e.target.value)} placeholder="18" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <Field label="Tread (mm)"><input style={inputStyle} type="number" step="0.1" value={form.tread} onChange={e => f('tread', e.target.value)} placeholder="5.5" /></Field>
        <Field label="Year"><input style={inputStyle} type="number" value={form.year} onChange={e => f('year', e.target.value)} /></Field>
        <Field label="Source Customer">
          <input style={inputStyle} list="source-customer-history" value={form.sourceCust} onChange={e => f('sourceCust', e.target.value)} placeholder="Dave Patel" />
          <datalist id="source-customer-history">
            {sourceOptions.map(s => <option key={s} value={s} />)}
          </datalist>
        </Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <Field label="Cost (£)"><input style={inputStyle} type="number" step="0.01" value={form.cost} onChange={e => f('cost', e.target.value)} placeholder="0.00" /></Field>
        <Field label="Sell Price (£)"><input style={inputStyle} type="number" step="0.01" value={form.sell} onChange={e => f('sell', e.target.value)} placeholder="45.00" /></Field>
        <Field label="Date Received"><input style={inputStyle} type="date" value={form.date} onChange={e => f('date', e.target.value)} /></Field>
      </div>
      <Field label="Notes"><input style={inputStyle} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Condition, origin..." /></Field>
    </Modal>
  )
}

function Modal({ title, children, onClose, onSave, hideActions, saveDisabled, saveText }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-content" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', width: '500px', maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '26px' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '19px', fontWeight: 700, marginBottom: '18px' }}>{title}</div>
        {children}
        {!hideActions && (
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" onClick={onSave} disabled={saveDisabled}>{saveText || 'Save'}</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)' }}>{label}</label>
      {children}
    </div>
  )
}
