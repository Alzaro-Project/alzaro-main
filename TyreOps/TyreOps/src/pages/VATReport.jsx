import { useState, useEffect } from 'react'
import { useStore, TIER_ORDER } from '../store/useStore'
import { PageHeader, Card, Btn } from '../components/UI'

// Print styles - hide sidebar when printing
const printStyles = `
@media print {
  .sidebar, nav, .no-print { display: none !important; }
  body { background: white !important; }
  .print-content { 
    margin: 0 !important; 
    padding: 20px !important;
    width: 100% !important;
    max-width: 100% !important;
  }
  * { color: black !important; background: white !important; border-color: #ccc !important; }
}
`

// Get current quarter and year
function getCurrentQuarterYear() {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const year = now.getFullYear().toString()
  let quarter
  if (month >= 1 && month <= 3) quarter = 'Q1'
  else if (month >= 4 && month <= 6) quarter = 'Q2'
  else if (month >= 7 && month <= 9) quarter = 'Q3'
  else quarter = 'Q4'
  return { quarter, year }
}

export default function VATReport() {
  const { invoices, batches, settings, tier, updateSettings } = useStore()
  
  // Auto-select current quarter and year
  const current = getCurrentQuarterYear()
  const [quarter, setQuarter] = useState(current.quarter)
  const [year, setYear] = useState(current.year)
  
  // Modal state for viewing purchase invoices
  const [viewingPurchaseInvoice, setViewingPurchaseInvoice] = useState(null)

  const hasSilver = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('silver')
  const isGold = tier === 'gold'

  const qMonths = { Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12] }
  const [mFrom, mTo] = qMonths[quarter] || [10, 12]

  // Track totals
  let totalSales = 0
  let vatOnSales = 0
  let stockCostSold = 0        // Cost of new tyre stock sold (for Input VAT)
  let serviceCosts = 0         // Service/labour costs (no Input VAT reclaimable)
  let marginSales = 0          // Used tyre sales (margin scheme)
  let marginCosts = 0          // Used tyre costs
  let marginVAT = 0            // VAT on margin only

  // Track batches used for clickable links
  const batchesUsed = []

  // Process invoices in the selected period
  invoices.forEach(inv => {
    if (inv.status === 'paid' || inv.status === 'sent') {
      const d = new Date(inv.date)
      const m = d.getMonth() + 1
      if (d.getFullYear() === parseInt(year) && m >= mFrom && m <= mTo) {
        inv.lines.forEach(l => {
          const lineTotal = l.qty * l.unit
          totalSales += lineTotal

          // Calculate Output VAT based on line type
          if (l.lineType === 'used' && l.marginScheme && isGold) {
            // Margin Scheme: VAT only on profit margin
            const margin = l.qty * (l.unit - (l.cost || 0))
            marginSales += lineTotal
            marginCosts += l.qty * (l.cost || 0)
            marginVAT += margin / 6 // VAT fraction (1/6 of gross margin)
          } else if (inv.vatScheme === 'standard') {
            vatOnSales += lineTotal * 0.2
          } else if (inv.vatScheme === 'flatrate') {
            vatOnSales += lineTotal * ((settings.flatRate || 8.5) / 100)
          }

          // Calculate Input VAT (only on stock sold, not services)
          if (l.lineType === 'new' && l.batchId) {
            // New tyre from batch - find the batch to get actual cost
            const batch = batches.find(b => b.id === l.batchId)
            if (batch) {
              stockCostSold += l.qty * batch.cost
              // Track batch for clickable link
              if (!batchesUsed.find(b => b.id === batch.id)) {
                batchesUsed.push({ ...batch, invoiceId: inv.id, qty: l.qty })
              }
            } else {
              // Fallback to line cost if batch not found
              stockCostSold += l.qty * (l.cost || 0)
            }
          } else if (l.lineType === 'new' && l.cost) {
            // New tyre without specific batch reference
            stockCostSold += l.qty * l.cost
          } else if (l.lineType === 'service') {
            // Services - track but no Input VAT reclaimable on labour
            serviceCosts += l.qty * (l.cost || 0)
          }
          // Note: Used tyres under margin scheme - no Input VAT reclaim
        })
      }
    }
  })

  // Input VAT: Only on stock sold (not on services, not on margin scheme items)
  const vatOnPurchases = stockCostSold * 0.2

  // Total Output VAT
  const totalVAT = vatOnSales + marginVAT

  // Net VAT due to HMRC
  const vatDue = totalVAT - vatOnPurchases

  // VAT saved by using margin scheme
  const vatSaved = marginSales > 0 ? (marginSales * 0.2 - marginVAT) : 0

  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 11px', color: 'var(--text)', fontSize: '12px', outline: 'none', width: '100%' }

  if (!hasSilver) return (
    <div>
      <PageHeader title="VAT Report" subtitle="HMRC VAT return summary" />
      <div style={{ background: 'var(--surface)', border: '1px dashed rgba(245,200,66,.3)', borderRadius: '14px', padding: '32px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '16px', color: 'var(--accent)', marginBottom: '8px' }}>🥈 Silver Plan Required</div>
        <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>VAT reports are available on Silver and Gold plans.</div>
        <Btn variant="primary">Upgrade Plan</Btn>
      </div>
    </div>
  )

  // Generate years for dropdown (current year + 2 previous)
  const currentYear = new Date().getFullYear()
  const years = [currentYear, currentYear - 1, currentYear - 2]

  return (
    <div className="print-content">
      {/* Inject print styles */}
      <style>{printStyles}</style>
      
      <PageHeader title="VAT Report" subtitle="HMRC VAT return summary" />

      {/* Config */}
      <Card style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>VAT Configuration</div>
        <div style={{ display: 'grid', gridTemplateColumns: settings.vatScheme === 'flatrate' ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>VAT Scheme</label>
            <select style={inputStyle} value={settings.vatScheme} onChange={e => updateSettings({ vatScheme: e.target.value })}>
              <option value="standard">Standard Rate (20%)</option>
              <option value="flatrate">Flat Rate Scheme</option>
              <option value="exempt">VAT Exempt</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>VAT Number</label>
            <input style={inputStyle} value={settings.vatNumber || ''} onChange={e => updateSettings({ vatNumber: e.target.value })} placeholder="GB123456789" />
          </div>
          {/* Only show Flat Rate % if flat rate scheme is selected */}
          {settings.vatScheme === 'flatrate' && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Flat Rate %</label>
              <input style={inputStyle} type="number" value={settings.flatRate || 8.5} onChange={e => updateSettings({ flatRate: parseFloat(e.target.value) })} />
            </div>
          )}
        </div>
        {isGold && (
          <div style={{ marginTop: '12px', background: 'rgba(45,212,191,.08)', border: '1px solid rgba(45,212,191,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--teal)' }}>
            ♻ Gold Plan: VAT Margin Scheme active for used/part-ex tyres — VAT on profit margin only.
          </div>
        )}
      </Card>

      {/* Period - Auto-selects current quarter/year */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', maxWidth: '380px', marginBottom: '18px' }}>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Quarter</label>
          <select style={inputStyle} value={quarter} onChange={e => setQuarter(e.target.value)}>
            <option value="Q1">Q1 (Jan–Mar)</option>
            <option value="Q2">Q2 (Apr–Jun)</option>
            <option value="Q3">Q3 (Jul–Sep)</option>
            <option value="Q4">Q4 (Oct–Dec)</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>Year</label>
          <select style={inputStyle} value={year} onChange={e => setYear(e.target.value)}>
            {years.map(y => (
              <option key={y} value={y.toString()}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>Total Sales (ex VAT)</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '24px', fontWeight: 500, marginTop: '5px', color: 'var(--accent)' }}>£{totalSales.toFixed(2)}</div>
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>Net VAT {vatDue >= 0 ? 'Due to' : 'Refund from'} HMRC</div>
          <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '24px', fontWeight: 500, marginTop: '5px', color: vatDue >= 0 ? 'var(--red)' : 'var(--green)' }}>£{Math.abs(vatDue).toFixed(2)}</div>
        </div>
      </div>

      {/* VAT Calculation Breakdown with clickable costs */}
      <Card style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>VAT Calculation Breakdown</div>
        <div style={{ background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: 'var(--blue)', marginBottom: '12px' }}>
          ℹ️ Input VAT is calculated on <strong>stock sold</strong> in this period, not on purchases made. This follows HMRC rules for stock-based businesses.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ background: 'var(--surface2)', borderRadius: '9px', padding: '12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', marginBottom: '8px' }}>Output VAT (You Collect)</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text2)' }}>Standard rate sales</span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>£{vatOnSales.toFixed(2)}</span>
            </div>
            {marginVAT > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--teal)' }}>Margin scheme VAT</span>
                <span style={{ fontFamily: 'DM Mono, monospace' }}>£{marginVAT.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px' }}>
              <span>Total Output VAT</span>
              <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--red)' }}>£{totalVAT.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface2)', borderRadius: '9px', padding: '12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', marginBottom: '8px' }}>Input VAT (You Reclaim)</div>
            {/* Clickable stock cost - shows purchase invoice modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', alignItems: 'center' }}>
              <span 
                style={{ 
                  color: batchesUsed.length > 0 ? 'var(--accent)' : 'var(--text2)', 
                  cursor: batchesUsed.length > 0 ? 'pointer' : 'default',
                  textDecoration: batchesUsed.length > 0 ? 'underline' : 'none',
                }}
                onClick={() => batchesUsed.length > 0 && setViewingPurchaseInvoice('costs')}
                title={batchesUsed.length > 0 ? 'Click to view purchase invoices' : ''}
              >
                Stock cost sold {batchesUsed.length > 0 && '▾'}
              </span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>£{stockCostSold.toFixed(2)}</span>
            </div>
            {/* Clickable Input VAT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', alignItems: 'center' }}>
              <span 
                style={{ 
                  color: batchesUsed.length > 0 ? 'var(--accent)' : 'var(--text2)', 
                  cursor: batchesUsed.length > 0 ? 'pointer' : 'default',
                  textDecoration: batchesUsed.length > 0 ? 'underline' : 'none',
                }}
                onClick={() => batchesUsed.length > 0 && setViewingPurchaseInvoice('vat')}
                title={batchesUsed.length > 0 ? 'Click to view purchase invoices' : ''}
              >
                VAT @ 20% {batchesUsed.length > 0 && '▾'}
              </span>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>£{vatOnPurchases.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px' }}>
              <span>Total Input VAT</span>
              <span style={{ fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>£{vatOnPurchases.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* HMRC Boxes */}
      <Card style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>HMRC VAT Return Boxes</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {[
            ['Box 1', 'VAT due on sales & outputs', `£${totalVAT.toFixed(2)}`],
            ['Box 4', 'VAT reclaimed on purchases', `£${vatOnPurchases.toFixed(2)}`],
            ['Box 5', `Net VAT to ${vatDue >= 0 ? 'pay' : 'reclaim'}`, `£${Math.abs(vatDue).toFixed(2)}`],
            ['Box 6', 'Total value of sales (ex VAT)', `£${totalSales.toFixed(2)}`],
            ['Box 7', 'Total value of purchases (ex VAT)', `£${stockCostSold.toFixed(2)}`],
          ].map(([box, label, val]) => (
            <div key={box} style={{ background: 'var(--surface2)', borderRadius: '9px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{box}</div>
                <div style={{ fontSize: '11px', color: 'var(--text2)', marginTop: '2px' }}>{label}</div>
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '15px', fontWeight: 500 }}>{val}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Margin scheme section (Gold) */}
      {isGold && marginSales > 0 && (
        <Card style={{ marginBottom: '14px', border: '1px solid rgba(45,212,191,.25)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--teal)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>♻ VAT Margin Scheme — Used Tyres</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
            {[['Used Tyre Sales', `£${marginSales.toFixed(2)}`, 'var(--teal)'], ['Cost of Used Stock', `£${marginCosts.toFixed(2)}`, 'var(--text)'], ['VAT on Margin Only', `£${marginVAT.toFixed(2)}`, 'var(--green)']].map(([l, v, c]) => (
              <div key={l}>
                <div style={{ fontSize: '10px', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', letterSpacing: '.8px' }}>{l}</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '20px', fontWeight: 500, marginTop: '4px', color: c }}>{v}</div>
              </div>
            ))}
          </div>
          {vatSaved > 0 && <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--green)' }}>✓ Saved £{vatSaved.toFixed(2)} vs standard rate VAT</div>}
        </Card>
      )}

      {/* Detailed Invoice Breakdown */}
      <Card style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>📋 Detailed Invoice Breakdown</div>
        
        {/* Filter invoices for period */}
        {(() => {
          const periodInvoices = invoices.filter(inv => {
            if (inv.status !== 'paid' && inv.status !== 'sent') return false
            const d = new Date(inv.date)
            const m = d.getMonth() + 1
            return d.getFullYear() === parseInt(year) && m >= mFrom && m <= mTo
          })

          if (periodInvoices.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text3)', fontSize: '12px' }}>
                No invoices found for {quarter} {year}
              </div>
            )
          }

          // Group by VAT scheme - only show relevant sections based on selected scheme
          const byScheme = {
            standard: periodInvoices.filter(inv => inv.vatScheme === 'standard'),
            flatrate: periodInvoices.filter(inv => inv.vatScheme === 'flatrate'),
            margin: periodInvoices.filter(inv => inv.lines.some(l => l.lineType === 'used' && l.marginScheme))
          }

          return (
            <div>
              {/* Standard Rate Invoices - only show if standard scheme or has standard invoices */}
              {(settings.vatScheme === 'standard' || byScheme.standard.length > 0) && byScheme.standard.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'DM Mono, monospace', marginBottom: '8px', padding: '6px 10px', background: 'rgba(245,200,66,.1)', borderRadius: '6px', display: 'inline-block' }}>
                    STANDARD RATE (20%)
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr>
                          {['Invoice', 'Date', 'Customer', 'Net Sales', 'VAT (20%)', 'Stock Cost', 'Input VAT'].map(h => (
                            <th key={h} style={{ textAlign: h === 'Invoice' || h === 'Customer' ? 'left' : 'right', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {byScheme.standard.map(inv => {
                          const net = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
                          const outputVat = net * 0.2
                          const invBatches = []
                          const cost = inv.lines.filter(l => l.lineType === 'new').reduce((a, l) => {
                            const batch = batches.find(b => b.id === l.batchId)
                            if (batch) invBatches.push(batch)
                            return a + l.qty * (batch?.cost || l.cost || 0)
                          }, 0)
                          const inputVat = cost * 0.2
                          return (
                            <tr key={inv.id}>
                              <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{inv.id}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{inv.date}</td>
                              <td style={{ padding: '8px' }}>{inv.custName}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>£{net.toFixed(2)}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--red)' }}>£{outputVat.toFixed(2)}</td>
                              {/* Clickable stock cost */}
                              <td 
                                style={{ 
                                  padding: '8px', 
                                  textAlign: 'right', 
                                  fontFamily: 'DM Mono, monospace', 
                                  color: invBatches.length > 0 ? 'var(--accent)' : 'var(--text2)',
                                  cursor: invBatches.length > 0 ? 'pointer' : 'default',
                                  textDecoration: invBatches.length > 0 ? 'underline' : 'none',
                                }}
                                onClick={() => invBatches.length > 0 && setViewingPurchaseInvoice({ type: 'invoice', batches: invBatches, invoiceId: inv.id })}
                                title={invBatches.length > 0 ? 'Click to view purchase invoices' : ''}
                              >
                                £{cost.toFixed(2)}
                              </td>
                              {/* Clickable input VAT */}
                              <td 
                                style={{ 
                                  padding: '8px', 
                                  textAlign: 'right', 
                                  fontFamily: 'DM Mono, monospace', 
                                  color: invBatches.length > 0 ? 'var(--green)' : 'var(--green)',
                                  cursor: invBatches.length > 0 ? 'pointer' : 'default',
                                  textDecoration: invBatches.length > 0 ? 'underline' : 'none',
                                }}
                                onClick={() => invBatches.length > 0 && setViewingPurchaseInvoice({ type: 'invoice', batches: invBatches, invoiceId: inv.id })}
                                title={invBatches.length > 0 ? 'Click to view purchase invoices' : ''}
                              >
                                £{inputVat.toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                        <tr style={{ borderTop: '2px solid var(--border)', fontWeight: 600 }}>
                          <td colSpan={3} style={{ padding: '8px' }}>Subtotal ({byScheme.standard.length} invoices)</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>
                            £{byScheme.standard.reduce((a, inv) => a + inv.lines.reduce((b, l) => b + l.qty * l.unit, 0), 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--red)' }}>
                            £{(byScheme.standard.reduce((a, inv) => a + inv.lines.reduce((b, l) => b + l.qty * l.unit, 0), 0) * 0.2).toFixed(2)}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>—</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Flat Rate Invoices - only show if flat rate scheme selected */}
              {settings.vatScheme === 'flatrate' && byScheme.flatrate.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--blue)', fontFamily: 'DM Mono, monospace', marginBottom: '8px', padding: '6px 10px', background: 'rgba(96,165,250,.1)', borderRadius: '6px', display: 'inline-block' }}>
                    FLAT RATE SCHEME ({settings.flatRate || 8.5}%)
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr>
                          {['Invoice', 'Date', 'Customer', 'Gross Sales', `VAT (${settings.flatRate || 8.5}%)`].map(h => (
                            <th key={h} style={{ textAlign: h === 'Invoice' || h === 'Customer' ? 'left' : 'right', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {byScheme.flatrate.map(inv => {
                          const gross = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
                          const flatVat = gross * ((settings.flatRate || 8.5) / 100)
                          return (
                            <tr key={inv.id}>
                              <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{inv.id}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{inv.date}</td>
                              <td style={{ padding: '8px' }}>{inv.custName}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>£{gross.toFixed(2)}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--red)' }}>£{flatVat.toFixed(2)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Margin Scheme Invoices */}
              {isGold && byScheme.margin.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--teal)', fontFamily: 'DM Mono, monospace', marginBottom: '8px', padding: '6px 10px', background: 'rgba(45,212,191,.1)', borderRadius: '6px', display: 'inline-block' }}>
                    ♻ MARGIN SCHEME (Used Tyres)
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                      <thead>
                        <tr>
                          {['Invoice', 'Date', 'Customer', 'Sale Price', 'Cost', 'Margin', 'VAT on Margin'].map(h => (
                            <th key={h} style={{ textAlign: h === 'Invoice' || h === 'Customer' ? 'left' : 'right', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text3)', fontFamily: 'DM Mono, monospace', padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {byScheme.margin.map(inv => {
                          const usedLines = inv.lines.filter(l => l.lineType === 'used' && l.marginScheme)
                          const salePrice = usedLines.reduce((a, l) => a + l.qty * l.unit, 0)
                          const cost = usedLines.reduce((a, l) => a + l.qty * (l.cost || 0), 0)
                          const margin = salePrice - cost
                          const marginVatCalc = margin / 6
                          return (
                            <tr key={inv.id}>
                              <td style={{ padding: '8px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{inv.id}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{inv.date}</td>
                              <td style={{ padding: '8px' }}>{inv.custName}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>£{salePrice.toFixed(2)}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>£{cost.toFixed(2)}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--teal)' }}>£{margin.toFixed(2)}</td>
                              <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>£{marginVatCalc.toFixed(2)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '8px', fontStyle: 'italic' }}>
                    * VAT on margin = (Sale Price - Cost) ÷ 6 (i.e., 1/6 of the gross margin)
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </Card>

      <div style={{ display: 'flex', gap: '8px' }} className="no-print">
        <Btn variant="primary" onClick={() => window.print()}>🖨 Print Report</Btn>
        <Btn variant="secondary" onClick={() => {
          const csv = `Box,Description,Amount\nBox 1,VAT on sales,£${totalVAT.toFixed(2)}\nBox 4,VAT reclaimed on stock sold,£${vatOnPurchases.toFixed(2)}\nBox 5,Net VAT ${vatDue >= 0 ? 'due' : 'refund'},£${Math.abs(vatDue).toFixed(2)}\nBox 6,Total Sales,£${totalSales.toFixed(2)}\nBox 7,Stock Cost Sold,£${stockCostSold.toFixed(2)}\n`
          const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = `VAT-${quarter}-${year}.csv`; a.click()
        }}>⬇ Export CSV</Btn>
      </div>

      {/* Purchase Invoice Modal */}
      {viewingPurchaseInvoice && (
        <PurchaseInvoiceModal 
          data={viewingPurchaseInvoice}
          batches={viewingPurchaseInvoice === 'costs' || viewingPurchaseInvoice === 'vat' ? batchesUsed : viewingPurchaseInvoice.batches}
          allBatches={batches}
          onClose={() => setViewingPurchaseInvoice(null)}
        />
      )}
    </div>
  )
}

// Modal to show purchase invoice details
function PurchaseInvoiceModal({ data, batches, allBatches, onClose }) {
  const title = data === 'costs' ? 'Stock Cost Breakdown' : 
                data === 'vat' ? 'Input VAT Breakdown' : 
                `Purchase Details for Invoice ${data.invoiceId}`

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,.75)', 
        zIndex: 500, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '16px' 
      }} 
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ 
        background: 'var(--surface)', 
        border: '1px solid var(--border)', 
        borderRadius: '16px', 
        width: '700px', 
        maxWidth: '100%', 
        maxHeight: '80vh', 
        overflowY: 'auto', 
        padding: '26px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '19px', fontWeight: 700 }}>{title}</div>
          <span style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: '18px' }} onClick={onClose}>✕</span>
        </div>

        <div style={{ background: 'rgba(96,165,250,.08)', border: '1px solid rgba(96,165,250,.2)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--blue)', marginBottom: '16px' }}>
          These are the purchase batches that contributed to the stock cost and Input VAT calculations.
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {['Batch', 'Date', 'Supplier', 'Ref', 'Cost/Tyre', 'VAT (20%)', 'Invoice'].map(h => (
                <th key={h} style={{ 
                  textAlign: h === 'Batch' || h === 'Supplier' || h === 'Invoice' ? 'left' : 'right', 
                  fontSize: '10px', 
                  fontWeight: 700, 
                  textTransform: 'uppercase', 
                  letterSpacing: '.5px', 
                  color: 'var(--text3)', 
                  fontFamily: 'DM Mono, monospace', 
                  padding: '8px', 
                  borderBottom: '1px solid var(--border)' 
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.map((b, i) => (
              <tr key={b.id + i}>
                <td style={{ padding: '10px 8px', fontFamily: 'DM Mono, monospace', color: 'var(--accent)' }}>{b.id?.slice(0, 8)}...</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--text2)' }}>{b.date}</td>
                <td style={{ padding: '10px 8px' }}>{b.supplier || '—'}</td>
                <td style={{ padding: '10px 8px', fontFamily: 'DM Mono, monospace', fontSize: '11px' }}>{b.ref || '—'}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>£{b.cost.toFixed(2)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: 'DM Mono, monospace', color: 'var(--green)' }}>£{(b.cost * 0.2).toFixed(2)}</td>
                <td style={{ padding: '10px 8px' }}>
                  {b.invoiceUrl ? (
                    <a 
                      href={b.invoiceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                    >
                      📄 View
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text3)', fontSize: '11px' }}>No file</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <Btn variant="secondary" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  )
}