import React from 'react'
import JSZip from 'jszip'
import { card, btnPri, btnSec, Modal } from '../components/UI.jsx'

export default function Reports({ invoices, expenses, mileage, canGold = false }) {
  const [msg, setMsg] = React.useState('')
  const [preview, setPreview] = React.useState(null) // { name, filename, rows }

  const download = (filename, rows) => {
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s
    }).join(',')).join('\n')
    const blob = new Blob([csv], { type:'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = filename; a.click()
    setMsg('Downloaded ' + filename); setTimeout(()=>setMsg(''), 2500)
  }

  const ym = d => (d||'').slice(0,7)
  const yr = d => (d||'').slice(0,4)
  const quarter = d => { const m = parseInt((d||'0-0').slice(5,7)); return 'Q' + (Math.ceil(m/3)||0) }
  const sum = (arr,f) => arr.reduce((s,x)=>s+(Number(f(x))||0),0)

  const paid = invoices.filter(i => i.status === 'paid')
  const totalRev = sum(paid, i=>i.total)
  const totalExp = sum(expenses, e=>e.amount)

  const groupBy = (arr, keyFn, valFn) => {
    const g = {}
    arr.forEach(x => { const k = keyFn(x); g[k] = (g[k]||0) + (Number(valFn(x))||0) })
    return Object.entries(g).sort()
  }

  const reports = [
    { id:'profit', name:'Profit & loss', desc:'Revenue, expenses, net profit', build: () => {
      const rows = [['Profit & Loss Report'],['Generated', new Date().toLocaleDateString('en-GB')],[],
        ['Revenue (paid invoices)', totalRev.toFixed(2)],
        ['Total expenses', totalExp.toFixed(2)],
        ['Net profit', (totalRev-totalExp).toFixed(2)]]
      return ['soloops-profit-loss.csv', rows]
    }},
    { id:'monthly', name:'Monthly report', desc:'Revenue & expenses by month', build: () => {
      const rev = Object.fromEntries(groupBy(paid, i=>ym(i.issue_date), i=>i.total))
      const exp = Object.fromEntries(groupBy(expenses, e=>ym(e.spent_on), e=>e.amount))
      const months = [...new Set([...Object.keys(rev),...Object.keys(exp)])].sort()
      const rows = [['Month','Revenue','Expenses','Profit'],
        ...months.map(m => [m, (rev[m]||0).toFixed(2), (exp[m]||0).toFixed(2), ((rev[m]||0)-(exp[m]||0)).toFixed(2)])]
      return ['soloops-monthly.csv', rows]
    }},
    { id:'quarterly', name:'Quarterly report', desc:'Revenue & expenses by quarter', build: () => {
      const rev = Object.fromEntries(groupBy(paid, i=>yr(i.issue_date)+' '+quarter(i.issue_date), i=>i.total))
      const exp = Object.fromEntries(groupBy(expenses, e=>yr(e.spent_on)+' '+quarter(e.spent_on), e=>e.amount))
      const qs = [...new Set([...Object.keys(rev),...Object.keys(exp)])].sort()
      const rows = [['Quarter','Revenue','Expenses','Profit'],
        ...qs.map(q => [q, (rev[q]||0).toFixed(2), (exp[q]||0).toFixed(2), ((rev[q]||0)-(exp[q]||0)).toFixed(2)])]
      return ['soloops-quarterly.csv', rows]
    }},
    { id:'annual', name:'Annual report', desc:'Revenue & expenses by year', build: () => {
      const rev = Object.fromEntries(groupBy(paid, i=>yr(i.issue_date), i=>i.total))
      const exp = Object.fromEntries(groupBy(expenses, e=>yr(e.spent_on), e=>e.amount))
      const ys = [...new Set([...Object.keys(rev),...Object.keys(exp)])].sort()
      const rows = [['Year','Revenue','Expenses','Profit'],
        ...ys.map(y => [y, (rev[y]||0).toFixed(2), (exp[y]||0).toFixed(2), ((rev[y]||0)-(exp[y]||0)).toFixed(2)])]
      return ['soloops-annual.csv', rows]
    }},
    { id:'expense', name:'Expense report', desc:'All expenses by category', build: () => {
      const byCat = groupBy(expenses, e=>e.category||'Other', e=>e.amount)
      const rows = [['Expense Report by Category'],[],['Category','Total'],
        ...byCat.map(([c,v]) => [c, v.toFixed(2)]),[],
        ['Line items'],['Date','Merchant','Category','Amount'],
        ...expenses.map(e => [e.spent_on, e.merchant, e.category, Number(e.amount).toFixed(2)])]
      return ['soloops-expenses.csv', rows]
    }},
    { id:'income', name:'Income report', desc:'All invoices & payments', build: () => {
      const rows = [['Income Report'],[],['Invoice','Client','Issued','Status','Total'],
        ...invoices.map(i => [i.number||'', i.client_name||'', i.issue_date||'', i.status||'', Number(i.total).toFixed(2)]),[],
        ['Total invoiced', sum(invoices,i=>i.total).toFixed(2)],
        ['Total paid', totalRev.toFixed(2)]]
      return ['soloops-income.csv', rows]
    }},
    { id:'tax', name:'Tax summary', desc:'Annual SA-ready summary (estimate)', build: () => {
      const profit = totalRev - totalExp
      const incomeTax = Math.max(0, profit*0.20)
      const nic = Math.max(0,(profit-12570)*0.09)
      const rows = [['Tax Summary (ESTIMATE ONLY — not tax advice)'],
        ['Generated', new Date().toLocaleDateString('en-GB')],[],
        ['Revenue (paid)', totalRev.toFixed(2)],
        ['Allowable expenses', totalExp.toFixed(2)],
        ['Mileage claim', (sum(mileage,m=>m.claim)).toFixed(2)],
        ['Taxable profit', profit.toFixed(2)],
        ['Income tax (est. @20%)', incomeTax.toFixed(2)],
        ['National Insurance (est.)', nic.toFixed(2)],
        ['Total estimated tax', (incomeTax+nic).toFixed(2)]]
      return ['soloops-tax-summary.csv', rows]
    }},
  ]

  // The Tax summary and the Accountant export pack are sold as Gold features.
  // On silver (Reports' own tier) they must not be reachable — hide the tax
  // report card and keep it out of the zipped pack.
  const visibleReports = canGold ? reports : reports.filter(r => r.id !== 'tax')

  return (
    <div style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px', gap:'12px', flexWrap:'wrap' }}>
        <div style={{fontWeight:700}}>Reports</div>
        {canGold && <button style={btnPri} onClick={async () => {
          try {
            const zip = new JSZip()
            visibleReports.forEach(r => { const [fn, rows] = r.build(); zip.file(fn, rows.map(row => row.map(c => {
              const s = String(c ?? ''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s
            }).join(',')).join('\n')) })
            const blob = await zip.generateAsync({ type:'blob' })
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
            a.download = 'soloops-accountant-pack-' + new Date().toISOString().slice(0,10) + '.zip'; a.click()
            setMsg('Accountant pack downloaded (all reports zipped)'); setTimeout(()=>setMsg(''), 3000)
          } catch (e) { setMsg('Could not build pack: ' + (e.message||'')); setTimeout(()=>setMsg(''), 4000) }
        }}>⬇ Accountant export pack</button>}
      </div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Generate and download reports from your data (CSV — opens in Excel/Sheets).{canGold && ' The accountant pack zips them all together.'}</div>
      {msg && <div style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,.25)', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'var(--green)', marginBottom:'14px' }}>✓ {msg}</div>}
      <div className="solo-report-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
        {visibleReports.map(r => (
          <div key={r.id} className="solo-report-card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px', padding:'16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'12px' }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:'14px' }}>{r.name}</div>
              <div style={{ fontSize:'12px', color:'var(--text3)' }}>{r.desc}</div>
            </div>
            <div className="solo-report-actions" style={{ display:'flex', gap:'8px', flexShrink:0 }}>
              <button style={{...btnSec, whiteSpace:'nowrap'}} onClick={()=>{ const [fn,rows]=r.build(); setPreview({ name:r.name, filename:fn, rows }) }}>Preview</button>
              <button style={{...btnPri, whiteSpace:'nowrap'}} onClick={()=>{ const [fn,rows]=r.build(); download(fn,rows) }}>Download</button>
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <Modal title={preview.name} width="720px" onClose={()=>setPreview(null)}>
          <div style={{ fontSize:'12.5px', color:'var(--text3)', marginBottom:'14px' }}>
            Preview of <span className="mono">{preview.filename}</span> — {preview.rows.length} row{preview.rows.length===1?'':'s'}.
          </div>
          <div style={{ overflowX:'auto', border:'1px solid var(--border)', borderRadius:'10px', marginBottom:'18px' }}>
            {preview.rows.length === 0
              ? <div style={{ padding:'24px', textAlign:'center', color:'var(--text3)', fontSize:'13px' }}>No data yet for this report.</div>
              : <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                  <tbody>
                    {preview.rows.map((row, ri) => {
                      const isHeader = ri === 0 || (row.length === 1 && row[0] && String(row[0]).length > 0 && preview.rows[ri+1] && preview.rows[ri+1].length > 1)
                      const isBlank = row.length === 0 || (row.length === 1 && !row[0])
                      if (isBlank) return <tr key={ri}><td colSpan={99} style={{ height:'8px' }} /></tr>
                      return (
                        <tr key={ri} style={{ borderBottom:'1px solid var(--border)', background: ri===0 ? 'var(--surface3)' : 'transparent' }}>
                          {row.map((cell, ci) => {
                            const looksNumeric = ci>0 && /^-?[\d,]+\.?\d*$/.test(String(cell).trim())
                            return (
                              <td key={ci} style={{
                                padding:'9px 12px',
                                fontWeight: ri===0 ? 700 : (isHeader && row.length===1 ? 700 : 500),
                                color: ri===0 ? 'var(--text)' : 'var(--text2)',
                                fontFamily: looksNumeric ? 'Fira Code, monospace' : 'inherit',
                                textAlign: looksNumeric ? 'right' : 'left',
                                whiteSpace:'nowrap'
                              }}>{cell}</td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>}
          </div>
          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', flexWrap:'wrap' }}>
            <button style={btnSec} onClick={()=>setPreview(null)}>Close</button>
            <button style={btnPri} onClick={()=>{ download(preview.filename, preview.rows); setPreview(null) }}>⬇ Download CSV</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
