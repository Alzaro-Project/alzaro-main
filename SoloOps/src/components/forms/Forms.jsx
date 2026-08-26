import React, { useState, useEffect } from 'react'
import { inp, noScroll, btnPri, Modal, ErrBox, DateField, CATEGORIES, PAY_METHODS, isEmailish, Field, FormSection, gbp } from '../UI.jsx'
import { insertExpense, updateExpense, insertInvoice, updateInvoice, insertInvoiceLines, deleteInvoiceLines, loadInvoiceLines, insertMileage, updateMileage, ensureClient, loadRules, upsertRule, uploadFile, insertDocument, updateExpenseReceipt } from '../../lib/db.js'

// Built-ins + the owner's own categories, minus any built-in they've switched
// off, deduped, with Other kept last so the catch-all stays at the bottom where
// people expect it. Other is deliberately never removable: it's the fallback
// every form defaults to, so losing it would leave new expenses with no
// category at all.
export function mergeCategories(custom) {
  const rows = custom || []
  const hidden = new Set(rows.filter(c => c.hidden).map(c => (c.name || '').trim().toLowerCase()))
  const names = rows.filter(c => !c.hidden).map(c => (c.name || '').trim()).filter(Boolean)
  const merged = CATEGORIES.filter(c => c !== 'Other' && !hidden.has(c.toLowerCase()))
  names.forEach(n => { if (!merged.some(m => m.toLowerCase() === n.toLowerCase())) merged.push(n) })
  merged.push('Other')
  return merged
}

