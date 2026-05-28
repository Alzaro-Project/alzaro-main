// ============================================================
// Calendar — placeholder
// ------------------------------------------------------------
// Mini calendar lives on the Dashboard. This is the full page
// for booking management, MOT scheduling, and technician shifts.
// Real build is a later phase — for now the route exists so the
// "Open" button on the Dashboard mini calendar lands somewhere
// sensible.
// ============================================================

const T = {
  surface: '#14121a', border: 'rgba(255,255,255,0.06)',
  red: '#e53935', text: '#f8f7fa', text2: '#9d99a8', text3: '#5c586a',
}

export default function Calendar() {
  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Calendar</div>
        <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
          Bookings, MOT reminders, service schedules — at a glance
        </div>
      </div>

      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: '12px', padding: '50px 20px', textAlign: 'center',
      }}>
        <i className="ti ti-calendar" style={{ fontSize: '40px', color: T.text3, marginBottom: '14px' }} aria-hidden="true" />
        <div style={{ fontSize: '17px', fontWeight: 500, marginBottom: '8px' }}>Calendar coming soon</div>
        <div style={{ fontSize: '13px', color: T.text2, maxWidth: '420px', margin: '0 auto 16px' }}>
          A full month / week / day view for bookings and MOT reminders. The mini calendar on your dashboard is the live preview.
        </div>
        <div style={{ fontSize: '11px', color: T.text3, fontFamily: 'monospace' }}>
          Later phase
        </div>
      </div>
    </div>
  )
}
