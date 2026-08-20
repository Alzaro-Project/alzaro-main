import React from 'react'
import { card, inp, noScroll, btnPri, btnSec, gbp, Th, Td, Empty, ErrBox, CATEGORIES } from '../components/UI.jsx'
import { insertCategory, deleteCategory, hideCategory } from '../lib/db.js'
import { mergeCategories } from '../components/forms/Forms.jsx'
import { insertItem, updateItem, deleteItem } from '../lib/db.js'
import Clients from './Clients.jsx'

// One section (income or expense) with an add/edit row and a list.
function ItemSection({ kind, title, blurb, rows, uid, onChange, flash, categories }) {
  const isIncome = kind === 'income'
  const [name, setName] = React.useState('')
  const [price, setPrice] = React.useState('')          // income
  const [category, setCategory] = React.useState('Other') // expense
  const [amount, setAmount] = React.useState('')          // expense, optional
  const [editId, setEditId] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const reset = () => { setName(''); setPrice(''); setCategory('Other'); setAmount(''); setEditId(null); setErr('') }

  const startEdit = (it) => {
    setEditId(it.id); setName(it.name || ''); setErr('')
    if (isIncome) setPrice(it.unit_price != null ? String(it.unit_price) : '')
    else { setCategory(it.category || 'Other'); setAmount(it.amount != null ? String(it.amount) : '') }
  }

  const save = async () => {
    if (!name.trim()) return setErr('Give the item a name')
    if (isIncome && (price === '' || Number(price) < 0)) return setErr('Enter a price (0 or more)')
    if (!isIncome && amount !== '' && Number(amount) < 0) return setErr('Amount cannot be negative')
    setBusy(true); setErr('')
    const row = isIncome
      ? { kind: 'income', name: name.trim(), unit_price: Number(price) }
      : { kind: 'expense', name: name.trim(), category, amount: amount === '' ? null : Number(amount) }
    const { error } = editId
      ? await updateItem(editId, row)
      : await insertItem({ user_id: uid, ...row })
    setBusy(false)
    if (error) return setErr(error.message || 'Could not save the item')
    reset(); onChange(); flash(editId ? 'Item updated' : 'Item added')
  }

  const del = async (it) => {
    if (!window.confirm(`Delete “${it.name}”? Invoices and expenses already created from it are not affected.`)) return
    const { error } = await deleteItem(it.id)
    if (error) return setErr(error.message || 'Could not delete the item')
    if (editId === it.id) reset()
    onChange(); flash('Item deleted')
  }

  return (
    <div style={{ ...card }}>
      <div style={{ fontWeight: 700, marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '12.5px', color: 'var(--text3)', marginBottom: '16px' }}>{blurb}</div>
      {err && <ErrBox m={err} />}

      {/* Add / edit row */}
      <div className="solo-2col" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ flex: '1 1 130px', minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '5px' }}>{isIncome ? 'Description' : 'Merchant / name'}</div>
          <input style={inp} placeholder={isIncome ? 'e.g. Day rate — web design' : 'e.g. Adobe UK'} value={name} onChange={e => setName(e.target.value)} />
        </div>
        {isIncome ? (
          <div style={{ flex: '0 1 100px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '5px' }}>Price (£ each)</div>
            <input style={inp} type="number" {...noScroll} placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
        ) : (
          <>
            <div style={{ flex: '0 1 120px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '5px' }}>Category</div>
              <select style={inp} value={category} onChange={e => setCategory(e.target.value)}>
                {mergeCategories(categories).map(c => <option key={c} value={c}>{c}</option>)}
                {category && !mergeCategories(categories).includes(category) &&
                  <option value={category}>{category}</option>}
              </select>
            </div>
            <div style={{ flex: '0 1 100px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '5px' }}>Amount (£)</div>
              <input style={inp} type="number" {...noScroll} placeholder="—" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button style={{ ...btnPri, opacity: busy ? .7 : 1 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : (editId ? 'Update' : '+ Add')}</button>
          {editId && <button style={btnSec} onClick={reset}>Cancel</button>}
        </div>
      </div>

      {/* List */}
      {rows.length === 0 ? <Empty msg={isIncome ? 'No income items yet — add the things you invoice for regularly.' : 'No expense items yet — add the costs you log regularly.'} />
      : <div style={{ maxHeight: '200px', overflowY: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><Th cols={isIncome ? ['Description', 'Price', ''] : ['Merchant / name', 'Category', 'Amount', '']} /></thead>
        <tbody>{rows.map(it => (
          <tr key={it.id} style={{ opacity: editId === it.id ? .5 : 1 }}>
            <Td>{it.name}</Td>
            {isIncome
              ? <Td mono right>{gbp(it.unit_price || 0)}</Td>
              : <>
                  <Td><span style={{ background: 'var(--surface3)', padding: '4px 11px', borderRadius: '7px', fontSize: '12px', color: 'var(--text2)' }}>{it.category || '—'}</span></Td>
                  <Td mono right>{it.amount != null ? gbp(it.amount) : '—'}</Td>
                </>}
            <Td right>
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button style={{ ...btnSec, padding: '6px 12px' }} onClick={() => startEdit(it)}>Edit</button>
                <button style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text3)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '13px' }} onClick={() => del(it)}>✕</button>
              </div>
            </Td>
          </tr>))}</tbody>
      </table></div>}
    </div>
  )
}

export default function Items({ uid, items, onChange, flash, clients = [], invoices = [], expenses = [], categories = [] }) {
  const income = (items || []).filter(i => i.kind === 'income')
  const expense = (items || []).filter(i => i.kind === 'expense')
  return (
    <>
      <div className="solo-dash-cols" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <ItemSection
          kind="income" rows={income} uid={uid} onChange={onChange} flash={flash}
          title="Income items"
          blurb="Quick-picks for the Add income form — description and price fill themselves."
        />
        <ItemSection
          kind="expense" rows={expense} uid={uid} onChange={onChange} flash={flash} categories={categories}
          title="Expense items"
          blurb="Your regular costs, kept as a reference list."
        />
      </div>
      <CategoryManager uid={uid} categories={categories} onChange={onChange} flash={flash} />
      <Clients uid={uid} clients={clients} invoices={invoices} expenses={expenses} onChange={onChange} flash={flash} />
    </>
  )
}


// Owner-defined expense categories. They join the built-in list in the Add
// expense form and the expense-items form above. Deleting one never touches
// existing expenses — they keep the name as saved; it just stops being offered.
function CategoryManager({ uid, categories, onChange, flash }) {
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  // Tombstone rows (hidden=true) name the built-ins that have been switched off.
  const hiddenRows = categories.filter(c => c.hidden)
  const hiddenNames = new Set(hiddenRows.map(c => (c.name || '').toLowerCase()))
  const ownRows = categories.filter(c => !c.hidden)
  // 'Other' stays put — it's the fallback every expense form defaults to.
  const builtIns = CATEGORIES.filter(c => c !== 'Other')
  const liveBuiltIns = builtIns.filter(c => !hiddenNames.has(c.toLowerCase()))

  // Switching a built-in off writes a tombstone; nothing is deleted, so
  // expenses already filed under it keep the category name exactly as saved.
  const hideBuiltIn = async (cat) => {
    if (!window.confirm(`Remove “${cat}” from the list? Expenses already using it keep it — it just stops being offered. You can put it back any time.`)) return
    setErr('')
    const { error } = await hideCategory(uid, cat)
    if (error) { setErr(error.message || 'Could not remove the category'); return }
    flash('Category removed')
    onChange()
  }

  const restore = async (row) => {
    setErr('')
    const { error } = await deleteCategory(row.id)
    if (error) { setErr(error.message || 'Could not restore the category'); return }
    flash('Category restored')
    onChange()
  }

  const add = async () => {
    const clean = name.trim()
    if (!clean) { setErr('Type a category name first.'); return }
    if (clean.length > 40) { setErr('Keep it under 40 characters.'); return }
    if (mergeCategories(categories).some(c => c.toLowerCase() === clean.toLowerCase())) {
      setErr('That category already exists.'); return
    }
    // It's a built-in that was switched off — restoring it is the right move,
    // otherwise we'd end up with a tombstone and a custom row of the same name.
    if (hiddenNames.has(clean.toLowerCase())) {
      setErr(`“${clean}” is a built-in you removed — click it below to put it back.`); return
    }
    setBusy(true); setErr('')
    const { error } = await insertCategory({ user_id: uid, name: clean })
    setBusy(false)
    if (error) { setErr(error.message || 'Could not add the category'); return }
    setName('')
    flash('Category added')
    onChange()
  }

  const del = async (cat) => {
    if (!window.confirm(`Remove “${cat.name}”? Expenses already using it keep it — it just stops appearing in the dropdown.`)) return
    const { error } = await deleteCategory(cat.id)
    if (error) { setErr(error.message || 'Could not remove the category'); return }
    flash('Category removed')
    onChange()
  }

  return (
    <div style={{ ...card, marginBottom: '16px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, marginBottom: '4px' }}>Expense categories</div>
      <div style={{ color: 'var(--text3)', fontSize: '12.5px', marginBottom: '14px' }}>
        Your own categories, added to the built-in list in the Add expense form.
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {liveBuiltIns.map(c => (
          <span key={c} title="Built-in category" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text2)', background: 'var(--surface3)', borderRadius: '999px', padding: '4px 6px 4px 11px' }}>
            {c}
            <button onClick={() => hideBuiltIn(c)} title="Remove category" aria-label={'Remove ' + c}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px' }}>×</button>
          </span>
        ))}
        {ownRows.map(c => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--orange-light)', background: 'var(--orange-subtle)', border: '1px solid rgba(249,115,22,.3)', borderRadius: '999px', padding: '4px 6px 4px 11px' }}>
            {c.name}
            <button onClick={() => del(c)} title="Remove category" aria-label={'Remove ' + c.name}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '2px 4px' }}>×</button>
          </span>
        ))}
        <span title="Always available — the fallback for uncategorised expenses" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text2)', background: 'var(--surface3)', borderRadius: '999px', padding: '4px 11px' }}>Other</span>
      </div>

      {hiddenRows.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '11.5px', color: 'var(--text3)', marginRight: '4px' }}>Removed — click to put back:</span>
          {hiddenRows.map(c => (
            <button key={c.id} onClick={() => restore(c)} title={'Restore ' + c.name}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text3)', background: 'transparent', border: '1px dashed var(--border-light)', borderRadius: '999px', padding: '4px 11px', cursor: 'pointer' }}>
              <span style={{ textDecoration: 'line-through' }}>{c.name}</span>
              <span aria-hidden="true">↩</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, width: '220px' }} placeholder="New category, e.g. Subcontractors"
               value={name} onChange={e => setName(e.target.value)}
               onKeyDown={e => { if (e.key === 'Enter') add() }} />
        <button style={btnSec} disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add category'}</button>
        {err && <span style={{ color: 'var(--red)', fontSize: '12.5px' }}>{err}</span>}
      </div>
    </div>
  )
}