// Supplier / merchant picker for the expense form.
//
// A plain <select> was considered and rejected: most expenses are one-offs
// (parking, a bag of screws) and forcing a supplier record to exist first would
// make logging them slower than it is today. So this is a combobox — the saved
// suppliers from Clients drop down on focus and filter as you type, but any
// free text is still accepted and still auto-creates the supplier on save.
function MerchantPicker({ value, onChange, suppliers, pastMerchants, catalogueItems = [], onPickItem }) {
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(-1)
  const box = React.useRef(null)

  // Expense items from the Items page first — they're the quick-picks the
  // owner deliberately saved, and picking one also fills category and amount.
  // Then saved suppliers (the real records), then merchants that only appear
  // on past expenses, so typing history still helps without duplicating.
  const itemNames = new Set(catalogueItems.map(it => (it.name || '').toLowerCase()))
  const supplierNames = suppliers.map(s => s.name).filter(Boolean)
  const seen = new Set([...itemNames, ...supplierNames.map(n => n.toLowerCase())])
  const options = [
    ...catalogueItems.map(it => ({
      name: it.name, tag: 'Item', item: it,
      sub: [it.category, it.amount != null ? gbp(it.amount) : null].filter(Boolean).join(' · ')
    })),
    ...suppliers.filter(s => s.name && !itemNames.has(s.name.toLowerCase()))
      .map(s => ({ name: s.name, tag: 'Supplier', sub: s.email || s.phone || '' })),
    ...pastMerchants.filter(m => !seen.has(m.toLowerCase())).map(m => ({ name: m, tag: 'Past', sub: '' })),
  ]
  const q = (value || '').trim().toLowerCase()
  const shown = q ? options.filter(o => o.name.toLowerCase().includes(q)) : options

  // Close on a click anywhere outside the picker.
  React.useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Escape closes the LIST, not the whole modal. Captured at the document so it
  // runs before Modal's own bubble-phase Escape handler and can stop it.
  React.useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  // Picking an item fills merchant + category + amount via onPickItem;
  // anything else just fills the merchant name as before.
  const pick = (o) => {
    if (o.item && onPickItem) onPickItem(o.item)
    else onChange(o.name)
    setOpen(false); setActive(-1)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && active >= 0 && shown[active]) { e.preventDefault(); pick(shown[active]) }
  }

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          style={{ ...inp, paddingRight: '34px' }}
          placeholder="e.g. Adobe UK"
          value={value}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        />
        <button type="button" tabIndex={-1} aria-label="Show suppliers"
          onClick={() => setOpen(o => !o)}
          style={{ position: 'absolute', right: '2px', top: '2px', bottom: '2px', width: '30px', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '11px' }}>▼</button>
      </div>
      {open && shown.length > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)', zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '10px', boxShadow: '0 12px 32px rgba(0,0,0,.45)', maxHeight: '210px', overflowY: 'auto' }}>
          {shown.map((o, i) => (
            <div key={(o.tag || '') + o.name} onMouseDown={e => { e.preventDefault(); pick(o) }} onMouseEnter={() => setActive(i)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '9px 12px', cursor: 'pointer', fontSize: '13.5px', background: i === active ? 'var(--surface2)' : 'transparent', borderBottom: '1px solid var(--border)' }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.name}
                {o.sub && <span style={{ color: 'var(--text3)', fontSize: '11.5px', marginLeft: '8px' }}>{o.sub}</span>}
              </span>
              <span style={{ flexShrink: 0, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.4px', color: (o.tag === 'Item' || o.tag === 'Supplier') ? 'var(--orange-light)' : 'var(--text3)' }}>
                {o.tag}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function ExpenseForm({onClose,onSaved,uid,expenses,categories,clients,edit,items}) {
  const [merchant,setMerchant]=useState(edit?.merchant||''); const [category,setCategory]=useState(edit?.category||'Other')
  const [amount,setAmount]=useState(edit?.amount!=null ? String(edit.amount) : ''); const [date,setDate]=useState(edit?.spent_on || new Date().toISOString().slice(0,10))
  const [notes,setNotes]=useState(edit?.notes||'')
  const [paidMethod,setPaidMethod]=useState(edit?.paid_method||'')
  const [receiptFile,setReceiptFile]=useState(null)
  const [busy,setBusy]=useState(false); const [err,setErr]=useState('')
  const pastMerchants = [...new Set((expenses||[]).map(e=>e.merchant).filter(Boolean))].sort()
  // Suppliers from Clients — kind 'supplier' or 'both'. Customers are excluded:
  // they belong on the income side, and a client who is genuinely both is
  // already marked 'both' by ensureClient.
  const suppliers = (clients||[])
    .filter(c => ['supplier','both'].includes(c.kind||'customer'))
    .sort((a,b) => (a.name||'').localeCompare(b.name||''))

  // Expense items saved on the Items page — the same catalogue idea as the
  // income form, surfaced at the top of the merchant picker. Picking one
  // fills merchant, category, and amount (when the item has one saved).
  const expenseItems = (items||[])
    .filter(i => i.kind === 'expense')
    .sort((a,b) => (a.name||'').localeCompare(b.name||''))
  const pickItem = (it) => {
    setMerchant(it.name || '')
    if (it.category) setCategory(it.category)
    if (it.amount != null) setAmount(String(it.amount))
    setErr('')
  }

  const suggest = async (m) => {
    setMerchant(m)
    if (m.length < 3) return
    const { data } = await loadRules()
    const hit = (data||[]).find(r => m.toUpperCase().includes(r.pattern.toUpperCase()))
    if (hit) setCategory(hit.category)
  }

  // Upload the chosen receipt, link it to the expense, and mark the expense.
  // Best-effort: if this fails the expense itself is already saved, so we
  // don't block the save — the receipt can be attached later from the expense's
  // own row on the Expenses page.
  const attachReceipt = async (expenseId) => {
    if (!receiptFile || !expenseId) return
    try {
      const safe = receiptFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${uid}/${crypto.randomUUID()}-${safe}`
      const { error: upErr } = await uploadFile(storagePath, receiptFile)
      if (upErr) throw upErr
      const { error: docErr } = await insertDocument({
        user_id: uid, type: 'Receipt', name: receiptFile.name,
        storage_path: storagePath, size_bytes: receiptFile.size, expense_id: expenseId
      })
      if (docErr) throw docErr
      const { error: exErr } = await updateExpenseReceipt(expenseId, receiptFile.name)
      if (exErr) throw exErr
    } catch (e) { console.warn('Expense saved but the receipt could not be attached:', e?.message) }
  }

  const save = async () => {
    if(!merchant||!amount) return setErr('Merchant and amount are required')
    if(Number(amount) < 0) return setErr('Amount cannot be negative')
    setBusy(true); setErr('')
    // A description only makes sense for "Other" — clear it on other categories
    // so switching away from Other doesn't leave a stale note behind.
    const noteVal = category==='Other' ? (notes.trim() || null) : null
    if (edit) {
      // Edit is a plain update — no rule learning or client creation, which are
      // onboarding side-effects meant for brand-new expenses.
      const { error } = await updateExpense(edit.id, {
        merchant:merchant.trim(), category, amount:Number(amount), spent_on:date, notes:noteVal,
        paid_method: paidMethod || null
      })
      if(error){ setErr(error.message); setBusy(false); return }
      await attachReceipt(edit.id)
      onSaved(); return
    }
    const { data: created, error } = await insertExpense({
      user_id:uid, merchant:merchant.trim(), category, amount:Number(amount), spent_on:date, source:'manual', notes:noteVal,
      paid_method: paidMethod || null
    })
    if(error){ setErr(error.message); setBusy(false); return }
    await attachReceipt(created?.id)

    await upsertRule({ user_id:uid, pattern:merchant.trim().split(' ')[0].toUpperCase(), category })
      .then(()=>{}).catch(()=>{})
    let added=null
    try { const r = await ensureClient(uid, merchant.trim(), 'supplier'); if(r.created) added=r.client?.name } catch(e){}
    onSaved(added ? { addedClient: added } : undefined)
  }
  return <Modal title={edit?"Edit expense":"Add expense"} onClose={onClose}>
    {err && <ErrBox m={err} />}
    <Field label="Supplier / merchant" hint={(expenseItems.length || suppliers.length) ? 'pick an item or supplier, or type a new one' : undefined}>
      <MerchantPicker value={merchant} onChange={suggest} suppliers={suppliers} pastMerchants={pastMerchants}
        catalogueItems={expenseItems} onPickItem={pickItem} />
    </Field>
    <Field label="Category">
      <select style={inp} value={category} onChange={e=>setCategory(e.target.value)}>
        {mergeCategories(categories).map(c=><option key={c} value={c}>{c}</option>)}
        {/* An edited expense may carry a category that's since been deleted —
            keep it selectable so opening the form doesn't silently change it. */}
        {edit?.category && !mergeCategories(categories).includes(edit.category) &&
          <option value={edit.category}>{edit.category}</option>}
      </select>
    </Field>
    {category==='Other' && (
      <Field label="What was it?" hint="saved with the expense">
        <input style={inp} placeholder="Short description, e.g. parking fine, stationery…" value={notes} onChange={e=>setNotes(e.target.value)} />
      </Field>
    )}
    <Field label="Amount">
      <input style={inp} type="number" {...noScroll} placeholder="£0.00" value={amount} onChange={e=>setAmount(e.target.value)} />
    </Field>
    <Field label="How was it paid?" hint="optional">
      <select style={inp} value={paidMethod} onChange={e=>setPaidMethod(e.target.value)}>
        {PAY_METHODS.map(([v,label])=><option key={v} value={v}>{label}</option>)}
      </select>
    </Field>
    <Field label="Receipt" hint="optional">
      <label style={{...inp, display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', color: receiptFile?'var(--text)':'var(--text3)' }}>
        <span aria-hidden="true">📎</span>
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{receiptFile ? receiptFile.name : 'Attach a receipt…'}</span>
        {receiptFile && <span onClick={(ev)=>{ev.preventDefault(); setReceiptFile(null)}} title="Remove" style={{ color:'var(--text3)', padding:'0 4px' }}>✕</span>}
        <input type="file" accept="image/*,.pdf" onChange={e=>{const f=e.target.files?.[0]; if(f) setReceiptFile(f); e.target.value=''}} style={{ display:'none' }} />
      </label>
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

export function InvoiceForm({onClose,onSaved,uid,invoices,clients,edit,settings,items}) {
  const [number,setNumber]=useState(()=> edit ? (edit.number||'') : nextInvoiceNumber(invoices))
  const [status,setStatus]=useState(edit?.status||'sent')
  const [date,setDate]=useState(edit?.issue_date || new Date().toISOString().slice(0,10))
  const [dueDate,setDueDate]=useState(edit?.due_date || '')
  const [notes,setNotes]=useState(edit?.notes || '')
  const [paidMethod,setPaidMethod]=useState(edit?.paid_method||'')
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
  // Only customers (and 'both') belong in the income picker — suppliers are
  // auto-created from expenses and belong on the expense side. Legacy rows
  // with no kind are treated as customers.
  const savedClients = (clients||[]).filter(c => (c.kind||'customer') !== 'supplier')
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
      loadInvoiceLines(edit.id).then(({ data: rows })=>{
        if(!alive) return
        if (rows && rows.length) setLines(rows.map(r=>({ description:r.description||'', qty:String(r.qty??'1'), unit_price:String(r.unit_price??'') })))
      })
    }
    return ()=>{ alive=false }
  }, [edit?.id])

  const setLine = (i, key, val) => setLines(ls => ls.map((l,idx)=> idx===i ? {...l, [key]:val} : l))
  const addLine = () => setLines(ls => [...ls, blankLine()])
  const removeLine = (i) => setLines(ls => ls.length>1 ? ls.filter((_,idx)=>idx!==i) : ls)

  // Income items catalogue → append a pre-filled line (or fill the last line
  // if it's still completely blank, so the default empty row gets used first).
  const catalogue = (items||[]).filter(i=>i.kind==='income')
  const addFromItem = (id) => {
    const it = catalogue.find(x=>x.id===id); if(!it) return
    const nl = { description: it.name || '', qty:'1', unit_price: it.unit_price!=null ? String(it.unit_price) : '' }
    setLines(ls => {
      const last = ls[ls.length-1]
      const lastBlank = last && !last.description.trim() && !String(last.unit_price).trim()
      return lastBlank ? [...ls.slice(0,-1), nl] : [...ls, nl]
    })
    setErr('')
  }

  const subtotal = lines.reduce((s,l)=> s + (Number(l.qty)||0)*(Number(l.unit_price)||0), 0)
  const vat = vatRegistered ? (isFlat ? subtotal*flatRate/100 : subtotal*(Number(vatRate)||0)/100) : 0
  const total = subtotal + vat

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
      paid_method: paidMethod || null,
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

    // replace-all line items. supabase-js resolves with { error } rather than
    // throwing, so these MUST be checked explicitly — otherwise a failed insert
    // after a successful delete silently wipes the invoice's itemisation.
    if (invId) {
      const rows = validLines.map((l,idx)=>({
        invoice_id:invId, user_id:uid, description:l.description.trim(),
        qty:Number(l.qty)||0, unit_price:Number(l.unit_price)||0, position:idx
      }))
      if (edit) {
        const { error: delErr } = await deleteInvoiceLines(invId)
        if (delErr) { setErr('The income was saved, but its line items could not be updated ('+delErr.message+'). Open it and save again.'); setBusy(false); return }
      }
      const { error: insErr } = await insertInvoiceLines(rows)
      if (insErr) { setErr('The income was saved, but its line items could not be saved ('+insErr.message+'). Open it and save again.'); setBusy(false); return }
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
      <div key={i} className="solo-lineitem" style={{ display:'flex', gap:'6px', marginBottom:'6px', alignItems:'flex-start' }}>
        <input style={{...inp, flex:1}} placeholder="Description" value={l.description} onChange={e=>setLine(i,'description',e.target.value)} />
        <input style={{...inp, width:'52px', textAlign:'center'}} type="number" {...noScroll} placeholder="Qty" value={l.qty} onChange={e=>setLine(i,'qty',e.target.value)} />
        <input style={{...inp, width:'82px'}} type="number" {...noScroll} placeholder="£ each" value={l.unit_price} onChange={e=>setLine(i,'unit_price',e.target.value)} />
        <button onClick={()=>removeLine(i)} title="Remove" style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'8px', color:'var(--text3)', width:'40px', minWidth:'40px', cursor:'pointer', fontSize:'16px', lineHeight:'38px' }}>×</button>
      </div>
    ))}
    <button onClick={addLine} style={{ background:'transparent', border:'1px dashed var(--border-light)', borderRadius:'8px', color:'var(--text2)', padding:'9px', width:'100%', cursor:'pointer', fontSize:'13px', marginTop:'2px' }}>+ Add line</button>
    {catalogue.length > 0 && (
      <select style={{...inp, marginTop:'8px'}} value="" onChange={e=>addFromItem(e.target.value)}>
        <option value="">＋ Add a line from your items…</option>
        {catalogue.map(it=><option key={it.id} value={it.id}>{it.name}{it.unit_price!=null?` · ${gbp(it.unit_price)}`:''}</option>)}
      </select>
    )}

    {/* VAT (only if registered) */}
    {vatRegistered && !isFlat && (
      <Field label="VAT rate %" style={{ marginTop:'14px' }}>
        <input style={inp} type="number" {...noScroll} value={vatRate} onChange={e=>setVatRate(e.target.value)} placeholder="20" />
      </Field>
    )}
    {vatRegistered && isFlat && (
      <div style={{ marginTop:'12px', fontSize:'12px', color:'var(--text3)' }}>Flat Rate VAT @ {flatRate}% applied.</div>
    )}

    {/* Totals summary */}
    <div style={{ marginTop:'16px', padding:'14px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:'10px', fontSize:'13px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text2)' }}><span>Subtotal</span><span className="mono">{gbp(subtotal)}</span></div>
      {vatRegistered && <div style={{ display:'flex', justifyContent:'space-between', color:'var(--text2)', marginTop:'6px' }}><span>VAT {isFlat?`(Flat ${flatRate}%)`:`(${Number(vatRate)||0}%)`}</span><span className="mono">{gbp(vat)}</span></div>}
      <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, marginTop:'8px', paddingTop:'8px', borderTop:'1px solid var(--border)', fontSize:'15px' }}><span>Total</span><span className="mono" style={{ color:'var(--orange-light)' }}>{gbp(total)}</span></div>
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
    <Field label="How was it paid?" hint="optional — e.g. once it's marked paid">
      <select style={inp} value={paidMethod} onChange={e=>setPaidMethod(e.target.value)}>
        {PAY_METHODS.map(([v,label])=><option key={v} value={v}>{label}</option>)}
      </select>
    </Field>
    <Field label="Notes" hint="optional, shown on invoice" style={{ marginBottom:0 }}>
      <textarea style={{...inp, minHeight:'56px', resize:'vertical', fontFamily:'inherit'}} placeholder="Payment terms, thank-you note…" value={notes} onChange={e=>setNotes(e.target.value)} />
    </Field>

    <button style={{...btnPri, width:'100%', marginTop:'18px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':(edit?'Update income':'Save income')}</button>
  </Modal>
}

// Logs a journey into soloops_mileage (journey_date, start_loc, end_loc,
// purpose, miles, claim). HMRC AMAP: 45p/mile up to 10,000 miles, 25p after.
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
      <input style={inp} type="number" {...noScroll} placeholder="0" value={miles} onChange={e=>setMiles(e.target.value)} />
    </Field>
    <button style={{...btnPri, width:'100%', marginTop:'18px', opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':(edit?'Update journey':'Save journey')}</button>
  </Modal>
}
