// Placeholder pages — will be fully built in next phases

export function PageHeader({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: '22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800 }}>{title}</div>
        {subtitle && <div style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {children && <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>{children}</div>}
    </div>
  )
}

export function Card({ children, style = {} }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', ...style }}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, delta, color = 'var(--text)' }) {
  return (
    <Card>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--text2)', fontFamily: 'DM Mono, monospace' }}>{label}</div>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '24px', fontWeight: 500, marginTop: '5px', marginBottom: '3px', color }}>{value}</div>
      {delta && <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{delta}</div>}
    </Card>
  )
}

export function Btn({ children, onClick, variant = 'secondary', sm = false }) {
  const styles = {
    primary: { background: 'var(--accent)', color: '#000' },
    secondary: { background: 'var(--surface3)', color: 'var(--text)', border: '1px solid var(--border)' },
    danger: { background: 'rgba(255,95,95,0.1)', color: 'var(--red)', border: '1px solid rgba(255,95,95,.2)' },
    success: { background: 'rgba(61,214,140,0.1)', color: 'var(--green)', border: '1px solid rgba(61,214,140,.2)' },
    ghost: { background: 'none', color: 'var(--text2)', border: 'none' },
    teal: { background: 'rgba(45,212,191,0.1)', color: 'var(--teal)', border: '1px solid rgba(45,212,191,.2)' },
  }
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: sm ? '5px 10px' : '8px 14px',
      borderRadius: '8px', fontSize: sm ? '11px' : '12px', fontWeight: 600,
      cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit',
      ...styles[variant],
    }}>
      {children}
    </button>
  )
}

export function Badge({ children, variant = 'gray' }) {
  const styles = {
    green: { background: 'rgba(61,214,140,0.1)', color: 'var(--green)' },
    red: { background: 'rgba(255,95,95,0.1)', color: 'var(--red)' },
    yellow: { background: 'rgba(245,200,66,0.12)', color: 'var(--accent)' },
    blue: { background: 'rgba(96,165,250,0.1)', color: 'var(--blue)' },
    gray: { background: 'var(--surface3)', color: 'var(--text2)' },
    teal: { background: 'rgba(45,212,191,0.1)', color: 'var(--teal)' },
  }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '20px',
      fontSize: '10px', fontWeight: 700, fontFamily: 'DM Mono, monospace',
      ...styles[variant],
    }}>
      {children}
    </span>
  )
}