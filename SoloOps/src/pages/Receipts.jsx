import React from 'react'
import { card, inp, btnPri, gbp, KPI, Th, Td, Empty, ErrBox, DateField } from '../components/UI.jsx'
import { uploadFile, insertDocument, updateExpenseReceipt } from '../lib/db.js'

export default function Receipts({ uid, expenses, onMatched }) {
  const [fileObj, setFileObj] = React.useState(null)
  const [fileName, setFileName] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [date, setDate] = React.useState('')
  const [suggestions, setSuggestions] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const withReceipt = expenses.filter(e => e.has_receipt)
  const withoutReceipt = expenses.filter(e => !e.has_receipt)

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (f) { setFileObj(f); setFileName(f.name); setErr(''); setSuggestions(null) }
  }

  const daysBetween = (a, b) => {
    const d1 = new Date(a), d2 = new Date(b)
    if (isNaN(d1) || isNaN(d2)) return 999
    return Math.abs((d1 - d2) / 86400000)
  }

  const findMatches = () => {
    if (!amount) { setErr('Enter the receipt amount so we can find matching expenses.'); return }
    setErr('')
    const amt = parseFloat(amount)
    const scored = withoutReceipt
      .map(e => {
        const amtDiff = Math.abs(Number(e.amount) - amt)
        const dayDiff = date ? daysBetween(e.spent_on, date) : 0
        return { e, amtDiff, dayDiff }
      })
      .filter(s => s.amtDiff < 0.01 || (s.amtDiff <= 1 && s.dayDiff <= 3))
      .sort((a,b) => (a.amtDiff - b.amtDiff) || (a.dayDiff - b.dayDiff))
      .slice(0, 5)
    setSuggestions(scored)
  }

  const attach = async (expenseId) => {
    setBusy(true); setErr('')
    try {
      let storagePath = null

      if (fileObj) {
        const safe = fileObj.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        storagePath = `${uid}/${crypto.randomUUID()}-${safe}`
        const { error: upErr } = await uploadFile(storagePath, fileObj)
        if (upErr) throw upErr

        await insertDocument({
          user_id: uid, type: 'Receipt', name: fileObj.name,
          storage_path: storagePath, size_bytes: fileObj.size, expense_id: expenseId
        })
      }

      const { error } = await updateExpenseReceipt(expenseId, fileName || 'receipt')
      if (error) throw error
      setFileObj(null); setFileName(''); setAmount(''); setDate(''); setSuggestions(null)
      onMatched && onMatched()
    } catch (e) { setErr(e.message || 'Could not attach receipt') }
    setBusy(false)
  }

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'16px' }}>
        <KPI label="Expenses with receipt" value={withReceipt.length} color="var(--green)" />
        <KPI label="Missing a receipt" value={withoutReceipt.length} color="var(--amber)" />
        <KPI label="Total expenses" value={expenses.length} />
      </div>

      <div style={card}>
        <div style={{fontWeight:700, marginBottom:'4px'}}>Match a receipt</div>
        <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px'}}>Upload your receipt and enter its amount &amp; date — we'll find the matching expense to attach it to.</div>
        {err && <ErrBox m={err} />}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr auto', gap:'12px', alignItems:'end' }}>
          <div>
            <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Receipt file</div>
            <label style={{...inp, display:'flex', alignItems:'center', cursor:'pointer', color: fileName?'var(--text)':'var(--text3)' }}>
              {fileName || 'Choose a file…'}
              <input type="file" accept="image/*,.pdf" onChange={onFile} style={{ display:'none' }} />
            </label>
          </div>
          <div>
            <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Amount (£)</div>
            <input style={inp} type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <div style={{ fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }}>Date (optional)</div>
            <DateField value={date} onChange={setDate} />
          </div>
          <button style={btnPri} onClick={findMatches}>Find match</button>
        </div>

        {suggestions && (
          <div style={{ marginTop:'20px' }}>
            {suggestions.length === 0 ? (
              <div style={{ color:'var(--text3)', fontSize:'13.5px', padding:'14px', background:'var(--surface2)', borderRadius:'10px' }}>
                No matching expense found for that amount. Check the amount, or add the expense first (it may not be recorded yet).
              </div>
            ) : (
              <>
                <div style={{ fontSize:'13px', color:'var(--text2)', marginBottom:'10px' }}>Suggested matches — click to attach the receipt:</div>
                {suggestions.map((s,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px', marginBottom:'8px' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:'14px' }}>{s.e.merchant}</div>
                      <div style={{ fontSize:'12px', color:'var(--text3)' }}>{s.e.spent_on} · {s.e.category} {s.amtDiff < 0.01 ? '· exact amount' : '· close match'}</div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <span className="mono" style={{ fontWeight:600 }}>{gbp(s.e.amount)}</span>
                      <button style={{...btnPri, padding:'7px 14px', opacity:busy?.7:1}} disabled={busy} onClick={()=>attach(s.e.id)}>Attach</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{...card, marginTop:'16px'}}>
        <div style={{fontWeight:700, marginBottom:'4px'}}>Expenses missing a receipt</div>
        <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Good to attach these for your records / HMRC</div>
        {withoutReceipt.length === 0 ? <Empty msg="Every expense has a receipt attached. Nice." />
        : <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><Th cols={['Date','Merchant','Category','Amount']} /></thead>
          <tbody>{withoutReceipt.slice(0,15).map(e => (
            <tr key={e.id}>
              <Td muted mono>{e.spent_on}</Td><Td>{e.merchant}</Td>
              <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{e.category}</span></Td>
              <Td mono right>{gbp(e.amount)}</Td>
            </tr>))}</tbody>
        </table>}
      </div>
    </>
  )
}
