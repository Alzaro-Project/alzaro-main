import React from 'react'
import { card, inp, btnPri, btnSec, gbp, Th, Td, Empty, Status, Modal, ErrBox } from '../components/UI.jsx'
import { insertClient, updateClient, deleteClient } from '../lib/db.js'

export default function Clients({ uid, clients, invoices, onChange, flash }) {
  const [editing, setEditing] = React.useState(null)
  const [selected, setSelected] = React.useState(null)
  const blank = { name:'', email:'', phone:'', address:'', notes:'' }
  const [form, setForm] = React.useState(blank)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')

  const open = (c) => { setEditing(c||'new'); setForm(c ? {...c} : blank); setErr('') }
  const save = async () => {
    if (!form.name.trim()) { setErr('Client name is required'); return }
    setBusy(true); setErr('')
    try {
      if (editing === 'new') {
        const { error } = await insertClient({
          user_id: uid, name: form.name.trim(), email: form.email?.trim(), phone: form.phone?.trim(), address: form.address?.trim(), notes: form.notes?.trim()
        })
        if (error) throw error
      } else {
        const { error } = await updateClient(editing.id, {
          name: form.name.trim(), email: form.email?.trim(), phone: form.phone?.trim(), address: form.address?.trim(), notes: form.notes?.trim()
        })
        if (error) throw error
      }
      setEditing(null); onChange && onChange(); flash && flash('Client saved')
    } catch (e) { setErr(e.message || 'Could not save client') }
    setBusy(false)
  }
  const del = async (id) => {
    setBusy(true)
    try { await deleteClient(id); setSelected(null); onChange && onChange() }
    catch (e) { setErr(e.message||'Could not delete') }
    setBusy(false)
  }

  const clientInvoices = (name) => invoices.filter(i => (i.client_name||'') === name)
  const lbl = { fontSize:'12px', color:'var(--text3)', marginBottom:'5px' }

  return (
    <div>
      <div data-card style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div style={{fontWeight:700}}>Clients</div>
          <button style={btnPri} onClick={()=>open(null)}>+ New client</button>
        </div>
        {err && editing===null && <ErrBox m={err} />}
        {clients.length===0 ? <Empty msg="No clients yet. Add one to attach to your invoices." />
        : <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><Th cols={['Name','Email','Phone','']} /></thead>
          <tbody>{clients.map(c => {
            const isOpen = selected===c.id
            return (
            <React.Fragment key={c.id}>
            <tr style={{cursor:'pointer', background: isOpen ? 'var(--surface2)' : undefined}} onClick={()=>setSelected(isOpen ? null : c.id)}>
              <Td><span style={{display:'inline-flex',alignItems:'center',gap:'8px'}}><span style={{color:'var(--text3)',fontSize:'11px',display:'inline-block',transition:'transform .15s ease',transform:isOpen?'rotate(90deg)':'none'}}>▶</span>{c.name}</span></Td>
              <Td muted>{c.email||'—'}</Td><Td muted>{c.phone||'—'}</Td>
              <Td right><button style={{...btnSec, padding:'5px 11px'}} onClick={(e)=>{e.stopPropagation(); open(c)}}>Edit</button></Td>
            </tr>
            {isOpen && (
            <tr>
              <td colSpan={4} style={{ padding:0, borderBottom:'1px solid var(--border)' }}>
                <div className="fade-in" style={{ background:'var(--surface2)', borderRadius:'12px', padding:'16px 18px', margin:'0 0 12px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:'14px', marginBottom: c.notes ? '12px' : '4px' }}>
                    <div><div style={lbl}>Email</div><div style={{fontSize:'13.5px'}}>{c.email||'—'}</div></div>
                    <div><div style={lbl}>Phone</div><div style={{fontSize:'13.5px'}}>{c.phone||'—'}</div></div>
                    <div><div style={lbl}>Address</div><div style={{fontSize:'13.5px', whiteSpace:'pre-wrap'}}>{c.address||'—'}</div></div>
                  </div>
                  {c.notes && <div style={{ fontSize:'13px', color:'var(--text2)', background:'var(--surface3)', padding:'10px 12px', borderRadius:'8px', marginBottom:'12px', whiteSpace:'pre-wrap' }}><span style={{...lbl, display:'block'}}>Notes</span>{c.notes}</div>}
                  <div style={{ fontWeight:700, fontSize:'13px', marginBottom:'6px' }}>Invoices ({clientInvoices(c.name).length})</div>
                  {clientInvoices(c.name).length===0 ? <div style={{fontSize:'13px',color:'var(--text3)'}}>No invoices for this client yet.</div>
                  : <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <tbody>{clientInvoices(c.name).map(i => (
                      <tr key={i.id}><Td mono>{i.number||'—'}</Td><Td muted>{i.issue_date}</Td><Td mono right>{gbp(i.total)}</Td><Td right><Status s={i.status}/></Td></tr>
                    ))}</tbody>
                  </table>}
                  <div style={{ marginTop:'14px', display:'flex', gap:'8px' }}>
                    <button style={btnSec} onClick={(e)=>{e.stopPropagation(); open(c)}}>Edit</button>
                    <button style={{ background:'none', border:'1px solid var(--red)', color:'var(--red)', borderRadius:'8px', padding:'9px 14px', cursor:'pointer', fontSize:'13px' }} onClick={(e)=>{e.stopPropagation(); del(c.id)}}>Delete</button>
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
