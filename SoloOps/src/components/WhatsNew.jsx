import React from 'react'
import { Modal } from './UI.jsx'
import { CHANGELOG } from '../lib/changelog.js'

const TYPE_STYLES = {
  added:    { label: 'Added',    color: 'var(--green)',  bg: 'rgba(34,197,94,.12)' },
  improved: { label: 'Improved', color: 'var(--blue)',   bg: 'rgba(59,130,246,.12)' },
  fixed:    { label: 'Fixed',    color: 'var(--orange)', bg: 'rgba(249,115,22,.12)' },
  removed:  { label: 'Removed',  color: 'var(--text3)',  bg: 'var(--surface3)' },
}

function TypePill({ type }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.improved
  return (
    <span style={{ padding:'2px 8px', borderRadius:'6px', fontSize:'10px', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:s.color, background:s.bg, flexShrink:0, marginTop:'2px' }}>
      {s.label}
    </span>
  )
}

export default function WhatsNew({ onClose }) {
  return (
    <Modal title="What's new" onClose={onClose} width="500px">
      <div style={{ display:'flex', flexDirection:'column', gap:'22px' }}>
        {CHANGELOG.map((entry) => (
          <div key={entry.version}>
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:'10px', marginBottom:'10px' }}>
              <div style={{ fontSize:'15px', fontWeight:700 }}>{entry.title}</div>
              <div className="mono" style={{ fontSize:'12px', color:'var(--text3)', flexShrink:0 }}>{entry.date}</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {entry.items.map((it, i) => (
                <div key={i} style={{ display:'flex', gap:'10px', alignItems:'flex-start', fontSize:'13.5px', color:'var(--text2)', lineHeight:1.5 }}>
                  <TypePill type={it.type} />
                  <span>{it.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
