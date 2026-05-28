import { useState, useMemo } from 'react'
import { useBookings } from '../hooks/useBookings'

// ============================================================
// Calendar — GarageOps v1 (Step 1: view-only)
// ------------------------------------------------------------
// Three views: Month / Week / Day (dropdown switch)
// Bookings are read from Supabase via useBookings().
// Tapping a booking opens a read-only details modal.
// "+ New booking" is shown but informs the user it's coming
// in Step 2 (when we wire up create/edit/delete).
// ============================================================

// ---------- THEME ----------
const T = {
  bg: '#0c0a0f',
  surface: '#14121a',
  surface2: '#1e1b26',
  surface3: '#282432',
  border: 'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.1)',
  red: '#e53935',
  green: '#4caf50',
  amber: '#ff9800',
  blue: '#60a5fa',
  purple: '#a78bfa',
  grey: '#9d99a8',
  text: '#f8f7fa',
  text2: '#9d99a8',
  text3: '#5c586a',
}

const STATUS_COLOR = {
  booked: T.blue,
  in_progress: T.amber,
  complete: T.green,
  cancelled: T.grey,
  no_show: T.red,
}

const STATUS_LABEL = {
  booked: 'Booked',
  in_progress: 'In progress',
  complete: 'Complete',
  cancelled: 'Cancelled',
  no_show: 'No show',
}

const VIEWS = [
  { key: 'month', label: 'Month', icon: 'ti-calendar' },
  { key: 'week',  label: 'Week',  icon: 'ti-calendar-week' },
  { key: 'day',   label: 'Day',   icon: 'ti-calendar-event' },
]

