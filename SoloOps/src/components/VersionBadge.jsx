import React from 'react'
import { VERSION, CHANGELOG } from '../version.js'
import { Modal } from '../components/UI.jsx'

const TYPE_META = {
  major: { label: 'Major',   color: 'var(--orange-light, #fb923c)', bg: 'rgba(249,115,22,.12)', border: 'rgba(249,115,22,.35)' },
  minor: { label: 'Feature', color: '#60a5fa',  bg: 'rgba(59,130,246,.12)', border: 'rgba(59,130,246,.35)' },
  patch: { label: 'Fix',     color: '#9ca3af',  bg: 'rgba(148,163,184,.12)', border: 'rgba(148,163,184,.3)' },
}

export default function VersionBadge({ footer = false }) {
  const [open, setOpen] = React.useState(false)
  // Two placements: the original top slot (under the brand) and a compact
  // `footer` variant that sits centered in the sidebar footer between the
  // email and the Dark mode button.
  const topStyle = { alignSelf:'flex-start', margin:'10px 0 0 16px', background:'var(--surface2, rgba(0,0,0,.04))',
    color:'var(--text3)', border:'1px solid var(--border, var(--line))', borderRadius:'999px',
    padding:'2px 10px', fontSize:'10.5px', fontWeight:700, fontFamily:'monospace', cursor:'pointer' }
  const footerStyle = { alignSelf:'center', margin:'0 0 8px', background:'transparent',
    color:'var(--text3)', border:'none', borderRadius:'999px',
    padding:'2px 8px', fontSize:'10.5px', fontWeight:700, fontFamily:'monospace', cursor:'pointer',
    letterSpacing:'.3px', flexShrink:0 }
  return (
    <>
      <button onClick={() => setOpen(true)} title="What's new"
        style={footer ? footerStyle : topStyle}>
        v{VERSION}
      </button>
      {open && (
        <Modal title="What's new" onClose={() => setOpen(false)} width="520px">
          <div style={{ fontSize:'12.5px', color:'var(--text3)', marginBottom:'18px' }}>
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
                    {rel.title && <span style={{ fontSize:'13px', color:'var(--text2)', fontWeight:600 }}>{rel.title}</span>}
                    <span style={{ marginLeft:'auto', fontSize:'11.5px', color:'var(--text3)' }}>{rel.date}</span>
                  </div>
                  <ul style={{ margin:0, paddingLeft:'18px', display:'flex', flexDirection:'column', gap:'5px' }}>
                    {rel.changes.map((c,i) => <li key={i} style={{ fontSize:'13px', color:'var(--text2)', lineHeight:1.5 }}>{c}</li>)}
                  </ul>
                </div>
              )
            })}
          </div>
        </Modal>
      )}
    </>
  )
}
