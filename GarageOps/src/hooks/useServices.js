import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// useServices — services catalog hook
// ------------------------------------------------------------
// Returns:
//   services         — active (non-archived) services, sorted
//   allServices      — including archived
//   loading, error, refresh
//   createService, updateService, archiveService, deleteService
// ============================================================

export function useServices({ includeArchived = false } = {}) {
  const garageId = useStore(s => s.garageId)
  const [allServices, setAllServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!garageId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('services')
        .select('*')
        .eq('garage_id', garageId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
      if (err) throw err
      setAllServices(data || [])
    } catch (err) {
      console.error('useServices:', err)
      setError(err.message || 'Failed to load services')
    }
    setLoading(false)
  }, [garageId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // CREATE
  const createService = useCallback(async (data) => {
    if (!garageId) throw new Error('No garage')
    const payload = {
      garage_id: garageId,
      name: data.name?.trim(),
      default_duration_min: parseInt(data.default_duration_min, 10) || 60,
      default_price: data.default_price === '' || data.default_price == null
        ? null : parseFloat(data.default_price),
      default_description: data.default_description?.trim() || null,
      sort_order: data.sort_order ?? 100,
    }
    if (!payload.name) throw new Error('Service name is required')
    const { data: inserted, error: err } = await supabase
      .from('services').insert(payload).select().single()
    if (err) throw err
    setAllServices(prev => [...prev, inserted].sort(byOrder))
    return inserted
  }, [garageId])

  // UPDATE
  const updateService = useCallback(async (id, updates) => {
    const patch = { ...updates }
    if (patch.default_duration_min != null) patch.default_duration_min = parseInt(patch.default_duration_min, 10) || 60
    if (patch.default_price === '') patch.default_price = null
    else if (patch.default_price != null) patch.default_price = parseFloat(patch.default_price)
    const { data: updated, error: err } = await supabase
      .from('services').update(patch).eq('id', id).select().single()
    if (err) throw err
    setAllServices(prev => prev.map(s => s.id === id ? updated : s).sort(byOrder))
    return updated
  }, [])

  // ARCHIVE (soft-delete)
  const archiveService = useCallback(async (id) => {
    return updateService(id, { archived: true })
  }, [updateService])

  // RESTORE
  const restoreService = useCallback(async (id) => {
    return updateService(id, { archived: false })
  }, [updateService])

  // HARD DELETE (only use if never referenced anywhere)
  const deleteService = useCallback(async (id) => {
    const { error: err } = await supabase.from('services').delete().eq('id', id)
    if (err) throw err
    setAllServices(prev => prev.filter(s => s.id !== id))
  }, [])

  const services = includeArchived ? allServices : allServices.filter(s => !s.archived)

  return {
    services,
    allServices,
    loading, error,
    refresh: fetchAll,
    createService, updateService, archiveService, restoreService, deleteService,
  }
}

function byOrder(a, b) {
  if ((a.sort_order || 0) !== (b.sort_order || 0)) return (a.sort_order || 0) - (b.sort_order || 0)
  return (a.name || '').localeCompare(b.name || '')
}
