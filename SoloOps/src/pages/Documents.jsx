import React from 'react'
import { card, inp, btnPri, btnSec, Th, Td, Empty, ErrBox } from '../components/UI.jsx'
import { loadDocuments, insertDocument, deleteDocument, uploadFile, signedUrl, removeFiles } from '../lib/db.js'

export default function Documents({ uid, invoices, expenses }) {
  const [q, setQ] = React.useState('')
  const [files, setFiles] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [docType, setDocType] = React.useState('Statement')
  const [err, setErr] = React.useState('')
  const [preview, setPreview] = React.useState(null)

  const load = () => {
    setLoading(true)
    loadDocuments().then(({ data }) => { setFiles(data||[]); setLoading(false) })
  }
  React.useEffect(load, [])

  const upload = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    setBusy(true); setErr('')
    try {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${uid}/${crypto.randomUUID()}-${safe}`
      const { error: upErr } = await uploadFile(path, f)
      if (upErr) throw upErr
      await insertDocument({
        user_id: uid, type: docType, name: f.name, storage_path: path, size_bytes: f.size
      })
      load()
    } catch (e) { setErr(e.message || 'Upload failed') }
    setBusy(false)
  }

  const download = async (path, name) => {
    try {
      const { data, error } = await signedUrl(path, 60)
      if (error) throw error
      const a = document.createElement('a'); a.href = data.signedUrl; a.download = name || 'file'; a.target = '_blank'; a.click()
    } catch (e) { setErr(e.message || 'Could not get download link') }
  }

  const openPreview = async (path, name) => {
    try {
      const { data, error } = await signedUrl(path, 60*10)
      if (error) throw error
      const ext = (name||'').split('.').pop().toLowerCase()
      const isImage = ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext)
      const isPdf = ext === 'pdf'
      setPreview({ url: data.signedUrl, name, isImage, isPdf })
    } catch (e) { setErr(e.message || 'Could not open preview') }
  }

  const remove = async (id, path, name) => {
    if(!window.confirm(`Delete ${name||'this document'}? The file is permanently removed and cannot be undone.`)) return
    setBusy(true)
    try {
      await removeFiles([path])
      await deleteDocument(id)
      load()
    } catch (e) { setErr(e.message || 'Could not delete') }
    setBusy(false)
  }

  const kb = b => b ? (b/1024 < 1024 ? Math.round(b/1024)+' KB' : (b/1048576).toFixed(1)+' MB') : '—'
  const filtered = files.filter(d => !q || (d.name+' '+d.type).toLowerCase().includes(q.toLowerCase()))

  return (
    <div style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px', gap:'12px', flexWrap:'wrap' }}>
        <div style={{fontWeight:700}}>Documents</div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <input style={{...inp, width:'180px', padding:'8px 12px'}} placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
          <select style={{...inp, width:'auto', padding:'8px 10px'}} value={docType} onChange={e=>setDocType(e.target.value)}>
            <option>Statement</option><option>Invoice</option><option>Receipt</option><option>Report</option><option>Other</option>
          </select>
          <label style={{...btnPri, cursor:'pointer', opacity:busy?.7:1}}>
            {busy ? 'Uploading…' : 'Upload'}
            <input type="file" onChange={upload} disabled={busy} style={{ display:'none' }} />
          </label>
        </div>
      </div>
      <div style={{fontSize:'12.5px', color:'var(--text3)', marginBottom:'16px'}}>Securely stored, searchable, downloadable. Files are private to your account.</div>
      {err && <ErrBox m={err} />}
      {loading ? <div style={{color:'var(--text2)',padding:'14px'}}>Loading…</div>
      : filtered.length===0 ? <Empty msg={q ? 'No documents match your search.' : 'No files yet. Use Upload to add statements, invoices or receipts — or attach receipts from the Receipts tab.'} />
      : <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead><Th cols={['Type','Name','Uploaded','Size','']} /></thead>
        <tbody>{filtered.map(d => (
          <tr key={d.id}>
            <Td><span style={{ background:'var(--surface3)', padding:'4px 11px', borderRadius:'7px', fontSize:'12px', color:'var(--text2)' }}>{d.type}</span></Td>
            <Td><span onClick={()=>openPreview(d.storage_path,d.name)} style={{cursor:'pointer'}}>{d.name}</span></Td>
            <Td muted mono>{(d.uploaded_at||'').slice(0,10)}</Td>
            <Td muted mono>{kb(d.size_bytes)}</Td>
            <Td right>
              <button style={{...btnSec, padding:'6px 12px', marginRight:'6px'}} onClick={()=>openPreview(d.storage_path, d.name)}>Preview</button>
              <button style={{...btnSec, padding:'6px 12px', marginRight:'6px'}} onClick={()=>download(d.storage_path, d.name)}>Download</button>
              <button style={{ background:'none', border:'1px solid var(--border)', color:'var(--text3)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer', fontSize:'13px' }} onClick={()=>remove(d.id, d.storage_path, d.name)}>✕</button>
            </Td>
          </tr>))}</tbody>
      </table>}

      {preview && (
        <div onClick={()=>setPreview(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'30px' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', border:'1px solid var(--border-light)', borderRadius:'14px', padding:'18px', maxWidth:'900px', width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ fontWeight:700 }}>{preview.name}</div>
              <div style={{ display:'flex', gap:'8px' }}>
                <a href={preview.url} target="_blank" rel="noopener" style={{...btnSec, padding:'6px 12px', textDecoration:'none'}}>Open in tab</a>
                <button style={{ background:'none', border:'1px solid var(--border)', color:'var(--text3)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer' }} onClick={()=>setPreview(null)}>✕</button>
              </div>
            </div>
            <div style={{ flex:1, overflow:'auto', background:'var(--surface2)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {preview.isImage ? <img src={preview.url} alt={preview.name} style={{ maxWidth:'100%', maxHeight:'78vh', objectFit:'contain' }} />
              : preview.isPdf ? <iframe src={preview.url} title={preview.name} style={{ width:'100%', height:'78vh', border:'none', borderRadius:'10px' }} />
              : <div style={{ padding:'50px', textAlign:'center', color:'var(--text3)' }}>Can't preview this file type.<br/>Use "Open in tab" or Download.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