// ---------- DATE HELPERS ----------
function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fmtTime(t) {
  if (!t) return ''
  return String(t).slice(0, 5) // "09:00:00" -> "09:00"
}
function addMinutes(time, mins) {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + mins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
function timeToMinutes(t) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
function getMonthGrid(year, month) {
  // Returns 6 rows × 7 columns starting Monday
  const first = new Date(year, month, 1)
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1 // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const out = []
  for (let i = firstDow; i > 0; i--) {
    out.push({ d: prevDays - i + 1, monthOffset: -1 })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    out.push({ d, monthOffset: 0 })
  }
  while (out.length < 42) {
    out.push({ d: out.length - daysInMonth - firstDow + 1, monthOffset: 1 })
  }
  // attach actual Date objects
  return out.map(c => {
    let date
    if (c.monthOffset === 0) date = new Date(year, month, c.d)
    else if (c.monthOffset === -1) date = new Date(year, month - 1, c.d)
    else date = new Date(year, month + 1, c.d)
    return { ...c, date, dateStr: fmtDate(date) }
  })
}
function getWeekDays(refDate) {
  const d = new Date(refDate)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    return x
  })
}
function getTimeSlots(start, end, slotMinutes) {
  const out = []
  let t = start
  const endMin = timeToMinutes(end)
  while (timeToMinutes(t) < endMin) {
    out.push(t)
    t = addMinutes(t, slotMinutes)
  }
  return out
}
function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ============================================================
// MAIN
// ============================================================
export default function Calendar() {
  const { bookings, slotSettings, loading, error, refresh } = useBookings()
  const [view, setView] = useState('month')
  const [refDate, setRefDate] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showInfoModal, setShowInfoModal] = useState(false)

  // Group bookings by yyyy-mm-dd for fast lookup
  const byDate = useMemo(() => {
    const map = {}
    bookings.forEach(b => {
      if (!map[b.booking_date]) map[b.booking_date] = []
      map[b.booking_date].push(b)
    })
    Object.values(map).forEach(list =>
      list.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    )
    return map
  }, [bookings])

  // Navigation
  const navPrev = () => {
    const d = new Date(refDate)
    if (view === 'month') d.setMonth(d.getMonth() - 1)
    else if (view === 'week') d.setDate(d.getDate() - 7)
    else d.setDate(d.getDate() - 1)
    setRefDate(d)
  }
  const navNext = () => {
    const d = new Date(refDate)
    if (view === 'month') d.setMonth(d.getMonth() + 1)
    else if (view === 'week') d.setDate(d.getDate() + 7)
    else d.setDate(d.getDate() + 1)
    setRefDate(d)
  }
  const navToday = () => setRefDate(new Date())

  // Header label changes by view
  const headerLabel = useMemo(() => {
    if (view === 'month') {
      return refDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    }
    if (view === 'week') {
      const days = getWeekDays(refDate)
      const a = days[0], b = days[6]
      return `${a.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return refDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }, [view, refDate])

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      {/* ===== HEADER ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Calendar</div>
          <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>
            Bookings, MOTs and job schedule
          </div>
        </div>
        <button onClick={() => setShowInfoModal(true)} style={primaryBtn}>
          <i className="ti ti-plus" aria-hidden="true" /> New booking
        </button>
      </div>

      {/* ===== TOOLBAR ===== */}
      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: '12px', padding: '12px 14px',
        marginBottom: '14px',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      }}>
        {/* View dropdown */}
        <div style={{ display: 'flex', gap: '4px', background: T.surface2, borderRadius: '8px', padding: '3px', border: `1px solid ${T.border2}` }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)} style={{
              padding: '6px 12px', borderRadius: '6px',
              fontSize: '12px', fontWeight: view === v.key ? 500 : 400,
              color: view === v.key ? T.text : T.text2,
              background: view === v.key ? T.surface3 : 'transparent',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: '5px',
            }}>
              <i className={`ti ${v.icon}`} style={{ fontSize: '13px' }} />
              {v.label}
            </button>
          ))}
        </div>

        {/* Nav arrows */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <button onClick={navPrev} style={iconBtn} title="Previous"><i className="ti ti-chevron-left" /></button>
          <button onClick={navToday} style={{
            background: T.surface2, color: T.text, border: `1px solid ${T.border2}`,
            borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Today</button>
          <button onClick={navNext} style={iconBtn} title="Next"><i className="ti ti-chevron-right" /></button>
        </div>

        {/* Period label */}
        <div style={{ fontSize: '14px', fontWeight: 500, minWidth: '180px', textAlign: 'right' }}>
          {headerLabel}
        </div>
      </div>

      {/* ===== ERROR / LOADING ===== */}
      {error && (
        <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
          ⚠ Couldn't load bookings: {error} <button onClick={refresh} style={{ marginLeft: '8px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, padding: '3px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Retry</button>
        </div>
      )}

      {/* ===== VIEW BODY ===== */}
      <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: T.text3 }}>
            <i className="ti ti-loader-2" style={{ fontSize: '28px', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: '13px', marginTop: '12px' }}>Loading bookings...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : (
          <>
            {view === 'month' && <MonthView refDate={refDate} byDate={byDate} onBookingClick={setSelectedBooking} onDayClick={d => { setRefDate(d); setView('day') }} />}
            {view === 'week'  && <WeekView  refDate={refDate} byDate={byDate} slotSettings={slotSettings} onBookingClick={setSelectedBooking} />}
            {view === 'day'   && <DayView   refDate={refDate} byDate={byDate} slotSettings={slotSettings} onBookingClick={setSelectedBooking} />}
          </>
        )}
      </div>

      {/* ===== Empty-state hint ===== */}
      {!loading && bookings.length === 0 && (
        <div style={{ marginTop: '14px', padding: '14px', background: T.surface2, borderRadius: '10px', textAlign: 'center', fontSize: '12px', color: T.text2 }}>
          No bookings yet. Creating bookings is being built in Step 2 — coming next.
        </div>
      )}

      {/* ===== Detail modal ===== */}
      {selectedBooking && (
        <BookingModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}

      {/* ===== "+ New booking" info modal (Step 2 placeholder) ===== */}
      {showInfoModal && (
        <InfoModal
          icon="ti-tools"
          title="Booking creation coming next"
          body="The form to create new bookings is being built in the next step. For now you can see existing bookings on this calendar — the booking list is being read straight from your Supabase database."
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </div>
  )
}

// ============================================================
// MONTH VIEW
// ============================================================
function MonthView({ refDate, byDate, onBookingClick, onDayClick }) {
  const grid = getMonthGrid(refDate.getFullYear(), refDate.getMonth())
  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <div>
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `0.5px solid ${T.border}` }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', minHeight: '480px' }}>
        {grid.map((c, i) => {
          const isToday = sameDate(c.date, today)
          const isCurrentMonth = c.monthOffset === 0
          const dayBookings = byDate[c.dateStr] || []
          return (
            <div key={i} onClick={() => isCurrentMonth && onDayClick(c.date)} style={{
              borderRight: i % 7 === 6 ? 'none' : `0.5px solid ${T.border}`,
              borderBottom: `0.5px solid ${T.border}`,
              padding: '6px 6px 4px',
              minHeight: '80px',
              opacity: isCurrentMonth ? 1 : 0.35,
              cursor: isCurrentMonth ? 'pointer' : 'default',
              background: isToday ? 'rgba(229,57,53,0.06)' : 'transparent',
              display: 'flex', flexDirection: 'column', gap: '3px',
            }}
              onMouseEnter={e => { if (isCurrentMonth && !isToday) e.currentTarget.style.background = T.surface2 }}
              onMouseLeave={e => { if (isCurrentMonth && !isToday) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '11px', fontFamily: 'monospace',
                  color: isToday ? T.red : T.text2,
                  fontWeight: isToday ? 700 : 500,
                }}>
                  {c.d}
                </span>
                {dayBookings.length > 0 && (
                  <span style={{ fontSize: '9px', color: T.text3, fontFamily: 'monospace' }}>
                    {dayBookings.length}
                  </span>
                )}
              </div>
              {dayBookings.slice(0, 3).map(b => (
                <div key={b.id} onClick={e => { e.stopPropagation(); onBookingClick(b) }} style={{
                  background: `${STATUS_COLOR[b.status] || T.blue}20`,
                  borderLeft: `2px solid ${STATUS_COLOR[b.status] || T.blue}`,
                  padding: '2px 5px', borderRadius: '3px',
                  fontSize: '10px', color: T.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  cursor: 'pointer',
                }}>
                  <span style={{ fontFamily: 'monospace', color: T.text2 }}>{fmtTime(b.start_time)}</span>{' '}
                  {b.customer_name || 'Booking'}
                </div>
              ))}
              {dayBookings.length > 3 && (
                <div style={{ fontSize: '9px', color: T.text3, fontFamily: 'monospace', textAlign: 'center' }}>
                  +{dayBookings.length - 3} more
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// WEEK VIEW
// ============================================================
function WeekView({ refDate, byDate, slotSettings, onBookingClick }) {
  const days = getWeekDays(refDate)
  const slots = getTimeSlots(slotSettings.dayStart, slotSettings.dayEnd, slotSettings.slotMinutes)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: '480px' }}>
      {/* Top-left corner blank */}
      <div style={{ borderRight: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}` }} />
      {/* Day headers */}
      {days.map((d, i) => {
        const isToday = sameDate(d, today)
        return (
          <div key={i} style={{
            borderRight: i === 6 ? 'none' : `0.5px solid ${T.border}`,
            borderBottom: `0.5px solid ${T.border}`,
            padding: '10px 8px', textAlign: 'center',
            background: isToday ? 'rgba(229,57,53,0.06)' : 'transparent',
          }}>
            <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {d.toLocaleDateString('en-GB', { weekday: 'short' })}
            </div>
            <div style={{ fontSize: '15px', fontWeight: isToday ? 700 : 500, color: isToday ? T.red : T.text, marginTop: '2px' }}>
              {d.getDate()}
            </div>
          </div>
        )
      })}

      {/* Time rows */}
      {slots.map((t, ri) => (
        <>
          <div key={`t-${ri}`} style={{
            borderRight: `0.5px solid ${T.border}`,
            borderBottom: `0.5px solid ${T.border}`,
            padding: '4px 6px', fontSize: '10px', color: T.text3, fontFamily: 'monospace', textAlign: 'right',
          }}>
            {t}
          </div>
          {days.map((d, di) => {
            const dateStr = fmtDate(d)
            const dayBookings = byDate[dateStr] || []
            const matches = dayBookings.filter(b => fmtTime(b.start_time) === t)
            return (
              <div key={`c-${ri}-${di}`} style={{
                borderRight: di === 6 ? 'none' : `0.5px solid ${T.border}`,
                borderBottom: `0.5px solid ${T.border}`,
                minHeight: '32px', padding: '2px', position: 'relative',
              }}>
                {matches.map(b => (
                  <div key={b.id} onClick={() => onBookingClick(b)} style={{
                    background: `${STATUS_COLOR[b.status] || T.blue}30`,
                    borderLeft: `2px solid ${STATUS_COLOR[b.status] || T.blue}`,
                    padding: '3px 5px', borderRadius: '3px',
                    fontSize: '10px', color: T.text,
                    cursor: 'pointer',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: '2px',
                  }} title={`${b.customer_name || ''} · ${b.description || b.job_type || ''}`}>
                    {b.customer_name || 'Booking'}
                  </div>
                ))}
              </div>
            )
          })}
        </>
      ))}
    </div>
  )
}

