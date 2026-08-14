import React from 'react'
import { card, inp, btnPri, btnSec, gbp, Th, Td, Empty, ErrBox, CATEGORIES } from '../components/UI.jsx'
import { insertItem, updateItem, deleteItem } from '../lib/db.js'
import Clients from './Clients.jsx'

// One section (income or expense) with an add/edit row and a list.
function ItemSection({ kind, title, blurb, rows, uid, onChange, flash }) {
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
            <input style={inp} type="number" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
        ) : (
          <>
            <div style={{ flex: '0 1 120px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '5px' }}>Category</div>
              <select style={inp} value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex: '0 1 100px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '5px' }}>Amount (£)</div>
              <input style={inp} type="number" placeholder="—" value={amount} onChange={e => setAmount(e.target.value)} />
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

export default function Items({ uid, items, onChange, flash, clients = [], invoices = [], expenses = [] }) {
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
          kind="expense" rows={expense} uid={uid} onChange={onChange} flash={flash}
          title="Expense items"
          blurb="Your regular costs, kept as a reference list."
        />
      </div>
      <Clients uid={uid} clients={clients} invoices={invoices} expenses={expenses} onChange={onChange} flash={flash} />
    </>
  )
}
