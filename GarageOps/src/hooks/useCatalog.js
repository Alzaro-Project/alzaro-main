import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// useCatalog — shared hook for the Items page catalog tables
// ------------------------------------------------------------
// Works for: 'parts', 'labour_rates', 'consumables'
// Mirrors the useServices pattern: rows, create, update,
// archive/restore, hard delete. All rows for the garage are
// loaded; filter archived in the component.
//
// For labour_rates there's an extra setDefault(id) that makes
// one rate the default and clears the flag on the others.
// ============================================================

export function useCatalog(table) {
  const garageId = useStore(s => s.garageId)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!garageId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from(table)
        .select('*')
        .eq('account_id', garageId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (err) throw err
      setRows(data || [])
    } catch (err) {
      console.error(`useCatalog(${table}):`, err)
      setError(err.message || 'Failed to load')
    }
    setLoading(false)
  }, [garageId, table])

  useEffect(() => { fetchAll() }, [fetchAll])

  const create = useCallback(async (data) => {
    if (!garageId) throw new Error('No garage')
    const payload = { ...cleanNumbers(data), account_id: garageId }
    if (!payload.name?.trim()) throw new Error('Name is required')
    payload.name = payload.name.trim()
    const { data: inserted, error: err } = await supabase
      .from(table).insert(payload).select().single()
    if (err) throw err
    setRows(prev => [...prev, inserted].sort(byOrder))
    return inserted
  }, [garageId, table])

  const update = useCallback(async (id, updates) => {
    const patch = cleanNumbers(updates)
    const { data: updated, error: err } = await supabase
      .from(table).update(patch).eq('id', id).select().single()
    if (err) throw err
    setRows(prev => prev.map(r => r.id === id ? updated : r).sort(byOrder))
    return updated
  }, [table])

  const archive = useCallback((id) => update(id, { archived: true }), [update])
  const restore = useCallback((id) => update(id, { archived: false }), [update])

  const remove = useCallback(async (id) => {
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) throw err
    setRows(prev => prev.filter(r => r.id !== id))
  }, [table])

  // Labour only: make one rate the default, clear the rest
  const setDefault = useCallback(async (id) => {
    if (!garageId) throw new Error('No garage')
    const { error: clearErr } = await supabase
      .from(table).update({ is_default: false }).eq('account_id', garageId)
    if (clearErr) throw clearErr
    const { error: setErr } = await supabase
      .from(table).update({ is_default: true }).eq('id', id)
    if (setErr) throw setErr
    setRows(prev => prev.map(r => ({ ...r, is_default: r.id === id })))
  }, [garageId, table])

  return { rows, loading, error, refresh: fetchAll, create, update, archive, restore, remove, setDefault }
}

// Convert money/number-ish fields from form strings to numbers (or null)
function cleanNumbers(obj) {
  const out = { ...obj }
  for (const key of ['cost', 'sell', 'hourly_rate', 'price']) {
    if (key in out) {
      out[key] = out[key] === '' || out[key] == null ? null : (parseFloat(out[key]) || 0)
    }
  }
  if ('sort_order' in out) out.sort_order = parseInt(out.sort_order, 10) || 100
  return out
}

function byOrder(a, b) {
  if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0)
  return (a.name || '').localeCompare(b.name || '')
}
