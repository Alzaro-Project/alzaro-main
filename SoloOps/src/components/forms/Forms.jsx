import React, { useState, useEffect } from 'react'
import { inp, btnPri, Modal, ErrBox, DateField, CATEGORIES, isEmailish, Field, FormSection } from '../UI.jsx'
import { insertExpense, updateExpense, insertInvoice, updateInvoice, insertInvoiceLines, deleteInvoiceLines, loadInvoiceLines, insertMileage, updateMileage, ensureClient, loadRules, upsertRule } from '../../lib/db.js'

export function ExpenseForm({onClose,onSaved,uid,expenses,edit}) {
  const [merchant,setMerchant]=useState(edit?.merchant||''); const [category,setCategory]=useState(edit?.category||'Other')
  const [amount,setAmount]=useState(edit?.amount!=null ? String(edit.amount) : ''); const [date,setDate]=useState(edit?.spent_on || new Date().toISOString().slice(0,10))
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
    if(Number(amount) < 0) return setErr('Amount cannot be negative')
    setBusy(true); setErr('')
    if (edit) {
      // Edit is a plain update — no rule learning or client creation, which are
      // onboarding side-effects meant for brand-new expenses.
      const { error } = await updateExpense(edit.id, {
        merchant:merchant.trim(), category, amount:Number(amount), spent_on:date
      })
      if(error){ setErr(error.message); setBusy(false); return }
      onSaved(); return
    }
    const { error } = await insertExpense({
      user_id:uid, merchant:merchant.trim(), category, amount:Number(amount), spent_on:date, source:'manual'
    })
    if(error){ setErr(error.message); setBusy(false); return }

    await upsertRule({ user_id:uid, pattern:merchant.trim().split(' ')[0].toUpperCase(), category })
      .then(()=>{}).catch(()=>{})
    let added=null
    try { const r = await ensureClient(uid, merchant.trim(), 'supplier'); if(r.created) added=r.client?.name } catch(e){}
    onSaved(added ? { addedClient: added } : undefined)
  }
  return <Modal title={edit?"Edit expense":"Add expense"} onClose={onClose}>
    {err && <ErrBox m={err} />}
    <Field label="Supplier / merchant">
      <input style={inp} list="past-merchants" placeholder="e.g. Adobe UK" value={merchant} onChange={e=>suggest(e.target.value)} />
      <datalist id="past-merchants">{pastMerchants.map(m=><option key={m} value={m} />)}</datalist>
    </Field>
    <Field label="Category">
      <select style={inp} value={category} onChange={e=>setCategory(e.target.value)}>
        {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
    </Field>
    <Field label="Amount">
      <input style={inp} type="number" placeholder="£0.00" value={amount} onChange={e=>setAmount(e.target.value)} />
    </Field>
    <Field label="Date" style={{ marginBottom:'4px' }}>
      <DateField value={date} onChange={setDate} />
    </Field>
    <button style={{...btnPri, width:'100%', marginTop:'18px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':(edit?'Update expense':'Save expense')}</button>
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

export function InvoiceForm({onClose,onSaved,uid,invoices,clients,edit,settings}) {
  const [number,setNumber]=useState(()=> edit ? (edit.number||'') : nextInvoiceNumber(invoices))
  const [status,setStatus]=useState(edit?.status||'sent')
  const [date,setDate]=useState(edit?.issue_date || new Date().toISOString().slice(0,10))
  const [dueDate,setDueDate]=useState(edit?.due_date || '')
  const [notes,setNotes]=useState(edit?.notes || '')
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')

  // VAT (only relevant if the business is VAT-registered)
  const vatRegistered = !!settings?.vat_registered
  const flatRate = Number(settings?.flat_rate)||0
  const isFlat = settings?.vat_scheme==='flat_rate'
  const [vatRate,setVatRate]=useState(()=> edit?.vat_rate!=null ? Number(edit.vat_rate) : (vatRegistered ? 20 : 0))

  // Line items
  const blankLine = ()=>({ description:'', qty:'1', unit_price:'' })
  const [lines,setLines]=useState([blankLine()])
  const [client,setClient]=useState(edit?.client_name||'')

  // client picker
  const savedClients = clients||[]
  const initialPick = edit?.client_name
    ? (savedClients.find(c=>(c.name||'').toLowerCase()===(edit.client_name||'').toLowerCase())?.id || '__new__')
    : ''
  const [pickId,setPickId]=useState(initialPick)
  const [picked,setPicked]=useState(savedClients.find(c=>c.id===initialPick)||null)
  const [newEmail,setNewEmail]=useState('')
  const [newPhone,setNewPhone]=useState('')
  const isNew = pickId==='__new__'
  const onPick = (val) => {
    setPickId(val)
    if (val==='__new__') { setPicked(null); setClient(edit?.client_name||''); }
    else if (val==='') { setPicked(null); setClient('') }
    else { const c = savedClients.find(x=>x.id===val); setPicked(c||null); setClient(c?.name||'') }
  }

  // When editing, load existing line items
  useEffect(()=>{
    let alive=true
    if (edit?.id) {
      loadInvoiceLines(edit.id).then(rows=>{
        if(!alive) return
        if (rows && rows.length) setLines(rows.map(r=>({ description:r.description||'', qty:String(r.qty??'1'), unit_price:String(r.unit_price??'') })))
      })
    }
    return ()=>{ alive=false }
  }, [edit?.id])

  const setLine = (i, key, val) => setLines(ls => ls.map((l,idx)=> idx===i ? {...l, [key]:val} : l))
  const addLine = () => setLines(ls => [...ls, blankLine()])
  const removeLine = (i) => setLines(ls => ls.length>1 ? ls.filter((_,idx)=>idx!==i) : ls)

  const subtotal = lines.reduce((s,l)=> s + (Number(l.qty)||0)*(Number(l.unit_price)||0), 0)
  const vat = vatRegistered ? (isFlat ? subtotal*flatRate/100 : subtotal*(Number(vatRate)||0)/100) : 0
  const total = subtotal + vat
  const fmt = n => '£' + (Number(n)||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})

  const save = async () => {
    if(!client) return setErr('Please select or add a client')
    if(isNew && newEmail.trim() && !isEmailish(newEmail)) return setErr('Please enter a valid email address for the new client')
    const validLines = lines.filter(l=> l.description.trim() || Number(l.unit_price))
    if(!validLines.length) return setErr('Add at least one line item')
    if(validLines.some(l=> Number(l.qty) < 0 || Number(l.unit_price) < 0)) return setErr('Line item quantity and price cannot be negative')
    if(vatRegistered && !isFlat && Number(vatRate) < 0) return setErr('VAT rate cannot be negative')
    if(dueDate && date && dueDate < date) return setErr('Due date cannot be before the issue date')
    const num = number.trim()
    const others = (invoices||[]).filter(i=> !edit || i.id!==edit.id)
    if(num && existingNumbers(others).has(num.toUpperCase())){
      const free = nextFreeNumber(others)
      setErr(`Invoice number "${num}" already exists. Next free number is ${free}.`)
      setNumber(free); return
    }
    setBusy(true); setErr('')
    const payload = {
      client_name:client.trim(), number:num||null, total:Number(total.toFixed(2)),
      status, issue_date:date, due_date:dueDate||null,
      vat_rate: vatRegistered ? (isFlat ? flatRate : Number(vatRate)||0) : 0,
      notes: notes.trim()||null,
    }

    let invId = edit?.id
    if (edit) {
      const { error } = await updateInvoice(edit.id, payload)
      if(error){ setErr(error.message); setBusy(false); return }
    } else {
      const { data, error } = await insertInvoice({ user_id:uid, ...payload })
      if(error){
        if(error.code==='23505' || /duplicate key|unique/i.test(error.message||'')){
          const free = nextFreeNumber(others)
          setErr(`That invoice number was just taken. Next free number is ${free}.`)
          setNumber(free); setBusy(false); return
        }
        setErr(error.message); setBusy(false); return
      }
      invId = data?.id
    }

    // replace-all line items
    if (invId) {
      try {
        if (edit) await deleteInvoiceLines(invId)
        const rows = validLines.map((l,idx)=>({
          invoice_id:invId, user_id:uid, description:l.description.trim(),
          qty:Number(l.qty)||0, unit_price:Number(l.unit_price)||0, position:idx
        }))
        await insertInvoiceLines(rows)
      } catch(e){ /* lines best-effort; invoice already saved */ }
    }

    let added=null
    try {
      const details = isNew ? { email:newEmail, phone:newPhone } : undefined
      const r = await ensureClient(uid, client.trim(), 'customer', details)
      if(r.created) added=r.client?.name
    } catch(e){}
    onSaved(added ? { addedClient: added } : undefined)
  }

  return <Modal title={edit?"Edit income":"Add income"} onClose={onClose}>
    {err && <ErrBox m={err} />}

    <FormSection>Client</FormSection>
    <Field label="Who is this for?">
      <select style={inp} value={pickId} onChange={e=>onPick(e.target.value)}>
        <option value="">— Select a client —</option>
        {savedClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        <option value="__new__">+ Add new client</option>
      </select>
    </Field>
    {picked && (
      <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', padding:'10px 12px', marginTop:'-4px', marginBottom:'14px', fontSize:'12.5px', color:'var(--text2)', lineHeight:1.6 }}>
        {picked.email && <div>✉ {picked.email}</div>}
        {picked.phone && <div>☎ {picked.phone}</div>}
        {picked.address && <div>📍 {picked.address}</div>}
      </div>
    )}
    {isNew && (
      <div style={{ marginBottom:'14px', padding:'14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px' }}>
        <div style={{ fontSize:'11.5px', color:'var(--text3)', marginBottom:'10px' }}>New client — saved to Clients on save</div>
        <Field label="Client name">
          <input style={inp} placeholder="Customer / client name" value={client} onChange={e=>{setClient(e.target.value); setErr('')}} />
        </Field>
        <Field label="Email" hint="optional">
          <input style={inp} placeholder="name@example.com" value={newEmail} onChange={e=>setNewEmail(e.target.value)} />
        </Field>
        <Field label="Phone" hint="optional" style={{ marginBottom:0 }}>
          <input style={inp} placeholder="07…" value={newPhone} onChange={e=>setNewPhone(e.target.value)} />
        </Field>
      </div>
    )}

    <Field label="Invoice number" hint="auto, editable">
      <input style={inp} placeholder="INV-001" value={number} onChange={e=>{setNumber(e.target.value); setErr('')}} />
    </Field>

    <FormSection>Line items</FormSection>
    {lines.map((l,i)=>(
      <div key={i} style={{ display:'flex', gap:'6px', marginBottom:'6px', alignItems:'flex-start' }}>
        <input style={{...inp, flex:1}} placeholder="Description" value={l.description} onChange={e=>setLine(i,'description',e.target.value)} />
        <input style={{...inp, width:'52px', textAlign:'center'}} type="number" placeholder="Qty" value={l.qty} onChange={e=>setLine(i,'qty',e.target.value)} />
        <input style={{...inp, width:'82px'}} type="number" placeholder="£ each" value={l.unit_price} onChange={e=>setLine(i,'unit_price',e.target.value)} />
        <button onClick={()=>removeLine(i)} title="Remove" style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text3)', width:'40px', minWidth:'40px', cursor:'pointer', fontSize:'16px', lineHeight:'38px' }}>×</button>
      </div>
    ))}
    <button onClick={addLine} style={{ background:'transparent', border:'1px dashed var(--border-light)', borderRadius:'8px', color:'var(--text2)', padding:'9px', width:'100%', cursor:'pointer', fontSize:'13px', marginTop:'2px' }}>+ Add line</button>

    {/* VAT (only if registered) */}
    {vatRegistered && !isFlat && (
      <Field label="VAT rate %" style={{ marginTop:'14px' }}>
        <input style={inp} type="number" value={vatRate} onChange={e=>setVatRate(e.target.value)} placeholder="20" />
      </Field>
    )}
    {vatRegistered && isFlat && (
      <div style={{ marginTop:'12px', fontSize:'12px', color:'var(--text3)' }}>Flat Rate VAT @ {flatRate}% applied.</div>
    )}

    {/* Totals summary */}
    <div style={{ marginTop:'16px', padding:'14px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px', fontSize:'13px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text2)' }}><span>Subtotal</span><span className="mono">{fmt(subtotal)}</span></div>
      {vatRegistered && <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text2)', marginTop:'6px' }}><span>VAT {isFlat?`(Flat ${flatRate}%)`:`(${Number(vatRate)||0}%)`}</span><span className="mono">{fmt(vat)}</span></div>}
      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, marginTop:'8px', paddingTop:'8px', borderTop:'1px solid var(--border)', fontSize:'15px' }}><span>Total</span><span className="mono" style={{ color:'var(--orange-light)' }}>{fmt(total)}</span></div>
    </div>

    <FormSection>Dates &amp; status</FormSection>
    <div className="solo-2col" style={{ display:'flex', gap:'12px' }}>
      <Field label="Issue date" style={{ flex:1 }}>
        <DateField value={date} onChange={setDate} />
      </Field>
      <Field label="Due date" style={{ flex:1 }}>
        <DateField value={dueDate} onChange={setDueDate} />
      </Field>
    </div>

    <Field label="Status">
      <select style={inp} value={status} onChange={e=>setStatus(e.target.value)}>
        <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
      </select>
    </Field>
    <Field label="Notes" hint="optional, shown on invoice" style={{ marginBottom:0 }}>
      <textarea style={{...inp, minHeight:'56px', resize:'vertical', fontFamily:'inherit'}} placeholder="Payment terms, thank-you note…" value={notes} onChange={e=>setNotes(e.target.value)} />
    </Field>

    <button style={{...btnPri, width:'100%', marginTop:'18px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':(edit?'Update income':'Save income')}</button>
  </Modal>
}

