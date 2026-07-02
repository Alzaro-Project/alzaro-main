import React from 'react'
import { card, inp, btnPri, btnSec, gbp, Th, Td, Empty, Status, Modal, ErrBox } from '../components/UI.jsx'
import { insertClient, updateClient, deleteClient } from '../lib/db.js'

const KIND_LABEL = { customer:'Customer', supplier:'Supplier', both:'Customer + Supplier' }
const KIND_COLOR = {
  customer:{ bg:'rgba(249,115,22,.12)', bd:'rgba(249,115,22,.4)', fg:'#fb923c' },
  supplier:{ bg:'rgba(59,130,246,.12)', bd:'rgba(59,130,246,.4)', fg:'#60a5fa' },
  both:{ bg:'rgba(168,139,250,.12)', bd:'rgba(168,139,250,.4)', fg:'#a78bfa' },
}

function KindBadge({ kind }) {
  const k = KIND_COLOR[kind] || KIND_COLOR.customer
  return <span style={{ fontSize:'10.5px', fontWeight:700, color:k.fg, background:k.bg, border:`1px solid ${k.bd}`, borderRadius:'20px', padding:'2px 9px', whiteSpace:'nowrap' }}>{KIND_LABEL[kind]||'Customer'}</span>
}

export default function Clients({ uid, clients, invoices, expenses, onChange, flash }) {
  const [editing, setEditing] = React.useState(null)
  const [selected, setSelected] = React.useState(null)
  const [filter, setFilter] = React.useState('all')
  const [search, setSearch] = React.useState('')
  const blank = { name:'', kind:'customer', email:'', phone:'', address:'', notes:'' }
  const [form, setForm] = React.useState(blank)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const open = (c) => { setEditing(c||'new'); setForm(c ? {...c} : blank); setErr('') }
  const save = async () => {
    if (!form.name.trim()) { setErr('Client name is required'); return }
    setBusy(true); setErr('')
    try {
      const payload = {
        name: form.name.trim(), kind: form.kind||'customer',
        email: form.email?.trim(), phone: form.phone?.trim(),
        address: form.address?.trim(), notes: form.notes?.trim()
      }
      if (editing === 'new') {
        const { error } = await insertClient({ user_id: uid, ...payload })
        if (error) throw error
      } else {
        const { error } = await updateClient(editing.id, payload)
        if (error) throw error
      }
      setEditing(null); onChange && onChange(); flash && flash('Client saved')
    } catch (e) { setErr(e.message || 'Could not save client') }
    setBusy(false)
  }
  const del = async (id, name) => {
    if(!window.confirm(`Delete client ${name||''}? This cannot be undone.`)) return
    setBusy(true)
    try { await deleteClient(id); setSelected(null); onChange && onChange() }
    catch (e) { setErr(e.message||'Could not delete') }
    setBusy(false)
  }

  const eq = (a,b) => (a||'').trim().toLowerCase() === (b||'').trim().toLowerCase()
  const clientIncome = (name) => (invoices||[]).filter(i => eq(i.client_name, name))
  const clientExpenses = (name) => (expenses||[]).filter(e => eq(e.merchant, name))

  const lbl = { fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }

  const TABS = [['all','All'],['customer','Customers'],['supplier','Suppliers'],['both','Both']]
  const q = search.trim().toLowerCase()
  const rows = (clients||[]).filter(c => {
    const k = c.kind || 'customer'
    const matchKind = filter==='all' || k===filter || (k==='both' && (filter==='customer'||filter==='supplier'))
    const matchSearch = !q || (`${c.name||''} ${c.email||''} ${c.phone||''}`).toLowerCase().includes(q)
    return matchKind && matchSearch
  })

  return (
    <div>
      <div style={{ marginBottom:'18px' }}>
        <h1 style={{ fontSize:'26px', fontWeight:800, margin:0 }}>Clients</h1>
        <div style={{ color:'var(--text3)', fontSize:'14px', marginTop:'4px' }}>Customers and suppliers — contacts, history and details in one place</div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap', marginBottom:'14px' }}>
        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
          {TABS.map(([v,label]) => (
            <button key={v} onClick={()=>setFilter(v)} style={{
              background: filter===v ? 'var(--surface2)' : 'transparent',
              color: filter===v ? 'var(--text)' : 'var(--text3)',
              border:'1px solid '+(filter===v?'var(--border-light)':'transparent'),
              borderRadius:'10px', padding:'7px 16px', fontSize:'13px', fontWeight:700, cursor:'pointer'
            }}>{label}</button>
          ))}
        </div>
        <button style={btnPri} onClick={()=>open(null)}>+ New client</button>
      </div>

      <input style={{ ...inp, marginBottom:'16px' }} placeholder="Search name, email, phone…" value={search} onChange={e=>setSearch(e.target.value)} />

      <div data-card style={card}>
        {err && editing===null && <ErrBox m={err} />}
        {rows.length===0 ? <Empty msg={(clients||[]).length===0 ? "No clients yet. They're added automatically when you record income or expenses — or add one here." : "No clients match this filter."} />
        : <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><Th cols={['Name','Type','Email','Phone','']} /></thead>
          <tbody>{rows.map(c => {
            const isOpen = selected===c.id
            const inc = clientIncome(c.name)
            const exp = clientExpenses(c.name)
            return (
            <React.Fragment key={c.id}>
            <tr style={{cursor:'pointer', background: isOpen ? 'var(--surface2)' : undefined}} onClick={()=>setSelected(isOpen ? null : c.id)}>
              <Td><span style={{display:'inline-flex',alignItems:'center',gap:'8px'}}><span style={{color:'var(--text3)',fontSize:'11px',display:'inline-block',transition:'transform .15s ease',transform:isOpen?'rotate(90deg)':'none'}}>▶</span>{c.name}</span></Td>
              <Td><KindBadge kind={c.kind||'customer'} /></Td>
              <Td muted>{c.email||'—'}</Td><Td muted>{c.phone||'—'}</Td>
              <Td right><button style={{...btnSec, padding:'5px 11px'}} onClick={(e)=>{e.stopPropagation(); open(c)}}>Edit</button></Td>
            </tr>
            {isOpen && (
            <tr>
              <td colSpan={5} style={{ padding:0, borderBottom:'1px solid var(--border)' }}>
                <div className="fade-in" style={{ background:'var(--surface2)', borderRadius:'12px', padding:'16px 18px', margin:'0 0 12px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'14px', marginBottom:'12px' }}>
                    <div><div style={lbl}>Email</div><div style={{fontSize:'13.5px'}}>{c.email||'—'}</div></div>
                    <div><div style={lbl}>Phone</div><div style={{fontSize:'13.5px'}}>{c.phone||'—'}</div></div>
                    <div><div style={lbl}>Address</div><div style={{fontSize:'13.5px', whiteSpace:'pre-wrap'}}>{c.address||'—'}</div></div>
                  </div>
                  {c.notes && <div style={{ fontSize:'13px', color:'var(--text2)', background:'var(--surface3)', padding:'10px 12px', borderRadius:'8px', marginBottom:'12px', whiteSpace:'pre-wrap' }}><span style={{...lbl, display:'block'}}>Notes</span>{c.notes}</div>}

                  <div style={{ fontWeight:700, fontSize:'13px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'8px' }}>
                    Income <span style={{ color:'var(--text3)', fontWeight:600 }}>({inc.length})</span>
                    {inc.length>0 && <span style={{ color:'var(--text3)', fontWeight:600, fontSize:'12px' }}>· {gbp(inc.reduce((s,i)=>s+Number(i.total||0),0))} total</span>}
                  </div>
                  {inc.length===0 ? <div style={{fontSize:'13px',color:'var(--text3)', marginBottom:'12px'}}>No income from this client yet.</div>
                  : <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'12px' }}>
                    <tbody>{inc.map(i => (
                      <tr key={i.id}><Td mono>{i.number||'—'}</Td><Td muted>{i.issue_date}</Td><Td mono right>{gbp(i.total)}</Td><Td right><Status s={i.status}/></Td></tr>
                    ))}</tbody>
                  </table>}

                  <div style={{ fontWeight:700, fontSize:'13px', marginBottom:'6px', display:'flex', alignItems:'center', gap:'8px' }}>
                    Expenses <span style={{ color:'var(--text3)', fontWeight:600 }}>({exp.length})</span>
                    {exp.length>0 && <span style={{ color:'var(--text3)', fontWeight:600, fontSize:'12px' }}>· {gbp(exp.reduce((s,e)=>s+Number(e.amount||0),0))} total</span>}
                  </div>
                  {exp.length===0 ? <div style={{fontSize:'13px',color:'var(--text3)'}}>No expenses to this supplier yet.</div>
                  : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <tbody>{exp.map(e => (
                      <tr key={e.id}><Td muted mono>{e.spent_on}</Td><Td>{e.category||'—'}</Td><Td mono right>{gbp(e.amount)}</Td></tr>
                    ))}</tbody>
                  </table>}

                  <div style={{ marginTop:'14px', display:'flex', gap:'8px' }}>
                    <button style={btnSec} onClick={(e)=>{e.stopPropagation(); open(c)}}>Edit</button>
                    <button style={{ background:'none', border:'1px solid var(--red)', color:'var(--red)', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontSize:'13px' }} onClick={(e)=>{e.stopPropagation(); del(c.id, c.name)}}>Delete</button>
                  </div>
                </div>
              </td>
            </tr>
            )}
            </React.Fragment>
          )})}</tbody>
        </table>}
      </div>

      {editing!==null && (
        <Modal title={editing==='new'?'New client':'Edit client'} onClose={()=>setEditing(null)}>
          {err && <ErrBox m={err} />}
          <input style={inp} placeholder="Client / company name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
          <select style={{...inp,marginTop:'12px'}} value={form.kind} onChange={e=>setForm({...form,kind:e.target.value})}>
            <option value="customer">Customer (you invoice them)</option>
            <option value="supplier">Supplier (you buy from them)</option>
            <option value="both">Both</option>
          </select>
          <input style={{...inp,marginTop:'12px'}} placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} />
          <input style={{...inp,marginTop:'12px'}} placeholder="Phone" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} />
          <textarea style={{...inp,marginTop:'12px',minHeight:'60px',resize:'vertical'}} placeholder="Address" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} />
          <textarea style={{...inp,marginTop:'12px',minHeight:'50px',resize:'vertical'}} placeholder="Notes" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
          <button style={{...btnPri,marginTop:'14px',width:'100%',opacity:busy?.7:1}} disabled={busy} onClick={save}>{busy?'Saving…':'Save client'}</button>
        </Modal>
      )}
    </div>
  )
}
