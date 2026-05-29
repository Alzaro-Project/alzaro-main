import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useBookings } from '../hooks/useBookings'
import { useServices } from '../hooks/useServices'

// ============================================================
// Calendar — GarageOps v2 (Step 2: full CRUD)
// ------------------------------------------------------------
// New in Step 2:
//   - + New booking button opens the real form
//   - Clicking a slot in Day or Week opens form pre-filled
//   - Booking detail modal has Edit and Delete
//   - Customer picker reads from useStore.customers
//   - Vehicle picker auto-filters to the selected customer
// ============================================================

const T = {
  bg: '#0c0a0f', surface: '#14121a', surface2: '#1e1b26', surface3: '#282432',
  border: 'rgba(255,255,255,0.06)', border2: 'rgba(255,255,255,0.1)',
  red: '#e53935', green: '#4caf50', amber: '#ff9800',
  blue: '#60a5fa', purple: '#a78bfa', grey: '#9d99a8',
  text: '#f8f7fa', text2: '#9d99a8', text3: '#5c586a',
}

const STATUS_COLOR = {
  booked: T.blue, in_progress: T.amber, complete: T.green,
  cancelled: T.grey, no_show: T.red,
}
const STATUS_LABEL = {
  booked: 'Booked', in_progress: 'In progress', complete: 'Complete',
  cancelled: 'Cancelled', no_show: 'No show',
}
const STATUS_OPTIONS = [
  { value: 'booked',      label: 'Booked' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'complete',    label: 'Complete' },
  { value: 'cancelled',   label: 'Cancelled' },
  { value: 'no_show',     label: 'No show' },
]

