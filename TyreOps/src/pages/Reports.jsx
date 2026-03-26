import { useState } from 'react'
import { useStore, TIER_ORDER } from '../store/useStore'
import { PageHeader, Card, Btn, Badge, StatCard } from '../components/UI'

// Date range presets
const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
]

// Report types
const REPORT_TYPES = [
  { 
    key: 'sales', 
    icon: '📊', 
    label: 'Sales Report', 
    desc: 'Revenue, invoices, and sales breakdown by period',
    tier: 'bronze'
  },
  { 
    key: 'profit', 
    icon: '💰', 
    label: 'Profit & Loss', 
    desc: 'Revenue vs costs, gross profit margins',
    tier: 'silver'
  },
  { 
    key: 'inventory', 
    icon: '📦', 
    label: 'Inventory Report', 
    desc: 'Stock levels, batch details, low stock items',
    tier: 'bronze'
  },
  { 
    key: 'customers', 
    icon: '👥', 
    label: 'Customer Report', 
    desc: 'Customer list, spending history, top customers',
    tier: 'bronze'
  },
  { 
    key: 'purchases', 
    icon: '🧾', 
    label: 'Purchase History', 
    desc: 'Supplier orders, batch costs, purchase invoices',
    tier: 'silver'
  },
  { 
    key: 'vat', 
    icon: '📈', 
    label: 'VAT Summary', 
    desc: 'Output VAT, Input VAT, net VAT liability',
    tier: 'silver'
  },
  { 
    key: 'tyres', 
    icon: '🛞', 
    label: 'Tyre Sales Analysis', 
    desc: 'Best sellers, brand breakdown, margin analysis',
    tier: 'gold'
  },
]

function getDateRange(preset, customFrom, customTo) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'week': {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      return { from: weekStart, to: today }
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: monthStart, to: today }
    }
    case 'quarter': {
      const qMonth = Math.floor(today.getMonth() / 3) * 3
      const quarterStart = new Date(today.getFullYear(), qMonth, 1)
      return { from: quarterStart, to: today }
    }
    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1)
      return { from: yearStart, to: today }
    }
    case 'custom':
      return { 
        from: customFrom ? new Date(customFrom) : today, 
        to: customTo ? new Date(customTo) : today 
      }
    default:
      return { from: today, to: today }
  }
}