// ============================================================
// DAY VIEW
// ============================================================
function DayView({ refDate, byDate, slotSettings, onBookingClick }) {
  const slots = getTimeSlots(slotSettings.dayStart, slotSettings.dayEnd, slotSettings.slotMinutes)
  const dateStr = fmtDate(refDate)
  const dayBookings = byDate[dateStr] || []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', minHeight: '480px' }}>
      {slots.map((t, i) => {
        const matches = dayBookings.filter(b => fmtTime(b.start_time) === t)
        return (
          <>
            <div key={`t-${i}`} style={{
              borderRight: `0.5px solid ${T.border}`,
              borderBottom: `0.5px solid ${T.border}`,
              padding: '8px 12px', fontSize: '12px', color: T.text3, fontFamily: 'monospace', textAlign: 'right',
            }}>
              {t}
            </div>
            <div key={`c-${i}`} style={{
              borderBottom: `0.5px solid ${T.border}`,
              minHeight: '44px', padding: '4px 8px', position: 'relative',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              {matches.map(b => (
                <div key={b.id} onClick={() => onBookingClick(b)} style={{
                  background: `${STATUS_COLOR[b.status] || T.blue}25`,
                  borderLeft: `3px solid ${STATUS_COLOR[b.status] || T.blue}`,
                  padding: '6px 10px', borderRadius: '5px',
                  fontSize: '13px', color: T.text,
                  cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>
                    <strong style={{ fontWeight: 500 }}>{b.customer_name || 'Booking'}</strong>
                    {b.vehicle_reg && <span style={{ fontFamily: 'monospace', color: T.text2, marginLeft: '8px', fontSize: '11px' }}>{b.vehicle_reg}</span>}
                    {b.description && <span style={{ color: T.text2, marginLeft: '8px', fontSize: '12px' }}>· {b.description}</span>}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: 'monospace', color: T.text3 }}>{b.duration_min} min</span>
                </div>
              ))}
            </div>
          </>
        )
      })}
    </div>
  )
}

// ============================================================
// BOOKING DETAIL MODAL (read-only)
// ============================================================
function BookingModal({ booking, onClose }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '460px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.3px' }}>{booking.customer_name || 'Booking'}</div>
            {booking.vehicle_reg && (
              <div style={{ display: 'inline-block', marginTop: '6px', fontFamily: 'monospace', background: T.surface2, padding: '3px 9px', borderRadius: '5px', fontSize: '12px', color: T.text2 }}>{booking.vehicle_reg}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, fontSize: '22px', cursor: 'pointer', padding: '0' }}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '12px' }}>
          <Field label="Date" value={booking.booking_date} />
          <Field label="Time" value={`${fmtTime(booking.start_time)} (${booking.duration_min} min)`} />
          {booking.job_type && <Field label="Job type" value={booking.job_type} />}
          <Field label="Status" value={
            <span style={{ background: `${STATUS_COLOR[booking.status]}25`, color: STATUS_COLOR[booking.status], padding: '3px 9px', borderRadius: '20px', fontSize: '10px', fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase' }}>
              {STATUS_LABEL[booking.status] || booking.status}
            </span>
          } />
        </div>

        {booking.description && (
          <div style={{ background: T.surface2, borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Description</div>
            <div style={{ fontSize: '13px' }}>{booking.description}</div>
          </div>
        )}

        {booking.notes && (
          <div style={{ background: T.surface2, borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
            <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
            <div style={{ fontSize: '13px', color: T.text2 }}>{booking.notes}</div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: T.text3, fontFamily: 'monospace' }}>Edit / delete coming in Step 2</div>
          <button onClick={onClose} style={{ ...primaryBtn, background: T.surface3, color: T.text }}>Close</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '13px' }}>{value}</div>
    </div>
  )
}

// ============================================================
// INFO MODAL — used for "+ New booking" (Step 2 placeholder)
// ============================================================
function InfoModal({ icon, title, body, onClose }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '380px', textAlign: 'center' }}>
        <i className={`ti ${icon}`} style={{ fontSize: '36px', color: T.red, marginBottom: '12px' }} />
        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '13px', color: T.text2, lineHeight: 1.6, marginBottom: '18px' }}>{body}</div>
        <button onClick={onClose} style={primaryBtn}>Got it</button>
      </div>
    </div>
  )
}

// ============================================================
// STYLES
// ============================================================
const primaryBtn = {
  background: T.red, color: '#fff', border: 'none',
  padding: '10px 16px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px',
}
const iconBtn = {
  width: '32px', height: '32px',
  background: T.surface2, border: `1px solid ${T.border2}`,
  color: T.text2, borderRadius: '7px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '14px',
}
const modalOverlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 600, padding: '16px',
}
const modalCard = {
  background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: '16px', padding: '24px',
  width: '100%', maxHeight: '90vh', overflowY: 'auto',
  fontFamily: "'Space Grotesk', sans-serif", color: T.text,
}