// NOTE: MileageForm was referenced in the old Dashboard.jsx (modal==='mileage')
// but never defined there — clicking "+ Log journey" would have thrown
// "MileageForm is not defined". Reconstructed here to match the soloops_mileage
// shape (journey_date, start_loc, end_loc, purpose, miles, claim).
// HMRC AMAP: 45p/mile up to 10,000 miles, 25p after. Confirm this matches any
// earlier version you had.
export function MileageForm({onClose,onSaved,uid,mileage,edit}) {
  const [date,setDate]=useState(edit?.journey_date || new Date().toISOString().slice(0,10))
  const [from,setFrom]=useState(edit?.start_loc||''); const [to,setTo]=useState(edit?.end_loc||'')
  const [purpose,setPurpose]=useState(edit?.purpose||''); const [miles,setMiles]=useState(edit?.miles!=null ? String(edit.miles) : '')
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')

  // Cumulative miles across the 10k AMAP threshold. When editing, exclude the
  // row being edited so its own miles aren't double-counted in the split.
  const priorMiles = (mileage||[])
    .filter(m => !edit || m.id !== edit.id)
    .reduce((s,m)=>s+(Number(m.miles)||0),0)

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
    const row = {
      journey_date:date, start_loc:from.trim(), end_loc:to.trim(),
      purpose:purpose.trim(), miles:m, claim:Number(claim.toFixed(2))
    }
    const { error } = edit
      ? await updateMileage(edit.id, row)
      : await insertMileage({ user_id:uid, ...row })
    if(error){ setErr(error.message); setBusy(false); return }
    onSaved()
  }
  return <Modal title={edit?"Edit journey":"Log journey"} onClose={onClose}>
    {err && <ErrBox m={err} />}
    <Field label="Date">
      <DateField value={date} onChange={setDate} />
    </Field>
    <div className="solo-2col" style={{ display:'flex', gap:'12px' }}>
      <Field label="From" style={{ flex:1 }}>
        <input style={inp} placeholder="e.g. Office" value={from} onChange={e=>setFrom(e.target.value)} />
      </Field>
      <Field label="To" style={{ flex:1 }}>
        <input style={inp} placeholder="e.g. Client site" value={to} onChange={e=>setTo(e.target.value)} />
      </Field>
    </div>
    <Field label="Purpose">
      <input style={inp} placeholder="e.g. client visit" value={purpose} onChange={e=>setPurpose(e.target.value)} />
    </Field>
    <Field label="Miles" style={{ marginBottom:'4px' }}>
      <input style={inp} type="number" placeholder="0" value={miles} onChange={e=>setMiles(e.target.value)} />
    </Field>
    <button style={{...btnPri, width:'100%', marginTop:'18px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':(edit?'Update journey':'Save journey')}</button>
  </Modal>
}
