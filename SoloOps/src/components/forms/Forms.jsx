import React, { useState } from 'react'
import { inp, btnPri, Modal, ErrBox, DateField, CATEGORIES } from '../UI.jsx'
import { insertExpense, insertInvoice, insertMileage, loadRules, upsertRule } from '../../lib/db.js'

export function ExpenseForm({onClose,onSaved,uid,expenses}) {
  const [merchant,setMerchant]=useState(''); const [category,setCategory]=useState('Other')
  const [amount,setAmount]=useState(''); const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const pastMerchants = [...new Set((expenses||[]).map(e=>e.merchant).filter(Boolean))].sort()

  const suggest = async (m) => {
    setMerchant(m)
    if (m.length < 3) return
    const { data } = await loadRules()
    const hit = (data||[]).find(r => m.toUpperCase().includes(r.pattern.toUpperCase()))
    if (hit) setCategory(hit.category)
  }
  const save = async () => {
    if(!merchant||!amount) return setErr('Merchant and amount are required')
    setBusy(true); setErr('')
    const { error } = await insertExpense({
      user_id:uid, merchant:merchant.trim(), category, amount:Number(amount), spent_on:date, source:'manual'
    })
    if(error){ setErr(error.message); setBusy(false); return }

    await upsertRule({ user_id:uid, pattern:merchant.trim().split(' ')[0].toUpperCase(), category })
      .then(()=>{}).catch(()=>{})
    onSaved()
  }
  return <Modal title="Add expense" onClose={onClose}>
    {err && <ErrBox m={err} />}
    <input style={inp} list="past-merchants" placeholder="Supplier / merchant (e.g. Adobe UK)" value={merchant} onChange={e=>suggest(e.target.value)} />
    <datalist id="past-merchants">{pastMerchants.map(m=><option key={m} value={m} />)}</datalist>
    <select style={{...inp, marginTop:'12px'}} value={category} onChange={e=>setCategory(e.target.value)}>
      {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
    </select>
    <input style={{...inp, marginTop:'12px'}} type="number" placeholder="Amount (£)" value={amount} onChange={e=>setAmount(e.target.value)} />
    <DateField style={{marginTop:'12px'}} value={date} onChange={setDate} />
    <button style={{...btnPri, width:'100%', marginTop:'16px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':'Save expense'}</button>
  </Modal>
}

// --- invoice-number helpers (INV-### format, 3-digit zero-padded, rolls past 999) ---
const INV_RE = /^INV-(\d+)$/i
function existingNumbers(invoices){
  return new Set((invoices||[]).map(i=>(i.number||'').trim().toUpperCase()).filter(Boolean))
}
function nextInvoiceNumber(invoices){
  let max = 0
  ;(invoices||[]).forEach(i=>{
    const m = INV_RE.exec((i.number||'').trim())
    if(m){ const n = parseInt(m[1],10); if(n>max) max=n }
  })
  return 'INV-' + String(max+1).padStart(3,'0')
}
function nextFreeNumber(invoices){
  const taken = existingNumbers(invoices)
  let n = 1
  let candidate = 'INV-' + String(n).padStart(3,'0')
  while(taken.has(candidate.toUpperCase())){ n++; candidate = 'INV-' + String(n).padStart(3,'0') }
  return candidate
}

export function InvoiceForm({onClose,onSaved,uid,invoices,clients}) {
  const [client,setClient]=useState(''); const [number,setNumber]=useState(()=>nextInvoiceNumber(invoices))
  const [total,setTotal]=useState(''); const [status,setStatus]=useState('sent')
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const [picked,setPicked]=useState(null)
  const pastClients = [...new Set((invoices||[]).map(i=>i.client_name).filter(Boolean))].sort()
  const savedClients = clients||[]
  const onPick = (id) => {
    const c = savedClients.find(x=>x.id===id)
    setPicked(c||null)
    if (c) setClient(c.name)
  }
  const save = async () => {
    if(!client||!total) return setErr('Client and total are required')
    const num = number.trim()
    // friendly duplicate check (UI layer) — suggest next free number
    if(num && existingNumbers(invoices).has(num.toUpperCase())){
      const free = nextFreeNumber(invoices)
      setErr(`Invoice number "${num}" already exists. Next free number is ${free}.`)
      setNumber(free)
      return
    }
    setBusy(true); setErr('')
    const { error } = await insertInvoice({
      user_id:uid, client_name:client.trim(), number:num||null, total:Number(total), status, issue_date:date
    })
    if(error){
      // DB unique-violation (bulletproof layer) — race-safe fallback
      if(error.code==='23505' || /duplicate key|unique/i.test(error.message||'')){
        const free = nextFreeNumber(invoices)
        setErr(`That invoice number was just taken. Next free number is ${free}.`)
        setNumber(free)
        setBusy(false); return
      }
      setErr(error.message); setBusy(false); return
    }
    onSaved()
  }
  return <Modal title="Add income" onClose={onClose}>
    {err && <ErrBox m={err} />}
    {savedClients.length>0 && (
      <select style={{...inp, marginBottom:'12px'}} value={picked?.id||''} onChange={e=>onPick(e.target.value)}>
        <option value="">— Pick a saved client (optional) —</option>
        {savedClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    )}
    {picked && (
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'10px 12px', marginBottom:'12px', fontSize:'12.5px', color:'var(--text2)', lineHeight:1.6 }}>
        {picked.email && <div>✉ {picked.email}</div>}
        {picked.phone && <div>☎ {picked.phone}</div>}
        {picked.address && <div>📍 {picked.address}</div>}
        {picked.notes && <div style={{color:'var(--text3)'}}>{picked.notes}</div>}
      </div>
    )}
    <input style={inp} list="past-clients" placeholder="Customer / client name" value={client} onChange={e=>{setClient(e.target.value); setPicked(null)}} />
    <datalist id="past-clients">{pastClients.map(c=><option key={c} value={c} />)}</datalist>
    <input style={{...inp, marginTop:'12px'}} placeholder="Invoice number (auto, editable)" value={number} onChange={e=>{setNumber(e.target.value); setErr('')}} />
    <input style={{...inp, marginTop:'12px'}} type="number" placeholder="Total (£)" value={total} onChange={e=>setTotal(e.target.value)} />
    <select style={{...inp, marginTop:'12px'}} value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
    </select>
    <DateField style={{marginTop:'12px'}} value={date} onChange={setDate} />
    <button style={{...btnPri, width:'100%', marginTop:'16px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':'Save income'}</button>
  </Modal>
}

// NOTE: MileageForm was referenced in the old Dashboard.jsx (modal==='mileage')
// but never defined there — clicking "+ Log journey" would have thrown
// "MileageForm is not defined". Reconstructed here to match the soloops_mileage
// shape (journey_date, start_loc, end_loc, purpose, miles, claim).
// HMRC AMAP: 45p/mile up to 10,000 miles, 25p after. Confirm this matches any
// earlier version you had.
export function MileageForm({onClose,onSaved,uid,mileage}) {
  const [date,setDate]=useState(new Date().toISOString().slice(0,10))
  const [from,setFrom]=useState(''); const [to,setTo]=useState('')
  const [purpose,setPurpose]=useState(''); const [miles,setMiles]=useState('')
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')

  const priorMiles = (mileage||[]).reduce((s,m)=>s+(Number(m.miles)||0),0)

  const save = async () => {
    if(!from||!to||!miles) return setErr('From, to and miles are required')
    const m = Number(miles)
    if(!(m>0)) return setErr('Miles must be a positive number')
    setBusy(true); setErr('')
    // per-journey claim using cumulative-miles split across the 10k threshold
    const remainingAt45 = Math.max(0, 10000 - priorMiles)
    const at45 = Math.min(m, remainingAt45)
    const at25 = m - at45
    const claim = at45 * 0.45 + at25 * 0.25
    const { error } = await insertMileage({
      user_id:uid, journey_date:date, start_loc:from.trim(), end_loc:to.trim(),
      purpose:purpose.trim(), miles:m, claim:Number(claim.toFixed(2))
    })
    if(error){ setErr(error.message); setBusy(false); return }
    onSaved()
  }
  return <Modal title="Log journey" onClose={onClose}>
    {err && <ErrBox m={err} />}
    <DateField value={date} onChange={setDate} />
    <input style={{...inp, marginTop:'12px'}} placeholder="From" value={from} onChange={e=>setFrom(e.target.value)} />
    <input style={{...inp, marginTop:'12px'}} placeholder="To" value={to} onChange={e=>setTo(e.target.value)} />
    <input style={{...inp, marginTop:'12px'}} placeholder="Purpose (e.g. client visit)" value={purpose} onChange={e=>setPurpose(e.target.value)} />
    <input style={{...inp, marginTop:'12px'}} type="number" placeholder="Miles" value={miles} onChange={e=>setMiles(e.target.value)} />
    <button style={{...btnPri, width:'100%', marginTop:'16px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':'Save journey'}</button>
  </Modal>
}
