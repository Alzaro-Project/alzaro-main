import { useState, useRef } from 'react'
import { useStore, TIER_ORDER } from '../store/useStore'
import { PageHeader, Card, Badge, Btn, StatCard } from '../components/UI'
import GlobalSearch from '../components/GlobalSearch'
import { supabase } from '../lib/supabase'

export default function Inventory() {
  const { skus, batches, usedTyres, tier, addSKU, updateSKU, deleteSKU, addBatch, addUsedTyre, updateUsedTyre, deleteUsedTyre, getTotalStock, getFIFOCost, garageId, bulkAddSKUs } = useStore()
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [showSKU, setShowSKU] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [showUsed, setShowUsed] = useState(false)
  const [editingSKU, setEditingSKU] = useState(null)
  const [preSkuId, setPreSkuId] = useState('')
  const [viewingBatch, setViewingBatch] = useState(null)
  const [showCSVImport, setShowCSVImport] = useState(false)

  const isSilverPlus = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('silver')
  const isGold = tier === 'gold'

  // Stats
  const totalNew = batches.reduce((a, b) => a + b.remaining, 0)
  const totalUsed = usedTyres.filter(u => !u.sold).length
  const totalVal = skus.reduce((a, sk) => a + batches.filter(b => b.skuId === sk.id && b.remaining > 0).reduce((x, b) => x + b.remaining * b.cost, 0), 0)
    + usedTyres.filter(u => !u.sold).reduce((a, u) => a + u.cost, 0)
  const lowCount = skus.filter(sk => getTotalStock(sk.id) <= sk.alert).length

  const skuLabel = sk => `${sk.brand} ${sk.model} ${sk.w}/${sk.p}R${sk.r}`

  const filteredSKUs = skus.filter(sk => {
    if (search && !skuLabel(sk).toLowerCase().includes(search.toLowerCase())) return false
    if (tab === 'low' && getTotalStock(sk.id) > sk.alert) return false
    return true
  })

  const filteredUsed = usedTyres.filter(u => {
    if (u.sold) return false
    if (search && !`${u.brand} ${u.model} ${u.w}/${u.p}R${u.r}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <PageHeader title="Tyre Inventory" subtitle="FIFO batch tracking · New & used stock">
        {isSilverPlus && <Btn variant="teal" onClick={() => { setShowUsed(true) }}>♻ Add Used</Btn>}
        <Btn variant="secondary" onClick={() => { setPreSkuId(''); setShowBatch(true) }}>+ Purchase Batch</Btn>
        <Btn variant="primary" onClick={() => { setEditingSKU(null); setShowSKU(true) }}>+ New SKU</Btn>
      </PageHeader>

      {/* Global Search */}
      <div style={{ marginBottom: '16px' }}>
        <GlobalSearch maxWidth="500px" placeholder="Search customers, invoices, car reg..." />
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '18px' }} className="stat-grid">
        <StatCard label="New Stock" value={totalNew} delta={`${batches.filter(b => b.remaining > 0).length} active batches`} color="var(--accent)" />
        <StatCard label="Used / Part-Ex" value={totalUsed} delta="available" color="var(--teal)" />
        <StatCard label="Low Stock SKUs" value={lowCount} delta="need reorder" color={lowCount > 0 ? 'var(--red)' : 'var(--green)'} />
        <StatCard label="Stock Value" value={`£${totalVal.toFixed(2)}`} delta="at cost price" color="var(--blue)" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: 'var(--surface2)', borderRadius: '9px', padding: '4px', marginBottom: '16px', width: 'fit-content' }} className="tab-nav">
        {[['all', 'All Stock'], ['new', 'New Tyres'], ['used', '♻ Used'], ['low', '⚠ Low Stock']].map(([key, label]) => (
          <div key={key} onClick={() => setTab(key)} style={{
            padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            background: tab === key ? 'var(--surface3)' : 'transparent',
            color: tab === key ? 'var(--text)' : 'var(--text2)',
          }}>{label}</div>
        ))}
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>Stock List</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tyres..." style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '200px', maxWidth: '100%' }} />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>{['Brand', 'Model', 'Size', 'Type', 'Batches / Info', 'FIFO Cost', 'Sell', 'Margin', 'Qty', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {/* New tyre SKUs */}
              {(tab === 'all' || tab === 'new' || tab === 'low') && filteredSKUs.map(sk => {
                const qty = getTotalStock(sk.id)
                const fifo = getFIFOCost(sk.id)
                const margin = sk.sell > 0 ? Math.round((sk.sell - fifo) / sk.sell * 100) : 0
                const activeBatches = batches.filter(b => b.skuId === sk.id && b.remaining > 0).sort((a, b) => new Date(a.date) - new Date(b.date))
                const statusBadge = qty === 0 ? ['red', 'OUT'] : qty <= sk.alert ? ['yellow', 'LOW'] : ['green', 'OK']
                return (
                  <tr key={sk.id} onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--surface2)')} onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                    <td style={{ padding: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{sk.brand}</td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{sk.model}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>{sk.w}/{sk.p}R{sk.r}</td>
                    <td style={{ padding: '10px' }}><Badge variant="blue">New</Badge></td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {activeBatches.length === 0 ? <span style={{ color: 'var(--text3)', fontSize: '11px' }}>No stock</span> :
                          activeBatches.map((b, i) => (
                            <span 
                              key={b.id} 
                              title={`Supplier: ${b.supplier || 'N/A'} | Ref: ${b.ref || 'N/A'}${b.invoiceUrl ? ' | Click to view invoice' : ''}`} 
                              onClick={() => setViewingBatch(b)}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '5px', fontSize: '10px', fontFamily: 'DM Mono, monospace',
                                background: i === 0 ? 'var(--blue2)' : 'var(--surface3)',
                                color: i === 0 ? 'var(--blue)' : 'var(--text2)',
                                border: `1px solid ${i === 0 ? 'rgba(96,165,250,.3)' : 'var(--border)'}`,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}>
                              {i === 0 ? '⚡' : ''}{b.invoiceUrl ? '📄' : ''}{b.date} · £{b.cost} · {b.remaining}pc
                            </span>
                          ))
                        }
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>£{fifo.toFixed(2)}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)', whiteSpace: 'nowrap' }}>£{sk.sell.toFixed(2)}</td>
                    <td style={{ padding: '10px' }}><span style={{ color: margin > 40 ? 'var(--green)' : margin > 20 ? 'var(--accent)' : 'var(--red)' }}>{margin}%</span></td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 500 }}>{qty}</td>
                    <td style={{ padding: '10px' }}><Badge variant={statusBadge[0]}>{statusBadge[1]}</Badge></td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '3px', flexWrap: 'nowrap' }}>
                        <Btn sm variant="secondary" onClick={() => { setPreSkuId(sk.id); setShowBatch(true) }}>+ Stock</Btn>
                        <Btn sm variant="ghost" onClick={() => { setEditingSKU(sk); setShowSKU(true) }}>Edit</Btn>
                        <Btn sm variant="danger" onClick={() => { if (confirm('Delete this SKU and all batches?')) deleteSKU(sk.id) }}>✕</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {/* Used tyres */}
              {(tab === 'all' || tab === 'used') && filteredUsed.map(u => {
                const margin = u.sell > 0 ? Math.round((u.sell - u.cost) / u.sell * 100) : 0
                return (
                  <tr key={u.id} onMouseEnter={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = 'var(--surface2)')} onMouseLeave={e => e.currentTarget.querySelectorAll('td').forEach(td => td.style.background = '')}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{u.brand}</td>
                    <td style={{ padding: '10px' }}>{u.model}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace' }}>{u.w}/{u.p}R{u.r}</td>
                    <td style={{ padding: '10px' }}><Badge variant="teal">♻ Used</Badge></td>
                    <td style={{ padding: '10px', fontSize: '11px', color: 'var(--text2)' }}>
                      {u.tread}mm · {u.year} · {u.sourceCust || 'Part-ex'}
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace' }}>£{u.cost.toFixed(2)}</td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', color: 'var(--teal)' }}>£{u.sell.toFixed(2)}</td>
                    <td style={{ padding: '10px' }}><span style={{ color: margin > 50 ? 'var(--green)' : 'var(--accent)' }}>{margin}%</span></td>
                    <td style={{ padding: '10px', fontFamily: 'DM Mono, monospace', fontSize: '16px', fontWeight: 500 }}>1</td>
                    <td style={{ padding: '10px' }}><Badge variant="green">AVAIL</Badge></td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        <Btn sm variant="ghost" onClick={() => updateUsedTyre(u.id, { sold: true })}>Sold</Btn>
                        <Btn sm variant="danger" onClick={() => { if (confirm('Delete this used tyre?')) deleteUsedTyre(u.id) }}>✕</Btn>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredSKUs.length === 0 && filteredUsed.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--text3)', padding: '30px' }}>
                  {search ? 'No tyres match your search' : 'No tyres in inventory. Add your first SKU!'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit SKU Modal */}
      {showSKU && <SKUModal 
        sku={editingSKU} 
        onClose={() => setShowSKU(false)} 
        onSave={(data) => {
          if (editingSKU) updateSKU(editingSKU.id, data)
          else addSKU({ id: 'SK' + Date.now(), ...data })
          setShowSKU(false)
        }}
        onShowCSVImport={() => {
          setShowSKU(false)
          setShowCSVImport(true)
        }}
      />}

      {/* CSV Import Modal */}
      {showCSVImport && <CSVImportModal 
        onClose={() => setShowCSVImport(false)} 
        onImport={async (skusData) => {
          const results = await bulkAddSKUs(skusData)
          if (results.success > 0) {
            setShowCSVImport(false)
          }
          return results
        }}
      />}

      {/* Add Batch Modal - with invoice upload */}
      {showBatch && <BatchModal skus={skus} preSkuId={preSkuId} garageId={garageId} onClose={() => setShowBatch(false)} onSave={(data) => {
        addBatch({ id: 'B' + Date.now(), ...data, remaining: data.qty })
        setShowBatch(false)
      }} />}

      {/* Add Used Tyre Modal */}
      {showUsed && <UsedModal onClose={() => setShowUsed(false)} onSave={(data) => {
        addUsedTyre({ id: 'U' + Date.now(), ...data, sold: false })
        setShowUsed(false)
      }} />}

      {/* View Batch Details Modal */}
      {viewingBatch && <BatchDetailsModal batch={viewingBatch} skus={skus} onClose={() => setViewingBatch(null)} />}
    </div>
  )
}

function SKUModal({ sku, onClose, onSave, onShowCSVImport }) {
  const [form, setForm] = useState(sku || { brand: '', model: '', w: '', p: '', r: '', sell: '', alert: 2, season: 'allseason' })
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }
  
  return (
    <Modal title={sku ? 'Edit Tyre SKU' : 'New Tyre SKU'} onClose={onClose} onSave={() => {
      if (!form.brand || !form.model) return alert('Brand and model required')
      onSave({ ...form, w: parseInt(form.w), p: parseInt(form.p), r: parseInt(form.r), sell: parseFloat(form.sell), alert: parseInt(form.alert) })
    }}>
      {/* CSV Import option - only show when adding new SKU */}
      {!sku && onShowCSVImport && (
        <div style={{ 
          background: 'rgba(45,212,191,0.08)', 
          border: '1px solid rgba(45,212,191,0.2)', 
          borderRadius: '8px', 
          padding: '12px 14px', 
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--teal)' }}>Bulk Import Available</div>
            <div style={{ fontSize: '11px', color: 'var(--text2)' }}>Import multiple SKUs from a CSV file</div>
          </div>
          <Btn variant="teal" sm onClick={onShowCSVImport}>📄 Import CSV</Btn>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }} className="form-grid-2">
        <Field label="Brand"><input style={inputStyle} value={form.brand} onChange={e => f('brand', e.target.value)} placeholder="Michelin" /></Field>
        <Field label="Model"><input style={inputStyle} value={form.model} onChange={e => f('model', e.target.value)} placeholder="Pilot Sport 4" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <Field label="Width (mm)"><input style={inputStyle} type="number" value={form.w} onChange={e => f('w', e.target.value)} placeholder="225" /></Field>
        <Field label="Profile (%)"><input style={inputStyle} type="number" value={form.p} onChange={e => f('p', e.target.value)} placeholder="45" /></Field>
        <Field label="Rim (inch)"><input style={inputStyle} type="number" value={form.r} onChange={e => f('r', e.target.value)} placeholder="18" /></Field>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }} className="form-grid-2">
        <Field label="Sell Price (£)"><input style={inputStyle} type="number" step="0.01" value={form.sell} onChange={e => f('sell', e.target.value)} placeholder="145.00" /></Field>
        <Field label="Low Stock Alert"><input style={inputStyle} type="number" value={form.alert} onChange={e => f('alert', e.target.value)} placeholder="2" /></Field>
      </div>
      <Field label="Season">
        <select style={inputStyle} value={form.season} onChange={e => f('season', e.target.value)}>
          <option value="allseason">All Season</option>
          <option value="summer">Summer</option>
          <option value="winter">Winter</option>
        </select>
      </Field>
    </Modal>
  )
}

function CSVImportModal({ onClose, onImport }) {
  const [csvData, setCsvData] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState(null)
  const fileInputRef = useRef(null)

  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }

  // Generate CSV template
  const downloadTemplate = () => {
    const template = `brand,model,w,p,r,sell,alert,season
Michelin,Pilot Sport 4,225,45,18,145.00,2,summer
Continental,PremiumContact 6,205,55,16,99.00,3,allseason
Pirelli,Cinturato P7,215,60,16,89.00,2,summer
Bridgestone,Turanza T005,195,65,15,72.00,2,allseason`
    
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sku_import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Parse CSV file
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length < 2) {
          setErrors(['CSV file must have a header row and at least one data row'])
          return
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase())
        const requiredFields = ['brand', 'model', 'w', 'p', 'r']
        const missingFields = requiredFields.filter(f => !header.includes(f))
        
        if (missingFields.length > 0) {
          setErrors([`Missing required columns: ${missingFields.join(', ')}`])
          return
        }

        // Parse data rows
        const data = []
        const parseErrors = []

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          
          if (values.length < header.length) {
            parseErrors.push(`Row ${i + 1}: Not enough columns`)
            continue
          }

          const row = {}
          header.forEach((h, idx) => {
            row[h] = values[idx] || ''
          })

          // Validate required fields
          if (!row.brand || !row.model || !row.w || !row.p || !row.r) {
            parseErrors.push(`Row ${i + 1}: Missing required field (brand, model, w, p, or r)`)
            continue
          }

          // Validate numeric fields
          if (isNaN(parseInt(row.w)) || isNaN(parseInt(row.p)) || isNaN(parseInt(row.r))) {
            parseErrors.push(`Row ${i + 1}: Width, profile, and rim must be numbers`)
            continue
          }

          data.push({
            brand: row.brand,
            model: row.model,
            w: parseInt(row.w),
            p: parseInt(row.p),
            r: parseInt(row.r),
            sell: parseFloat(row.sell) || 0,
            alert: parseInt(row.alert) || 2,
            season: ['summer', 'winter', 'allseason'].includes(row.season?.toLowerCase()) 
              ? row.season.toLowerCase() 
              : 'allseason',
          })
        }

        setCsvData(data)
        setErrors(parseErrors)
      } catch (err) {
        setErrors([`Failed to parse CSV: ${err.message}`])
      }
    }
    reader.readAsText(file)
  }

  // Handle import
  const handleImport = async () => {
    if (csvData.length === 0) return

    setImporting(true)
    try {
      const results = await onImport(csvData)
      setImportResults(results)
      
      if (results.success > 0 && results.failed === 0) {
        // All successful - close after short delay
        setTimeout(() => onClose(), 1500)
      }
    } catch (err) {
      setErrors([`Import failed: ${err.message}`])
    }
    setImporting(false)
  }

  // Remove a row from preview
  const removeRow = (index) => {
    setCsvData(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <Modal 
      title="Import SKUs from CSV" 
      onClose={onClose} 
      onSave={handleImport}
      saveText={importing ? 'Importing...' : `Import ${csvData.length} SKU${csvData.length !== 1 ? 's' : ''}`}
      saveDisabled={csvData.length === 0 || importing}
    >
      {/* Template Download */}
      <div style={{ 
        background: 'var(--surface2)', 
        borderRadius: '10px', 
        padding: '16px', 
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>CSV Template</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>
            Download the template to see the required format
          </div>
        </div>
        <Btn variant="secondary" onClick={downloadTemplate}>📥 Download Template</Btn>
      </div>

      {/* File Upload */}
      <div style={{ marginBottom: '16px' }}>
        <Field label="Upload CSV File">
          <input 
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...inputStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '20px',
              cursor: 'pointer',
              border: '2px dashed var(--border)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '20px' }}>📄</span>
            <span>Click to select CSV file</span>
          </div>
        </Field>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ 
          background: 'rgba(255,95,95,0.1)', 
          border: '1px solid rgba(255,95,95,0.3)', 
          borderRadius: '8px', 
          padding: '12px', 
          marginBottom: '16px' 
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)', marginBottom: '6px' }}>
            ⚠ Issues Found
          </div>
          {errors.slice(0, 5).map((err, i) => (
            <div key={i} style={{ fontSize: '11px', color: 'var(--text2)', marginBottom: '2px' }}>
              • {err}
            </div>
          ))}
          {errors.length > 5 && (
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
              ... and {errors.length - 5} more issues
            </div>
          )}
        </div>
      )}

      {/* Import Results */}
      {importResults && (
        <div style={{ 
          background: importResults.failed > 0 ? 'rgba(245,200,66,0.1)' : 'rgba(34,197,94,0.1)', 
          border: `1px solid ${importResults.failed > 0 ? 'rgba(245,200,66,0.3)' : 'rgba(34,197,94,0.3)'}`, 
          borderRadius: '8px', 
          padding: '12px', 
          marginBottom: '16px' 
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: importResults.failed > 0 ? 'var(--accent)' : 'var(--green)', marginBottom: '6px' }}>
            Import Complete
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text2)' }}>
            ✓ {importResults.success} imported successfully
            {importResults.failed > 0 && ` · ✕ ${importResults.failed} failed`}
          </div>
        </div>
      )}

      {/* Preview Table */}
      {csvData.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>
            Preview ({csvData.length} SKU{csvData.length !== 1 ? 's' : ''})
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Brand', 'Model', 'Size', 'Sell', 'Season', ''].map(h => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: '10px', color: 'var(--text2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>{row.brand}</td>
                    <td style={{ padding: '6px 8px' }}>{row.model}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'DM Mono, monospace' }}>{row.w}/{row.p}R{row.r}</td>
                    <td style={{ padding: '6px 8px', fontFamily: 'DM Mono, monospace' }}>£{row.sell.toFixed(2)}</td>
                    <td style={{ padding: '6px 8px' }}>{row.season}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <button 
                        onClick={() => removeRow(i)}
                        style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {csvData.length > 10 && (
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td colSpan={6} style={{ padding: '8px', textAlign: 'center', color: 'var(--text3)', fontSize: '11px' }}>
                      ... and {csvData.length - 10} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  )
}

function BatchModal({ skus, preSkuId, garageId, onClose, onSave }) {
  const [form, setForm] = useState({ skuId: preSkuId || '', date: new Date().toISOString().split('T')[0], qty: '', cost: '', supplier: '', ref: '', notes: '' })
  const [invoiceFile, setInvoiceFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)
  
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setUploadError('Please upload a PDF or image file (JPG, PNG, WebP)')
        return
      }
      // Validate file size (max 5MB)
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
      
      const { data, error } = await supabase.storage
        .from('purchase-invoices')
        .upload(fileName, invoiceFile)

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('purchase-invoices')
        .getPublicUrl(fileName)

      setUploading(false)
      return publicUrl
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

    let invoiceUrl = null
    if (invoiceFile) {
      invoiceUrl = await uploadInvoice()
    }

    onSave({
      ...form,
      qty: parseInt(form.qty),
      cost: parseFloat(form.cost),
      invoiceUrl
    })
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
        <Field label="Supplier"><input style={inputStyle} value={form.supplier} onChange={e => f('supplier', e.target.value)} placeholder="Aldridge Tyres Ltd" /></Field>
        <Field label="Invoice Ref"><input style={inputStyle} value={form.ref} onChange={e => f('ref', e.target.value)} placeholder="ALD-2025-0123" /></Field>
      </div>
      <div style={{ marginTop: '12px' }}>
        <Field label="Notes"><input style={inputStyle} value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes..." /></Field>
      </div>

      {/* Invoice Upload Section */}
      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <Field label="Purchase Invoice (optional)">
          <input 
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {!invoiceFile ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              style={{
                ...inputStyle,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '16px',
                cursor: 'pointer',
                border: '2px dashed var(--border)',
              }}
            >
              <span>📄</span>
              <span style={{ color: 'var(--text2)' }}>Click to upload PDF or image</span>
            </div>
          ) : (
            <div style={{
              ...inputStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
            }}>
              <span style={{ color: 'var(--green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✓ {invoiceFile.name}
              </span>
              <button 
                onClick={() => setInvoiceFile(null)}
                style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          )}
        </Field>
        {uploadError && (
          <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '6px' }}>{uploadError}</div>
        )}
      </div>
    </Modal>
  )
}

function UsedModal({ onClose, onSave }) {
  const [form, setForm] = useState({ brand: '', model: '', w: '', p: '', r: '', tread: '', year: new Date().getFullYear(), cost: 0, sell: '', sourceCust: '', date: new Date().toISOString().split('T')[0], notes: '' })
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
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
        <Field label="Source Customer"><input style={inputStyle} value={form.sourceCust} onChange={e => f('sourceCust', e.target.value)} placeholder="Dave Patel" /></Field>
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

function BatchDetailsModal({ batch, skus, onClose }) {
  const sku = skus.find(s => s.id === batch.skuId)
  const skuLabel = sku ? `${sku.brand} ${sku.model} ${sku.w}/${sku.p}R${sku.r}` : 'Unknown Tyre'

  return (
    <Modal title="Batch Details" onClose={onClose} hideActions>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>Tyre</div>
        <div style={{ fontSize: '15px', fontWeight: 600 }}>{skuLabel}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }} className="form-grid-2">
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase' }}>Purchase Date</div>
          <div style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', marginTop: '4px' }}>{batch.date}</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase' }}>Cost Per Tyre</div>
          <div style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', marginTop: '4px', color: 'var(--accent)' }}>£{batch.cost?.toFixed(2)}</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase' }}>Original Qty</div>
          <div style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', marginTop: '4px' }}>{batch.qty}</div>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase' }}>Remaining</div>
          <div style={{ fontSize: '14px', fontFamily: 'DM Mono, monospace', marginTop: '4px', color: batch.remaining > 0 ? 'var(--green)' : 'var(--red)' }}>{batch.remaining}</div>
        </div>
      </div>

      {(batch.supplier || batch.ref) && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>Supplier Details</div>
          <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '12px' }}>
            {batch.supplier && <div style={{ fontSize: '13px', fontWeight: 600 }}>{batch.supplier}</div>}
            {batch.ref && <div style={{ fontSize: '12px', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginTop: '2px' }}>Ref: {batch.ref}</div>}
          </div>
        </div>
      )}

      {batch.notes && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>Notes</div>
          <div style={{ fontSize: '12px', color: 'var(--text2)' }}>{batch.notes}</div>
        </div>
      )}

      {/* Purchase Invoice Section */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>Purchase Invoice</div>
        {batch.invoiceUrl ? (
          <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
            <a 
              href={batch.invoiceUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '8px',
                background: 'var(--accent)',
                color: '#000',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '13px',
                textDecoration: 'none',
              }}
            >
              📄 View Purchase Invoice
            </a>
            <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '8px' }}>Opens in new tab</div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface2)', borderRadius: '8px', padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
            No invoice uploaded for this batch
          </div>
        )}
      </div>

      {/* VAT Breakdown */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '8px' }}>VAT Breakdown</div>
        <div style={{ background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)', borderRadius: '8px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text2)' }}>Batch cost (ex VAT)</span>
            <span style={{ fontFamily: 'DM Mono, monospace' }}>£{(batch.qty * batch.cost).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text2)' }}>Input VAT @ 20%</span>
            <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>£{(batch.qty * batch.cost * 0.2).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px' }}>
            <span>Total paid (inc VAT)</span>
            <span style={{ fontFamily: 'DM Mono, monospace' }}>£{(batch.qty * batch.cost * 1.2).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <Btn variant="secondary" onClick={onClose}>Close</Btn>
      </div>
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