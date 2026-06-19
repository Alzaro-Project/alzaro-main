import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// useBookings — Step 2: full CRUD
// ------------------------------------------------------------
// Returns:
//   bookings, slotSettings, loading, error, refresh,
//   createBooking, updateBooking, deleteBooking
// ============================================================

export function useBookings() {
  const garageId = useStore(s => s.garageId)
  const [bookings, setBookings] = useState([])
  const [slotSettings, setSlotSettings] = useState({
    slotMinutes: 30, dayStart: '08:00', dayEnd: '18:00',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!garageId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [bRes, gRes] = await Promise.all([
        supabase.from('bookings').select('*').eq('account_id', garageId)
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase.from('product_settings')
          .select('booking_slot_minutes, booking_day_start, booking_day_end')
          .eq('account_id', garageId).maybeSingle(),
      ])
      if (bRes.error) throw bRes.error
      if (gRes.error) throw gRes.error
      setBookings(bRes.data || [])
      setSlotSettings({
        slotMinutes: gRes.data?.booking_slot_minutes || 30,
        dayStart: (gRes.data?.booking_day_start || '08:00:00').slice(0, 5),
        dayEnd: (gRes.data?.booking_day_end || '18:00:00').slice(0, 5),
      })
    } catch (err) {
      console.error('useBookings:', err)
      setError(err.message || 'Failed to load bookings')
    }
    setLoading(false)
  }, [garageId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ------- CREATE -------
  const createBooking = useCallback(async (data) => {
    if (!garageId) throw new Error('No garage')
    const payload = {
      account_id: garageId,
      customer_id: data.customer_id || null,
      vehicle_id: data.vehicle_id || null,
      customer_name: data.customer_name || null,
      vehicle_reg: data.vehicle_reg || null,
      booking_date: data.booking_date,
      start_time: ensureSeconds(data.start_time),
      duration_min: parseInt(data.duration_min, 10) || 60,
      job_type: data.job_type || null,
      description: data.description || null,
      notes: data.notes || null,
      status: data.status || 'booked',
    }
    const { data: inserted, error: insErr } = await supabase
      .from('bookings').insert(payload).select().single()
    if (insErr) throw insErr
    setBookings(prev => [...prev, inserted].sort(byDateThenTime))
    return inserted
  }, [garageId])

  // ------- UPDATE -------
  const updateBooking = useCallback(async (id, updates) => {
    // Whitelist editable columns only — never forward id/account_id/
    // created_at/updated_at from the original row, or Postgres rejects
    // the update (this was why "Save changes" silently failed on edit).
    const patch = {
      customer_id: updates.customer_id || null,
      vehicle_id: updates.vehicle_id || null,
      customer_name: updates.customer_name || null,
      vehicle_reg: updates.vehicle_reg || null,
      booking_date: updates.booking_date,
      start_time: ensureSeconds(updates.start_time),
      duration_min: parseInt(updates.duration_min, 10) || 60,
      job_type: updates.job_type || null,
      description: updates.description || null,
      notes: updates.notes || null,
      status: updates.status || 'booked',
    }
    const { data: updated, error: updErr } = await supabase
      .from('bookings').update(patch).eq('id', id).select().single()
    if (updErr) throw updErr
    setBookings(prev => prev.map(b => b.id === id ? updated : b).sort(byDateThenTime))
    return updated
  }, [])

  // ------- DELETE -------
  const deleteBooking = useCallback(async (id) => {
    const { error: delErr } = await supabase.from('bookings').delete().eq('id', id)
    if (delErr) throw delErr
    setBookings(prev => prev.filter(b => b.id !== id))
  }, [])

  return {
    bookings, slotSettings, loading, error,
    refresh: fetchAll,
    createBooking, updateBooking, deleteBooking,
  }
}

// "09:00" -> "09:00:00"   (Supabase TIME column expects seconds)
function ensureSeconds(t) {
  if (!t) return t
  const s = String(t)
  return s.length === 5 ? `${s}:00` : s
}

function byDateThenTime(a, b) {
  if (a.booking_date !== b.booking_date) return a.booking_date.localeCompare(b.booking_date)
  return (a.start_time || '').localeCompare(b.start_time || '')
}
