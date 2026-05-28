import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// useBookings — a self-contained data hook for the Calendar
// ------------------------------------------------------------
// Why this is its own file (not part of useStore):
//   - Bookings have specific fetch patterns (date ranges, refresh)
//   - Keeps useStore lean — no need to touch it
//   - Easy to extend later (Step 2 will add create/update/delete here)
//
// What it returns:
//   { bookings, loading, error, refresh, slotSettings }
//
//   - bookings:     array of booking rows for this garage
//   - loading:      true while initial fetch is in flight
//   - error:        any error message from Supabase
//   - refresh():    re-fetch (call after mutations)
//   - slotSettings: { slotMinutes, dayStart, dayEnd } pulled from the garage row
// ============================================================

export function useBookings() {
  const garageId = useStore(s => s.garageId)
  const [bookings, setBookings] = useState([])
  const [slotSettings, setSlotSettings] = useState({
    slotMinutes: 30,
    dayStart: '08:00',
    dayEnd: '18:00',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!garageId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      // Bookings + garage settings in parallel
      const [bRes, gRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*')
          .eq('garage_id', garageId)
          .order('booking_date', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('garages')
          .select('booking_slot_minutes, booking_day_start, booking_day_end')
          .eq('id', garageId)
          .single(),
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

  return {
    bookings,
    slotSettings,
    loading,
    error,
    refresh: fetchAll,
  }
}
