import React from 'react'
import Papa from 'papaparse'
import { card, inp, btnPri, btnSec, gbp, ErrBox, CATEGORIES, parseDate } from '../components/UI.jsx'
import { loadRules, insertExpenses, upsertRules } from '../lib/db.js'

export default function BankImport({ uid, existingExpenses, onImported }) {
  const [stage, setStage] = React.useState('upload')
  const [rows, setRows] = React.useState([])
  const [headers, setHeaders] = React.useState([])
  const [map, setMap] = React.useState({ date:'', desc:'', amount:'', debit:'', credit:'' })
  const [items, setItems] = React.useState([])
  const [rules, setRules] = React.useState([])
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  React.useEffect(() => {
    loadRules().then(({ data }) => setRules(data || []))
  }, [])

  const guess = (cands, hs) => hs.find(h => cands.some(c => h.toLowerCase().includes(c))) || ''

  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setErr('')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        if (!res.data.length) { setErr('That file looks empty.'); return }
        const hs = res.meta.fields || Object.keys(res.data[0])
        setHeaders(hs); setRows(res.data)

        setMap({
          date:   guess(['date'], hs),
          desc:   guess(['description','desc','reference','memo','details','narrative','payee'], hs),
          amount: guess(['amount','value'], hs),
          debit:  guess(['debit','paid out','money out','withdraw','out'], hs),
          credit: guess(['credit','paid in','money in','deposit','in'], hs),
        })
        setStage('map')
      },
      error: () => setErr('Could not read that CSV file.')
    })
  }

  const categorise = (desc) => {
    const up = (desc||'').toUpperCase()
    const hit = rules.find(r => up.includes((r.pattern||'').toUpperCase()))
    return hit ? hit.category : 'Other'
  }

  const buildReview = () => {
    if (!map.date || !map.desc || (!map.amount && !map.debit)) {
      setErr('Please choose at least Date, Description, and an Amount (or Debit) column.'); return
    }
    setErr('')
    const existKeys = new Set((existingExpenses||[]).map(e => `${e.spent_on}|${Number(e.amount).toFixed(2)}`))
    const out = []
    rows.forEach((r, i) => {
      const desc = (r[map.desc]||'').trim()
      let amt = 0
      if (map.debit && r[map.debit]) amt = Math.abs(parseFloat(String(r[map.debit]).replace(/[^0-9.\-]/g,''))) || 0
      else if (map.amount && r[map.amount]) {
        const v = parseFloat(String(r[map.amount]).replace(/[^0-9.\-]/g,'')) || 0
        amt = v < 0 ? Math.abs(v) : 0
      }
      if (amt <= 0 || !desc) return

      const rawDate = (r[map.date]||'').trim()
      const iso = parseDate(rawDate)   // null if unparseable — never fall through to Postgres
      const dupKey = iso ? `${iso}|${amt.toFixed(2)}` : ''
      out.push({
        i, include: !!iso, badDate: !iso, rawDate,
        merchant: desc, category: categorise(desc),
        amount: amt, spent_on: iso || '',
        duplicate: iso ? existKeys.has(dupKey) : false
      })
    })
    if (!out.length) { setErr('No expense (money-out) rows found with these columns. Check your mapping.'); return }
    setItems(out); setStage('review')
  }

  const setItem = (idx, patch) => setItems(items.map((it,k) => k===idx ? {...it, ...patch} : it))

  const doImport = async () => {
    const chosen = items.filter(it => it.include && !it.badDate && it.spent_on)
    if (!chosen.length) { setErr('Tick at least one row with a readable date to import.'); return }
    setBusy(true); setErr('')
    try {
      const payload = chosen.map(it => ({
        user_id: uid, merchant: it.merchant, category: it.category,
        amount: it.amount, spent_on: it.spent_on || null, source: 'import'
      }))
      const { error } = await insertExpenses(payload)
      if (error) throw error

      const ruleRows = chosen
        .filter(it => it.category && it.category !== 'Other')
        .map(it => ({ user_id: uid, pattern: (it.merchant.split(' ')[0]||'').toUpperCase(), category: it.category }))
      if (ruleRows.length) {
        await upsertRules(ruleRows).then(()=>{}).catch(()=>{})
      }
      setStage('done')
      onImported && onImported()
    } catch (e) { setErr(e.message || 'Import failed') }
    setBusy(false)
  }

  const reset = () => { setStage('upload'); setRows([]); setItems([]); setErr('') }

  const sel = { ...inp, padding:'8px 10px' }

  return (
    <div style={card}>
      <div style={{fontWeight:700, marginBottom:'4px'}}>Bank statement import</div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Upload a CSV from your bank. We auto-detect the columns and pre-categorise using your rules — you confirm before anything is saved.</div>
      {err && <ErrBox m={err} />}

      {stage==='upload' && (
        <label style={{ display:'block', border:'2px dashed var(--border-light)', borderRadius:'14px', padding:'40px', textAlign:'center', cursor:'pointer' }}>
          <div style={{ fontSize:'15px', fontWeight:700, marginBottom:'6px' }}>Choose a CSV file</div>
          <div style={{ fontSize:'13px', color:'var(--text3)' }}>Works with most UK bank exports</div>
          <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display:'none' }} />
        </label>
      )}

      {stage==='map' && (
        <div>
          <div style={{ fontSize:'13.5px', color:'var(--text2)', marginBottom:'14px' }}>We detected these columns — fix any that look wrong, then continue. ({rows.length} rows found)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px', marginBottom:'18px' }}>
            {[['date','Date'],['desc','Description'],['amount','Amount (signed)'],['debit','Debit / money out'],['credit','Credit / money in']].map(([k,label]) => (
              <div key={k}>
                <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>{label}</div>
                <select style={sel} value={map[k]} onChange={e=>setMap({...map,[k]:e.target.value})}>
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'10px' }}>
            <button style={btnSec} onClick={reset}>Cancel</button>
            <button style={btnPri} onClick={buildReview}>Continue</button>
          </div>
        </div>
      )}

      {stage==='review' && (
        <div>
          <div style={{ fontSize:'13.5px', color:'var(--text2)', marginBottom:'14px' }}>
            {items.length} expense rows found. Untick anything you don't want, adjust categories, then import.
            {items.some(it=>it.duplicate) && <span style={{color:'var(--amber)'}}> Possible duplicates are flagged.</span>}
            {items.some(it=>it.badDate) && <span style={{color:'var(--red)'}}> {items.filter(it=>it.badDate).length} row(s) have an unreadable date and can't be imported — fix the date in your CSV and re-import.</span>}
          </div>
          <div style={{ maxHeight:'380px', overflowY:'auto', border:'1px solid var(--border)', borderRadius:'10px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>
                {['','Date','Merchant','Category','Amount'].map((h,i)=>(
                  <th key={i} style={{ textAlign:i===4?'right':'left', fontSize:'11px', textTransform:'uppercase', letterSpacing:'0.5px', color:'var(--text3)', fontWeight:700, padding:'10px 14px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--surface)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((it,idx) => (
                  <tr key={idx} style={{ opacity: it.include?1:0.45 }}>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)'}}>
                      <input type="checkbox" checked={it.include} disabled={it.badDate}
                        title={it.badDate ? "This row's date couldn't be read — fix it in your CSV" : undefined}
                        onChange={e=>setItem(idx,{include:e.target.checked})} />
                    </td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:'13px', color: it.badDate?'var(--red)':'var(--text3)', fontFamily:'Fira Code, monospace'}}>
                      {it.badDate ? (it.rawDate || '—') : it.spent_on}
                      {it.badDate && <span style={{ marginLeft:'8px', fontSize:'10.5px', color:'var(--red)', border:'1px solid rgba(239,68,68,.4)', borderRadius:'20px', padding:'1px 7px' }}>bad date</span>}
                    </td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:'13px'}}>
                      {it.merchant}{it.duplicate && <span style={{ marginLeft:'8px', fontSize:'10.5px', color:'var(--amber)', border:'1px solid rgba(245,158,11,.4)', borderRadius:'20px', padding:'1px 7px' }}>dup?</span>}
                    </td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)'}}>
                      <select style={{...sel, padding:'6px 8px'}} value={it.category} onChange={e=>setItem(idx,{category:e.target.value})}>
                        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:'13px', textAlign:'right', fontFamily:'Fira Code, monospace'}}>{gbp(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex', gap:'10px', marginTop:'16px', alignItems:'center' }}>
            <button style={btnSec} onClick={reset}>Start over</button>
            <button style={{...btnPri, opacity:busy?.7:1}} disabled={busy} onClick={doImport}>
              {busy ? 'Importing…' : `Import ${items.filter(i=>i.include).length} selected`}
            </button>
          </div>
        </div>
      )}

      {stage==='done' && (
        <div style={{ textAlign:'center', padding:'30px 20px' }}>
          <div style={{ fontSize:'18px', fontWeight:800, marginBottom:'8px' }}>✓ Imported</div>
          <div style={{ color:'var(--text2)', fontSize:'14px', marginBottom:'18px' }}>Your transactions were added as expenses and your category rules were updated.</div>
          <button style={btnSec} onClick={reset}>Import another file</button>
        </div>
      )}
    </div>
  )
}
