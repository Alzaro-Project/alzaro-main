import { useNavigate } from 'react-router-dom'

// ============================================================
// RegLink — clickable car reg that deep-links to the Database
// page pre-searched for that reg (same ?reg=… mechanism the
// dashboard global search uses). Renders nothing for blank regs.
// stopPropagation so it works inside clickable rows/cards.
// ============================================================
export default function RegLink({ reg, style = {}, children, title }) {
  const navigate = useNavigate()
  if (!reg) return null
  return (
    <span
      onClick={e => {
        e.stopPropagation()
        navigate(`/database?reg=${encodeURIComponent(reg)}`)
      }}
      title={title || `View ${reg} in Database`}
      style={{
        cursor: 'pointer',
        textDecoration: 'underline dotted',
        textUnderlineOffset: '3px',
        ...style,
      }}
    >
      {children ?? reg}
    </span>
  )
}
