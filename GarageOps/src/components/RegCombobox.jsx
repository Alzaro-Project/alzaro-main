import { useMemo, useState } from 'react'

// ============================================================
// RegCombobox — free-text reg input with a dropdown of known
// regs (same pattern as the New Purchase reg dropdown). Typing
// a brand-new reg is always fine — the list is just a shortcut.
// Keyboard: arrows move, Enter picks, Esc closes the list only.
// Styling comes from the caller via inputStyle so it blends
// into each page's form.
// ============================================================
export default function RegCombobox({
  value, onChange, suggestions = [], placeholder = 'e.g. MK21 ABC',
  inputStyle = {}, dropdownHint = 'Known vehicles · or type a new reg',
}) {
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(-1)

  const matches = useMemo(() => {
    const q = (value || '').replace(/\s+/g, '').toUpperCase()
    const pool = q
      ? suggestions.filter(s => {
          const key = s.replace(/\s+/g, '').toUpperCase()
          return key.includes(q) && key !== q
        })
      : suggestions
    return pool.slice(0, 8)
  }, [suggestions, value])

  const pick = (s) => {
    onChange(s)
    setOpen(false)
    setIdx(-1)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setIdx(i => Math.min(i + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (open && idx >= 0 && matches[idx]) { e.preventDefault(); pick(matches[idx]) }
      else setOpen(false)
    } else if (e.key === 'Escape') {
      if (open) { e.stopPropagation(); setOpen(false); setIdx(-1) } // keep any parent modal open
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => { onChange(e.target.value.toUpperCase()); setOpen(true); setIdx(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{ textTransform: 'uppercase', paddingRight: '28px', ...inputStyle }}
      />
      <span
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: '9px', cursor: 'pointer', userSelect: 'none' }}
      >
        {open ? '▲' : '▼'}
      </span>
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, marginTop: '4px',
          background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '8px',
          maxHeight: '180px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          {dropdownHint && (
            <div style={{ padding: '6px 12px', fontSize: '9px', color: 'var(--text3)', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', background: 'var(--surface3)' }}>
              {dropdownHint}
            </div>
          )}
          {matches.map((s, i) => (
            <div
              key={s}
              onMouseDown={() => pick(s)}
              onMouseEnter={() => setIdx(i)}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: '12px',
                fontFamily: 'monospace', letterSpacing: '0.5px',
                borderBottom: '1px solid var(--border)',
                background: i === idx ? 'var(--surface3)' : 'transparent',
              }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