export default function Reports() {
  const { invoices, customers, skus, batches, usedTyres, tier, settings } = useStore()
  const [datePreset, setDatePreset] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)
  const [exportFormat, setExportFormat] = useState('csv')

  const hasSilver = TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf('silver')
  const hasGold = tier === 'gold'

  const { from: dateFrom, to: dateTo } = getDateRange(datePreset, customFrom, customTo)

  // Filter invoices by date range
  const filteredInvoices = invoices.filter(inv => {
    if (inv.status === 'draft') return false
    const d = new Date(inv.date)
    return d >= dateFrom && d <= dateTo
  })

  // Calculate summary stats
  const totalRevenue = filteredInvoices.reduce((sum, inv) => 
    sum + inv.lines.reduce((a, l) => a + l.qty * l.unit, 0), 0
  )
  const totalCost = filteredInvoices.reduce((sum, inv) => 
    sum + inv.lines.reduce((a, l) => a + l.qty * (l.cost || 0), 0), 0
  )
  const grossProfit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0

  // Generate report data
  const generateReportData = (reportType) => {
    switch (reportType) {
      case 'sales':
        return generateSalesReport()
      case 'profit':
        return generateProfitReport()
      case 'inventory':
        return generateInventoryReport()
      case 'customers':
        return generateCustomerReport()
      case 'purchases':
        return generatePurchaseReport()
      case 'vat':
        return generateVATReport()
      case 'tyres':
        return generateTyreAnalysis()
      default:
        return { headers: [], rows: [] }
    }
  }

  const generateSalesReport = () => {
    const headers = ['Invoice #', 'Date', 'Customer', 'Vehicle Reg', 'Items', 'Subtotal', 'VAT', 'Total', 'Status', 'Payment Method']
    const rows = filteredInvoices.map(inv => {
      const subtotal = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
      const vat = subtotal * 0.2 // Simplified - should use actual VAT calculation
      return [
        inv.id,
        inv.date,
        inv.custName,
        inv.reg || '',
        inv.lines.length,
        `£${subtotal.toFixed(2)}`,
        `£${vat.toFixed(2)}`,
        `£${(subtotal + vat).toFixed(2)}`,
        inv.status,
        inv.paymentMethod || 'N/A'
      ]
    })
    return { headers, rows, title: 'Sales Report' }
  }

  const generateProfitReport = () => {
    const headers = ['Invoice #', 'Date', 'Customer', 'Revenue', 'Cost', 'Gross Profit', 'Margin %']
    const rows = filteredInvoices.map(inv => {
      const revenue = inv.lines.reduce((a, l) => a + l.qty * l.unit, 0)
      const cost = inv.lines.reduce((a, l) => a + l.qty * (l.cost || 0), 0)
      const profit = revenue - cost
      const marginPct = revenue > 0 ? Math.round((profit / revenue) * 100) : 0
      return [
        inv.id,
        inv.date,
        inv.custName,
        `£${revenue.toFixed(2)}`,
        `£${cost.toFixed(2)}`,
        `£${profit.toFixed(2)}`,
        `${marginPct}%`
      ]
    })
    // Add totals row
    rows.push([
      'TOTAL',
      '',
      '',
      `£${totalRevenue.toFixed(2)}`,
      `£${totalCost.toFixed(2)}`,
      `£${grossProfit.toFixed(2)}`,
      `${margin}%`
    ])
    return { headers, rows, title: 'Profit & Loss Report' }
  }

  const generateInventoryReport = () => {
    const headers = ['SKU', 'Brand', 'Model', 'Size', 'In Stock', 'FIFO Cost', 'Sell Price', 'Stock Value', 'Alert Level', 'Status']
    const rows = skus.map(sk => {
      const activeBatches = batches.filter(b => b.skuId === sk.id && b.remaining > 0)
      const totalStock = activeBatches.reduce((a, b) => a + b.remaining, 0)
      const fifoCost = activeBatches[0]?.cost || 0
      const stockValue = activeBatches.reduce((a, b) => a + b.remaining * b.cost, 0)
      const status = totalStock === 0 ? 'OUT OF STOCK' : totalStock <= sk.alert ? 'LOW STOCK' : 'OK'
      return [
        sk.id,
        sk.brand,
        sk.model,
        `${sk.w}/${sk.p}R${sk.r}`,
        totalStock,
        `£${fifoCost.toFixed(2)}`,
        `£${sk.sell.toFixed(2)}`,
        `£${stockValue.toFixed(2)}`,
        sk.alert,
        status
      ]
    })
    return { headers, rows, title: 'Inventory Report' }
  }

  const generateCustomerReport = () => {
    const headers = ['Name', 'Email', 'Phone', 'Vehicles', 'Total Invoices', 'Total Spent', 'Last Invoice']
    const rows = customers.map(c => {
      const custInvs = invoices.filter(inv => inv.custId === c.id || inv.custName === c.name)
      const totalSpent = custInvs.reduce((sum, inv) => 
        sum + inv.lines.reduce((a, l) => a + l.qty * l.unit, 0), 0
      )
      const lastInv = custInvs.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
      const vehicles = c.vehicles?.map(v => v.reg).join(', ') || c.reg || ''
      return [
        c.name,
        c.email || '',
        c.phone || '',
        vehicles,
        custInvs.length,
        `£${totalSpent.toFixed(2)}`,
        lastInv?.date || 'Never'
      ]
    }).sort((a, b) => parseFloat(b[5].replace('£', '')) - parseFloat(a[5].replace('£', '')))
    return { headers, rows, title: 'Customer Report' }
  }

  const generatePurchaseReport = () => {
    const headers = ['Batch ID', 'Date', 'Tyre', 'Supplier', 'Ref', 'Qty', 'Cost/ea', 'Total Cost', 'Remaining']
    const rows = batches.map(b => {
      const sk = skus.find(s => s.id === b.skuId)
      return [
        b.id,
        b.date,
        sk ? `${sk.brand} ${sk.model} (${sk.w}/${sk.p}R${sk.r})` : 'Unknown',
        b.supplier || '',
        b.ref || '',
        b.qty,
        `£${b.cost.toFixed(2)}`,
        `£${(b.qty * b.cost).toFixed(2)}`,
        b.remaining
      ]
    }).sort((a, b) => new Date(b[1]) - new Date(a[1]))
    return { headers, rows, title: 'Purchase History Report' }
  }

  const generateVATReport = () => {
    let outputVAT = 0
    let inputVAT = 0
    
    filteredInvoices.forEach(inv => {
      inv.lines.forEach(l => {
        const lineTotal = l.qty * l.unit
        outputVAT += lineTotal * 0.2
        if (l.lineType === 'new' && l.cost) {
          inputVAT += l.qty * l.cost * 0.2
        }
      })
    })

    const headers = ['Category', 'Amount']
    const rows = [
      ['Total Sales (ex VAT)', `£${totalRevenue.toFixed(2)}`],
      ['Output VAT (20%)', `£${outputVAT.toFixed(2)}`],
      ['Stock Cost Sold', `£${totalCost.toFixed(2)}`],
      ['Input VAT Reclaimable', `£${inputVAT.toFixed(2)}`],
      ['Net VAT Due', `£${(outputVAT - inputVAT).toFixed(2)}`],
    ]
    return { headers, rows, title: 'VAT Summary Report' }
  }

  const generateTyreAnalysis = () => {
    const tyreSales = {}
    filteredInvoices.forEach(inv => {
      inv.lines.forEach(l => {
        if (l.skuId) {
          if (!tyreSales[l.skuId]) {
            tyreSales[l.skuId] = { qty: 0, revenue: 0, cost: 0 }
          }
          tyreSales[l.skuId].qty += l.qty
          tyreSales[l.skuId].revenue += l.qty * l.unit
          tyreSales[l.skuId].cost += l.qty * (l.cost || 0)
        }
      })
    })

    const headers = ['Tyre', 'Size', 'Units Sold', 'Revenue', 'Cost', 'Profit', 'Margin %']
    const rows = Object.entries(tyreSales)
      .map(([skuId, data]) => {
        const sk = skus.find(s => s.id === skuId)
        const profit = data.revenue - data.cost
        const marginPct = data.revenue > 0 ? Math.round((profit / data.revenue) * 100) : 0
        return [
          sk ? `${sk.brand} ${sk.model}` : 'Unknown',
          sk ? `${sk.w}/${sk.p}R${sk.r}` : '',
          data.qty,
          `£${data.revenue.toFixed(2)}`,
          `£${data.cost.toFixed(2)}`,
          `£${profit.toFixed(2)}`,
          `${marginPct}%`
        ]
      })
      .sort((a, b) => b[2] - a[2])

    return { headers, rows, title: 'Tyre Sales Analysis' }
  }

  // Export functions
  const exportToCSV = (reportType) => {
    const data = generateReportData(reportType)
    const csvContent = [
      data.headers.join(','),
      ...data.rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${data.title.replace(/\s+/g, '_')}_${dateFrom.toISOString().split('T')[0]}_to_${dateTo.toISOString().split('T')[0]}.csv`
    link.click()
  }

  const exportToJSON = (reportType) => {
    const data = generateReportData(reportType)
    const jsonData = {
      report: data.title,
      dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      generatedAt: new Date().toISOString(),
      garage: settings.name,
      data: data.rows.map(row => {
        const obj = {}
        data.headers.forEach((h, i) => obj[h] = row[i])
        return obj
      })
    }
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${data.title.replace(/\s+/g, '_')}_${dateFrom.toISOString().split('T')[0]}.json`
    link.click()
  }

  const printReport = (reportType) => {
    const data = generateReportData(reportType)
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${data.title} - ${settings.name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; margin-bottom: 5px; }
          .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f5f5f5; font-weight: 600; }
          tr:nth-child(even) { background: #fafafa; }
          .footer { margin-top: 30px; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <h1>${data.title}</h1>
        <div class="meta">
          ${settings.name}<br>
          Period: ${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}<br>
          Generated: ${new Date().toLocaleString()}
        </div>
        <table>
          <thead><tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${data.rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div class="footer">Generated by Alzaro TyreOps</div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExport = (reportType) => {
    if (exportFormat === 'csv') {
      exportToCSV(reportType)
    } else if (exportFormat === 'json') {
      exportToJSON(reportType)
    } else if (exportFormat === 'print') {
      printReport(reportType)
    }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Export and analyse your business data" />

      {/* Date Range Selector */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>
          Date Range
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: datePreset === 'custom' ? '12px' : 0 }}>
          {DATE_PRESETS.map(p => (
            <div 
              key={p.key} 
              onClick={() => setDatePreset(p.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                background: datePreset === p.key ? 'var(--accent)' : 'var(--surface2)',
                color: datePreset === p.key ? '#000' : 'var(--text2)',
                border: '1px solid',
                borderColor: datePreset === p.key ? 'var(--accent)' : 'var(--border)',
                transition: 'all 0.15s'
              }}
            >
              {p.label}
            </div>
          ))}
        </div>
        
        {datePreset === 'custom' && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>From</label>
              <input 
                type="date" 
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                style={{ 
                  background: 'var(--surface2)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  padding: '8px 12px', 
                  color: 'var(--text)', 
                  fontSize: '12px',
                  outline: 'none'
                }} 
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: '4px' }}>To</label>
              <input 
                type="date" 
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                style={{ 
                  background: 'var(--surface2)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  padding: '8px 12px', 
                  color: 'var(--text)', 
                  fontSize: '12px',
                  outline: 'none'
                }} 
              />
            </div>
          </div>
        )}
      </Card>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }} className="stat-grid">
        <StatCard label="Revenue" value={`£${totalRevenue.toFixed(2)}`} delta={`${filteredInvoices.length} invoices`} color="var(--accent)" />
        <StatCard label="Cost of Sales" value={`£${totalCost.toFixed(2)}`} delta="FIFO costed" />
        <StatCard label="Gross Profit" value={`£${grossProfit.toFixed(2)}`} delta={`${margin}% margin`} color="var(--green)" />
        <StatCard label="Customers" value={customers.length} delta="total registered" color="var(--blue)" />
      </div>

      {/* Export Format Selector */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>
            Export Format
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { key: 'csv', label: '📊 CSV', desc: 'Excel compatible' },
              { key: 'json', label: '{ } JSON', desc: 'Data format' },
              { key: 'print', label: '🖨 Print', desc: 'Print or PDF' },
            ].map(f => (
              <div 
                key={f.key}
                onClick={() => setExportFormat(f.key)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: exportFormat === f.key ? 'var(--surface3)' : 'transparent',
                  color: exportFormat === f.key ? 'var(--text)' : 'var(--text2)',
                  border: '1px solid',
                  borderColor: exportFormat === f.key ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {f.label}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Report Types Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {REPORT_TYPES.map(report => {
          const isLocked = (report.tier === 'silver' && !hasSilver) || (report.tier === 'gold' && !hasGold)
          return (
            <Card key={report.key} style={{ opacity: isLocked ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ 
                  fontSize: '28px', 
                  width: '48px', 
                  height: '48px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'var(--surface2)',
                  borderRadius: '10px'
                }}>
                  {report.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '15px', fontWeight: 700 }}>
                      {report.label}
                    </div>
                    {isLocked && (
                      <Badge variant={report.tier === 'gold' ? 'yellow' : 'gray'}>
                        {report.tier === 'gold' ? '🥇 Gold' : '🥈 Silver'}
                      </Badge>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', marginBottom: '12px' }}>
                    {report.desc}
                  </div>
                  {isLocked ? (
                    <Btn variant="secondary" sm onClick={() => alert('Upgrade your plan to access this report')}>
                      🔒 Upgrade to {report.tier === 'gold' ? 'Gold' : 'Silver'}
                    </Btn>
                  ) : (
                    <Btn variant="primary" sm onClick={() => handleExport(report.key)}>
                      ⬇ Export {exportFormat.toUpperCase()}
                    </Btn>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions */}
      <Card style={{ marginTop: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace', marginBottom: '12px' }}>
          Quick Export
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Btn variant="secondary" onClick={() => exportToCSV('sales')}>📊 Sales CSV</Btn>
          <Btn variant="secondary" onClick={() => exportToCSV('customers')}>👥 Customers CSV</Btn>
          <Btn variant="secondary" onClick={() => exportToCSV('inventory')}>📦 Inventory CSV</Btn>
          {hasSilver && <Btn variant="secondary" onClick={() => exportToCSV('profit')}>💰 P&L CSV</Btn>}
          {hasSilver && <Btn variant="secondary" onClick={() => exportToCSV('vat')}>📈 VAT CSV</Btn>}
        </div>
      </Card>
    </div>
  )
}
