import React from 'react'
import { btnSec } from './UI.jsx'
import { loadReceiptDoc, signedUrl } from '../lib/db.js'

// Full-screen preview of the receipt attached to one expense. Looks up the
// stored file via soloops_documents.expense_id, signs a short-lived URL and
// renders it (image inline, PDF in a frame). Also handles the case where an
// expense was marked as having a receipt without a file being uploaded.
export default function ReceiptViewer({ expense, onClose }) {
  const [state, setState] = React.useState({ loading: true })

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await loadReceiptDoc(expense.id)
        if (error) throw error
        const doc = data && data[0]
        if (!doc) { if (alive) setState({ loading: false, noFile: true }); return }
        const { data: s, error: sErr } = await signedUrl(doc.storage_path, 60 * 10)
        if (sErr) throw sErr
        const ext = (doc.name || '').split('.').pop().toLowerCase()
        const isImage = ['png','jpg','jpeg','gif','webp','bmp','svg'].includes(ext)
        const isPdf = ext === 'pdf'
        if (alive) setState({ loading: false, url: s.signedUrl, name: doc.name, isImage, isPdf })
      } catch (e) {
        if (alive) setState({ loading: false, err: e.message || 'Could not load the receipt' })
      }
    })()
    return () => { alive = false }
  }, [expense.id])

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:'30px' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'var(--surface)', border:'1px solid var(--border-light)', borderRadius:'14px', padding:'18px', maxWidth:'900px', width:'100%', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:700 }}>Receipt · {expense.merchant}</div>
            <div style={{ fontSize:'12px', color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{state.name || expense.receipt_name || ''}</div>
          </div>
          <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
            {state.url && <a href={state.url} target="_blank" rel="noopener" style={{...btnSec, padding:'6px 12px', textDecoration:'none'}}>Open in tab</a>}
            <button aria-label="Close" style={{ background:'none', border:'1px solid var(--border)', color:'var(--text3)', borderRadius:'8px', padding:'6px 10px', cursor:'pointer' }} onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', background:'var(--surface2)', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', minHeight:'160px' }}>
          {state.loading ? <div style={{ color:'var(--text3)', padding:'40px' }}>Loading receipt…</div>
          : state.err ? <div style={{ color:'var(--red)', padding:'40px', textAlign:'center', fontSize:'13.5px' }}>{state.err}</div>
          : state.noFile ? (
            <div style={{ padding:'40px', textAlign:'center', color:'var(--text3)', fontSize:'13.5px', lineHeight:1.7 }}>
              This expense is marked as having a receipt{expense.receipt_name ? <> (&ldquo;{expense.receipt_name}&rdquo;)</> : null}, but no file was uploaded when it was attached.<br/>
              To store the actual file, go to the Receipts tab, choose the file, and attach it to this expense again.
            </div>
          )
          : state.isImage ? <img src={state.url} alt={state.name} style={{ maxWidth:'100%', maxHeight:'78vh', objectFit:'contain' }} />
          : state.isPdf ? <iframe src={state.url} title={state.name} style={{ width:'100%', height:'78vh', border:'none', borderRadius:'10px' }} />
          : <div style={{ padding:'50px', textAlign:'center', color:'var(--text3)' }}>Can't preview this file type.<br/>Use &ldquo;Open in tab&rdquo; to download it.</div>}
        </div>
      </div>
    </div>
  )
}