const JOB_TYPE_FALLBACK = ['MOT', 'Service', 'Repair', 'Diagnostic', 'Other']

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
function fmtTime(t) { return t ? String(t).slice(0, 5) : '' }
function addMinutes(time, mins) {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + mins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
function timeToMinutes(t) { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
function getMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const firstDow = first.getDay() === 0 ? 6 : first.getDay() - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()
  const out = []
  for (let i = firstDow; i > 0; i--) out.push({ d: prevDays - i + 1, monthOffset: -1 })
  for (let d = 1; d <= daysInMonth; d++) out.push({ d, monthOffset: 0 })
  while (out.length < 42) out.push({ d: out.length - daysInMonth - firstDow + 1, monthOffset: 1 })
  return out.map(c => {
    const date = c.monthOffset === 0 ? new Date(year, month, c.d)
      : c.monthOffset === -1 ? new Date(year, month - 1, c.d)
      : new Date(year, month + 1, c.d)
    return { ...c, date, dateStr: fmtDate(date) }
  })
}
function getWeekDays(refDate) {
  const d = new Date(refDate); d.setHours(0, 0, 0, 0)
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
  d.setDate(d.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x })
}
function getTimeSlots(start, end, slotMinutes) {
  const out = []; let t = start; const endMin = timeToMinutes(end)
  while (timeToMinutes(t) < endMin) { out.push(t); t = addMinutes(t, slotMinutes) }
  return out
}
function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ============================================================
// MAIN
// ============================================================
export default function Calendar() {
  const {
    bookings, slotSettings, loading, error, refresh,
    createBooking, updateBooking, deleteBooking,
  } = useBookings()

  const [view, setView] = useState('month')
  const [refDate, setRefDate] = useState(new Date())
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [formMode, setFormMode] = useState(null) // null | 'create' | 'edit'
  const [formInitial, setFormInitial] = useState({})

  // Group bookings by date for fast lookup
  const byDate = useMemo(() => {
    const map = {}
    bookings.forEach(b => {
      if (!map[b.booking_date]) map[b.booking_date] = []
      map[b.booking_date].push(b)
    })
    return map
  }, [bookings])

  // Open form for new booking
  const openCreate = (prefill = {}) => {
    setFormInitial({
      booking_date: prefill.booking_date || fmtDate(refDate),
      start_time:   prefill.start_time   || slotSettings.dayStart,
      duration_min: slotSettings.slotMinutes >= 30 ? slotSettings.slotMinutes : 30,
      status: 'booked',
    })
    setFormMode('create')
  }

  // Open form for editing
  const openEdit = (booking) => {
    setFormInitial(booking)
    setFormMode('edit')
    setSelectedBooking(null)
  }

  // Delete confirm
  const handleDelete = async (booking) => {
    if (!window.confirm(`Delete this booking for ${booking.customer_name || 'customer'}?`)) return
    try {
      await deleteBooking(booking.id)
      setSelectedBooking(null)
    } catch (err) {
      alert('Failed to delete: ' + (err.message || err))
    }
  }

  // Save (create or update)
  const handleSave = async (data) => {
    try {
      if (formMode === 'create') await createBooking(data)
      else await updateBooking(data.id, data)
      setFormMode(null)
    } catch (err) {
      throw err // bubble back to form for in-form error display
    }
  }

  // Nav
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

  const headerLabel = useMemo(() => {
    if (view === 'month') return refDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    if (view === 'week') {
      const days = getWeekDays(refDate)
      return `${days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return refDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }, [view, refDate])

  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Calendar</div>
          <div style={{ fontSize: '13px', color: T.text2, marginTop: '2px' }}>Bookings, MOTs and job schedule</div>
        </div>
        <button onClick={() => openCreate()} style={primaryBtn}>
          <i className="ti ti-plus" aria-hidden="true" /> New booking
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: '12px', padding: '12px 14px', marginBottom: '14px',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
      }}>
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
        <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
          <button onClick={navPrev} style={iconBtn}><i className="ti ti-chevron-left" /></button>
          <button onClick={navToday} style={{
            background: T.surface2, color: T.text, border: `1px solid ${T.border2}`,
            borderRadius: '7px', padding: '6px 12px', fontSize: '12px', fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Today</button>
          <button onClick={navNext} style={iconBtn}><i className="ti ti-chevron-right" /></button>
        </div>
        <div style={{ fontSize: '14px', fontWeight: 500, minWidth: '180px', textAlign: 'right' }}>{headerLabel}</div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '12px 14px', borderRadius: '10px', fontSize: '13px', marginBottom: '12px' }}>
          ⚠ Couldn't load bookings: {error} <button onClick={refresh} style={{ marginLeft: '8px', background: 'transparent', border: `1px solid ${T.red}`, color: T.red, padding: '3px 9px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Retry</button>
        </div>
      )}

      {/* Body */}
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
            {view === 'week'  && <WeekView  refDate={refDate} byDate={byDate} slotSettings={slotSettings} onBookingClick={setSelectedBooking} onSlotClick={(date, time) => openCreate({ booking_date: fmtDate(date), start_time: time })} />}
            {view === 'day'   && <DayView   refDate={refDate} byDate={byDate} slotSettings={slotSettings} onBookingClick={setSelectedBooking} onSlotClick={time => openCreate({ booking_date: fmtDate(refDate), start_time: time })} />}
          </>
        )}
      </div>

      {!loading && bookings.length === 0 && (
        <div style={{ marginTop: '14px', padding: '14px', background: T.surface2, borderRadius: '10px', textAlign: 'center', fontSize: '12px', color: T.text2 }}>
          No bookings yet. Tap <strong style={{ color: T.text }}>+ New booking</strong> or click an empty slot in Day or Week view to add one.
        </div>
      )}

      {/* Modals */}
      {selectedBooking && (
        <BookingModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} onEdit={openEdit} onDelete={handleDelete} />
      )}
      {formMode && (
        <BookingForm
          mode={formMode}
          initial={formInitial}
          slotSettings={slotSettings}
          onClose={() => setFormMode(null)}
          onSave={handleSave}
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `0.5px solid ${T.border}` }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: '11px', color: T.text3, fontFamily: 'monospace', letterSpacing: '0.8px', textTransform: 'uppercase' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: '1fr', minHeight: '480px' }}>
        {grid.map((c, i) => {
          const isToday = sameDate(c.date, today)
          const isCurrentMonth = c.monthOffset === 0
          const dayBookings = byDate[c.dateStr] || []
          return (
            <div key={i} onClick={() => isCurrentMonth && onDayClick(c.date)} style={{
              borderRight: i % 7 === 6 ? 'none' : `0.5px solid ${T.border}`,
              borderBottom: `0.5px solid ${T.border}`,
              padding: '6px 6px 4px', minHeight: '80px',
              opacity: isCurrentMonth ? 1 : 0.35,
              cursor: isCurrentMonth ? 'pointer' : 'default',
              background: isToday ? 'rgba(229,57,53,0.06)' : 'transparent',
              display: 'flex', flexDirection: 'column', gap: '3px',
            }}
              onMouseEnter={e => { if (isCurrentMonth && !isToday) e.currentTarget.style.background = T.surface2 }}
              onMouseLeave={e => { if (isCurrentMonth && !isToday) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isToday ? T.red : T.text2, fontWeight: isToday ? 700 : 500 }}>{c.d}</span>
                {dayBookings.length > 0 && <span style={{ fontSize: '9px', color: T.text3, fontFamily: 'monospace' }}>{dayBookings.length}</span>}
              </div>
              {dayBookings.slice(0, 3).map(b => (
                <div key={b.id} onClick={e => { e.stopPropagation(); onBookingClick(b) }} style={{
                  background: `${STATUS_COLOR[b.status] || T.blue}20`,
                  borderLeft: `2px solid ${STATUS_COLOR[b.status] || T.blue}`,
                  padding: '2px 5px', borderRadius: '3px', fontSize: '10px', color: T.text,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer',
                }}>
                  <span style={{ fontFamily: 'monospace', color: T.text2 }}>{fmtTime(b.start_time)}</span>{' '}
                  {b.customer_name || 'Booking'}
                </div>
              ))}
              {dayBookings.length > 3 && <div style={{ fontSize: '9px', color: T.text3, fontFamily: 'monospace', textAlign: 'center' }}>+{dayBookings.length - 3} more</div>}
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
function WeekView({ refDate, byDate, slotSettings, onBookingClick, onSlotClick }) {
  const days = getWeekDays(refDate)
  const slots = getTimeSlots(slotSettings.dayStart, slotSettings.dayEnd, slotSettings.slotMinutes)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minHeight: '480px' }}>
      <div style={{ borderRight: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}` }} />
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
            <div style={{ fontSize: '15px', fontWeight: isToday ? 700 : 500, color: isToday ? T.red : T.text, marginTop: '2px' }}>{d.getDate()}</div>
          </div>
        )
      })}

      {slots.map((t, ri) => (
        <>
          <div key={`t-${ri}`} style={{
            borderRight: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}`,
            padding: '4px 6px', fontSize: '10px', color: T.text3, fontFamily: 'monospace', textAlign: 'right',
          }}>{t}</div>
          {days.map((d, di) => {
            const dateStr = fmtDate(d)
            const matches = (byDate[dateStr] || []).filter(b => fmtTime(b.start_time) === t)
            return (
              <div key={`c-${ri}-${di}`} onClick={() => matches.length === 0 && onSlotClick(d, t)} style={{
                borderRight: di === 6 ? 'none' : `0.5px solid ${T.border}`,
                borderBottom: `0.5px solid ${T.border}`,
                minHeight: '32px', padding: '2px', position: 'relative',
                cursor: matches.length === 0 ? 'pointer' : 'default',
              }}
                onMouseEnter={e => { if (matches.length === 0) e.currentTarget.style.background = T.surface2 }}
                onMouseLeave={e => { if (matches.length === 0) e.currentTarget.style.background = 'transparent' }}
              >
                {matches.map(b => (
                  <div key={b.id} onClick={e => { e.stopPropagation(); onBookingClick(b) }} style={{
                    background: `${STATUS_COLOR[b.status] || T.blue}30`,
                    borderLeft: `2px solid ${STATUS_COLOR[b.status] || T.blue}`,
                    padding: '3px 5px', borderRadius: '3px', fontSize: '10px', color: T.text,
                    cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px',
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
function DayView({ refDate, byDate, slotSettings, onBookingClick, onSlotClick }) {
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
              borderRight: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}`,
              padding: '8px 12px', fontSize: '12px', color: T.text3, fontFamily: 'monospace', textAlign: 'right',
            }}>{t}</div>
            <div key={`c-${i}`} onClick={() => matches.length === 0 && onSlotClick(t)} style={{
              borderBottom: `0.5px solid ${T.border}`,
              minHeight: '44px', padding: '4px 8px',
              display: 'flex', flexDirection: 'column', gap: '4px',
              cursor: matches.length === 0 ? 'pointer' : 'default',
            }}
              onMouseEnter={e => { if (matches.length === 0) e.currentTarget.style.background = T.surface2 }}
              onMouseLeave={e => { if (matches.length === 0) e.currentTarget.style.background = 'transparent' }}
            >
              {matches.length === 0 ? (
                <span style={{ fontSize: '11px', color: T.text3, fontFamily: 'monospace', opacity: 0.5 }}>＋ Click to add</span>
              ) : matches.map(b => (
                <div key={b.id} onClick={e => { e.stopPropagation(); onBookingClick(b) }} style={{
                  background: `${STATUS_COLOR[b.status] || T.blue}25`,
                  borderLeft: `3px solid ${STATUS_COLOR[b.status] || T.blue}`,
                  padding: '6px 10px', borderRadius: '5px', fontSize: '13px', color: T.text,
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
// BOOKING DETAIL MODAL (view only with edit/delete)
// ============================================================
function BookingModal({ booking, onClose, onEdit, onDelete }) {
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
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.text3, fontSize: '22px', cursor: 'pointer' }}><i className="ti ti-x" /></button>
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
            <div style={fieldLbl}>Description</div>
            <div style={{ fontSize: '13px' }}>{booking.description}</div>
          </div>
        )}
        {booking.notes && (
          <div style={{ background: T.surface2, borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
            <div style={fieldLbl}>Notes</div>
            <div style={{ fontSize: '13px', color: T.text2 }}>{booking.notes}</div>
          </div>
        )}

        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
          <button onClick={() => onDelete(booking)} style={dangerBtn}>
            <i className="ti ti-trash" /> Delete
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={ghostBtn}>Close</button>
            <button onClick={() => onEdit(booking)} style={primaryBtn}>
              <i className="ti ti-edit" /> Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// BOOKING FORM (create + edit)
// ============================================================
function BookingForm({ mode, initial, slotSettings, onClose, onSave }) {
  const customers = useStore(s => s.customers) || []
  const vehicles  = useStore(s => s.vehicles)  || []
  const { services } = useServices()

  const [form, setForm] = useState(() => ({
    id: initial.id || null,
    customer_id: initial.customer_id || '',
    vehicle_id:  initial.vehicle_id  || '',
    customer_name: initial.customer_name || '',
    vehicle_reg:   initial.vehicle_reg   || '',
    booking_date:  initial.booking_date  || fmtDate(new Date()),
    start_time:    fmtTime(initial.start_time) || slotSettings.dayStart,
    duration_min:  initial.duration_min || 60,
    job_type:      initial.job_type || '',
    description:   initial.description || '',
    notes:         initial.notes || '',
    status:        initial.status || 'booked',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Customer search
  const [custQuery, setCustQuery] = useState(form.customer_name || '')
  const [showCustList, setShowCustList] = useState(false)
  const filteredCustomers = useMemo(() => {
    const q = custQuery.toLowerCase().trim()
    if (!q) return customers.slice(0, 20)
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.reg || '').toLowerCase().includes(q)
    ).slice(0, 20)
  }, [customers, custQuery])

  // Vehicles available for the chosen customer
  const customerVehicles = useMemo(() => {
    if (!form.customer_id) return []
    return vehicles.filter(v => v.customer_id === form.customer_id)
  }, [vehicles, form.customer_id])

  const pickCustomer = (c) => {
    setForm(f => ({
      ...f,
      customer_id: c.id,
      customer_name: c.name,
      // If customer has just one vehicle, auto-pick it. Else clear.
      vehicle_id: '',
      vehicle_reg: c.reg || '',
    }))
    setCustQuery(c.name)
    setShowCustList(false)
  }

  const pickVehicle = (vId) => {
    if (!vId) { setForm(f => ({ ...f, vehicle_id: '', vehicle_reg: '' })); return }
    const v = vehicles.find(x => x.id === vId)
    setForm(f => ({ ...f, vehicle_id: vId, vehicle_reg: v?.reg || '' }))
  }

  const submit = async () => {
    setError('')
    if (!form.customer_name) { setError('Customer name is required'); return }
    if (!form.booking_date) { setError('Date is required'); return }
    if (!form.start_time)   { setError('Start time is required'); return }
    setSaving(true)
    try {
      await onSave(form)
    } catch (err) {
      setError(err.message || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }} style={modalOverlay}>
      <div style={{ ...modalCard, maxWidth: '560px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {mode === 'edit' ? 'Edit booking' : 'New booking'}
          </div>
          <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', color: T.text3, fontSize: '22px', cursor: 'pointer' }}><i className="ti ti-x" /></button>
        </div>

        {error && (
          <div style={{ background: 'rgba(229,57,53,0.1)', border: `1px solid rgba(229,57,53,0.3)`, color: T.red, padding: '10px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        {/* Customer */}
        <div style={{ marginBottom: '12px', position: 'relative' }}>
          <div style={fieldLbl}>Customer *</div>
          <input
            value={custQuery}
            onChange={e => { setCustQuery(e.target.value); setShowCustList(true); setForm(f => ({ ...f, customer_id: '', customer_name: e.target.value })) }}
            onFocus={() => setShowCustList(true)}
            onBlur={() => setTimeout(() => setShowCustList(false), 150)}
            placeholder="Type to search or enter a new name"
            style={inputStyle}
          />
          {showCustList && filteredCustomers.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px',
              background: T.surface2, border: `1px solid ${T.border2}`, borderRadius: '8px',
              maxHeight: '180px', overflowY: 'auto',
            }}>
              {filteredCustomers.map(c => (
                <div key={c.id} onMouseDown={() => pickCustomer(c)} style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
                  borderBottom: `0.5px solid ${T.border}`,
                }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface3}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: '10px', color: T.text3, fontFamily: 'monospace', marginTop: '2px' }}>
                    {c.phone || c.email || ''} {c.reg ? `· ${c.reg}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Vehicle */}
        <div style={{ marginBottom: '12px' }}>
          <div style={fieldLbl}>Vehicle</div>
          {customerVehicles.length > 0 ? (
            <select value={form.vehicle_id || ''} onChange={e => pickVehicle(e.target.value)} style={inputStyle}>
              <option value="">— No vehicle —</option>
              {customerVehicles.map(v => (
                <option key={v.id} value={v.id}>{v.reg} {v.make ? `· ${v.make}` : ''} {v.model || ''}</option>
              ))}
            </select>
          ) : (
            <input
              value={form.vehicle_reg}
              onChange={e => setForm(f => ({ ...f, vehicle_reg: e.target.value.toUpperCase() }))}
              placeholder="Vehicle reg (e.g. MK21 ABC)"
              style={{ ...inputStyle, textTransform: 'uppercase' }}
            />
          )}
        </div>

        {/* Date / Time / Duration */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>Date *</div>
            <input type="date" value={form.booking_date} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={fieldLbl}>Time *</div>
            <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <div style={fieldLbl}>Duration (min)</div>
            <input type="number" min="5" step="5" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} style={inputStyle} />
          </div>
        </div>

        {/* Job type + Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <div style={fieldLbl}>Job type</div>
            {services.length > 0 ? (
              <select
                value={form.job_type}
                onChange={e => {
                  const name = e.target.value
                  // Find the matching service and pull its default duration
                  const svc = services.find(s => s.name === name)
                  setForm(f => ({
                    ...f,
                    job_type: name,
                    duration_min: svc?.default_duration_min ?? f.duration_min,
                    description: f.description || svc?.default_description || '',
                  }))
                }}
                style={inputStyle}
              >
                <option value="">— Select —</option>
                {services.map(s => (
                  <option key={s.id} value={s.name}>
                    {s.name}{s.default_duration_min ? ` (${s.default_duration_min} min)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <select value={form.job_type} onChange={e => setForm(f => ({ ...f, job_type: e.target.value }))} style={inputStyle}>
                <option value="">— Select —</option>
                {JOB_TYPE_FALLBACK.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            )}
            {services.length === 0 && (
              <div style={{ fontSize: '10px', color: T.text3, marginTop: '4px' }}>
                Add services in <strong>Items → Services</strong> to customise this list.
              </div>
            )}
          </div>
          <div>
            <div style={fieldLbl}>Status</div>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Description */}
        <div style={{ marginBottom: '12px' }}>
          <div style={fieldLbl}>Description</div>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What's the job?" style={inputStyle} />
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '18px' }}>
          <div style={fieldLbl}>Notes (private)</div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything else..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        {/* Actions */}
        <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onClose} disabled={saving} style={ghostBtn}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving...' : (mode === 'edit' ? 'Save changes' : 'Create booking')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// SMALL BITS
// ============================================================
function Field({ label, value }) {
  return (
    <div>
      <div style={fieldLbl}>{label}</div>
      <div style={{ fontSize: '13px' }}>{value}</div>
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
const ghostBtn = {
  background: T.surface3, color: T.text, border: `1px solid ${T.border2}`,
  padding: '10px 16px', borderRadius: '10px',
  fontFamily: 'inherit', fontWeight: 500, fontSize: '12px',
  cursor: 'pointer',
}
const dangerBtn = {
  background: 'rgba(229,57,53,0.1)', color: T.red, border: `1px solid rgba(229,57,53,0.25)`,
  padding: '10px 14px', borderRadius: '10px',
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
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 600, padding: '16px',
}
const modalCard = {
  background: T.surface, border: `1px solid ${T.border}`,
  borderRadius: '16px', padding: '24px',
  width: '100%', maxHeight: '90vh', overflowY: 'auto',
  fontFamily: "'Space Grotesk', sans-serif", color: T.text,
}
const inputStyle = {
  width: '100%',
  background: T.surface2,
  border: `1px solid ${T.border2}`,
  borderRadius: '8px',
  padding: '9px 12px',
  color: T.text,
  fontSize: '13px',
  fontFamily: 'inherit',
  outline: 'none',
}
const fieldLbl = {
  fontSize: '10px', color: T.text3, fontFamily: 'monospace',
  letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '4px',
  fontWeight: 500,
}
