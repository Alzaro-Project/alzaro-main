import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// useDayNotes
// ------------------------------------------------------------
// Quick per-day notes, one row per (garage, date). Mirrors the
// useBookings pattern: talks to Supabase directly, filters by
// garageId, keeps a local map in state.
//
// Returns:
//   notesByDate  — { 'YYYY-MM-DD': bodyString }
//   loading, error, refresh
//   getNote(dateStr)            -> string
//   saveNote(dateStr, body)     -> upserts (deletes row if body empty)
// ============================================================

export function useDayNotes() {
  const garageId = useStore(s => s.garageId)
  const [notesByDate, setNotesByDate] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!garageId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('day_notes')
        .select('note_date, body')
        .eq('garage_id', garageId)
      if (e) throw e
      const map = {}
      ;(data || []).forEach(r => { map[r.note_date] = r.body })
      setNotesByDate(map)
    } catch (err) {
      console.error('useDayNotes:', err)
      setError(err.message || 'Failed to load notes')
    }
    setLoading(false)
  }, [garageId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const getNote = useCallback((dateStr) => notesByDate[dateStr] || '', [notesByDate])

  // Upsert a note. Empty body deletes the row to keep the table tidy.
  const saveNote = useCallback(async (dateStr, body) => {
    if (!garageId) throw new Error('No garage')
    const trimmed = (body || '').trim()

    // Optimistic local update
    setNotesByDate(prev => {
      const next = { ...prev }
      if (trimmed) next[dateStr] = trimmed
      else delete next[dateStr]
      return next
    })

    try {
      if (!trimmed) {
        const { error: e } = await supabase
          .from('day_notes')
          .delete()
          .eq('garage_id', garageId)
          .eq('note_date', dateStr)
        if (e) throw e
        return
      }
      const { error: e } = await supabase
        .from('day_notes')
        .upsert(
          { garage_id: garageId, note_date: dateStr, body: trimmed, updated_at: new Date().toISOString() },
          { onConflict: 'garage_id,note_date' }
        )
      if (e) throw e
    } catch (err) {
      console.error('useDayNotes.saveNote:', err)
      setError(err.message || 'Failed to save note')
      // Re-sync from server so local state doesn't lie
      fetchAll()
      throw err
    }
  }, [garageId, fetchAll])

  return { notesByDate, loading, error, refresh: fetchAll, getNote, saveNote }
}
