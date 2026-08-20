import React from 'react'
import { VERSION, CHANGELOG } from '../version.js'

const TYPE_META = {
  major: { label: 'Major',   color: 'var(--brand)', bg: 'rgba(249,115,22,.12)', border: 'rgba(249,115,22,.35)' },
  minor: { label: 'Feature', color: '#60a5fa',  bg: 'rgba(59,130,246,.12)', border: 'rgba(59,130,246,.35)' },
  patch: { label: 'Fix',     color: '#9ca3af',  bg: 'rgba(148,163,184,.12)', border: 'rgba(148,163,184,.3)' },
}

export default function VersionBadge({ footer = false }) {
  const [open, setOpen] = React.useState(false)
  const topStyle = { alignSelf:'flex-start', margin:'10px 0 0 16px', background:'var(--panel-2, var(--surface2, rgba(0,0,0,.04)))',
    color:'var(--txt-3, var(--text3))', border:'1px solid var(--line, var(--border))', borderRadius:'999px',
    padding:'2px 10px', fontSize:'10.5px', fontWeight:700, fontFamily:'monospace', cursor:'pointer' }
  const footerStyle = { alignSelf:'center', margin:'0 auto 6px', display:'block', background:'transparent',
    color:'var(--txt-3, var(--text3))', border:'none', borderRadius:'999px',
    padding:'2px 8px', fontSize:'10.5px', fontWeight:700, fontFamily:'monospace', cursor:'pointer', letterSpacing:'.3px' }
  return (
    <>
      <button onClick={() => setOpen(true)} title="What's new"
        style={footer ? footerStyle : topStyle}>
        v{VERSION}
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center',
            justifyContent:'center', zIndex:400, padding:'20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background:'var(--panel, var(--surface, var(--card, #fff)))', border:'1px solid var(--line, var(--border))',
              borderRadius:'16px', padding:'24px', width:'520px', maxWidth:'100%', maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div style={{ fontSize:'18px', fontWeight:800 }}>What's new</div>
              <button onClick={() => setOpen(false)} aria-label="Close"
                style={{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'var(--txt-2, var(--text2, inherit))' }}>×</button>
            </div>
            <div style={{ fontSize:'12.5px', color:'var(--txt-3, var(--text3))', marginBottom:'18px' }}>
              You're on <span style={{ fontFamily:'monospace' }}>v{VERSION}</span>.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'18px' }}>
              {CHANGELOG.map(rel => {
                const t = TYPE_META[rel.type] || TYPE_META.patch
                return (
                  <div key={rel.version}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'15px', fontWeight:800, fontFamily:'monospace' }}>v{rel.version}</span>
                      <span style={{ fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px',
                        color:t.color, background:t.bg, border:`1px solid ${t.border}`, borderRadius:'20px', padding:'2px 9px' }}>{t.label}</span>
                      {rel.title && <span style={{ fontSize:'13px', color:'var(--txt-2, var(--text2))', fontWeight:600 }}>{rel.title}</span>}
                      <span style={{ marginLeft:'auto', fontSize:'11.5px', color:'var(--txt-3, var(--text3))' }}>{rel.date}</span>
                    </div>
                    <ul style={{ margin:0, paddingLeft:'18px', display:'flex', flexDirection:'column', gap:'5px' }}>
                      {rel.changes.map((c,i) => <li key={i} style={{ fontSize:'13px', color:'var(--txt-2, var(--text2))', lineHeight:1.5 }}>{c}</li>)}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
