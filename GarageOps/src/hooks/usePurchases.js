import { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// usePurchases — purchases CRUD hook
// ------------------------------------------------------------
// Mirrors the useBookings pattern: talks to Supabase directly,
// filters by garageId, keeps a local list in state.
//
// Returns:
//   purchases, defaultMarkupPct, loading, error, refresh,
//   createPurchase, updatePurchase, deletePurchase
// ============================================================

export function usePurchases() {
  const garageId = useStore(s => s.garageId)
  const [purchases, setPurchases] = useState([])
  const [defaultMarkupPct, setDefaultMarkupPct] = useState(40)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!garageId) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const [pRes, gRes] = await Promise.all([
        supabase.from('purchases').select('*').eq('garage_id', garageId)
          .order('purchase_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('garages')
          .select('default_markup_pct')
          .eq('id', garageId).single(),
      ])
      if (pRes.error) throw pRes.error
      if (gRes.error) throw gRes.error
      setPurchases(pRes.data || [])
      setDefaultMarkupPct(Number(gRes.data?.default_markup_pct ?? 40))
    } catch (err) {
      console.error('usePurchases:', err)
      setError(err.message || 'Failed to load purchases')
    }
    setLoading(false)
  }, [garageId])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ------- CREATE -------
  const createPurchase = useCallback(async (data) => {
    if (!garageId) throw new Error('No garage')
    const payload = buildPayload(garageId, data)
    const { data: inserted, error: insErr } = await supabase
      .from('purchases').insert(payload).select().single()
    if (insErr) throw insErr
    setPurchases(prev => [inserted, ...prev].sort(byDateDesc))
    return inserted
  }, [garageId])

  // ------- UPDATE -------
  const updatePurchase = useCallback(async (id, updates) => {
    const patch = { ...updates }
    if (patch.net != null) patch.net = toNum(patch.net)
    if (patch.vat != null) patch.vat = toNum(patch.vat)
    if (patch.gross != null) patch.gross = toNum(patch.gross)
    const { data: updated, error: updErr } = await supabase
      .from('purchases').update(patch).eq('id', id).select().single()
    if (updErr) throw updErr
    setPurchases(prev => prev.map(p => p.id === id ? updated : p).sort(byDateDesc))
    return updated
  }, [])

  // ------- DELETE -------
  const deletePurchase = useCallback(async (id) => {
    const { error: delErr } = await supabase.from('purchases').delete().eq('id', id)
    if (delErr) throw delErr
    setPurchases(prev => prev.filter(p => p.id !== id))
  }, [])

  return {
    purchases, defaultMarkupPct, loading, error,
    refresh: fetchAll,
    createPurchase, updatePurchase, deletePurchase,
  }
}

// ============================================================
// Helpers
// ============================================================
function buildPayload(garageId, data) {
  const net = toNum(data.net)
  const vat = toNum(data.vat)
  return {
    garage_id: garageId,
    supplier: (data.supplier || '').trim(),
    purchase_date: data.purchase_date,
    description: (data.description || '').trim(),
    category: data.category || 'parts',
    supplier_ref: data.supplier_ref?.trim() || null,
    notes: data.notes?.trim() || null,
    net,
    vat,
    gross: round2(net + vat),
    payment_status: data.payment_status || 'paid',
    customer_id: data.customer_id || null,
    customer_name: data.customer_name?.trim() || null,
    vehicle_reg: data.vehicle_reg?.trim().toUpperCase() || null,
    invoice_id: data.invoice_id || null,
    receipt_url: data.receipt_url || null,
  }
}

function toNum(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? round2(n) : 0
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function byDateDesc(a, b) {
  if (a.purchase_date !== b.purchase_date) return b.purchase_date.localeCompare(a.purchase_date)
  return (b.created_at || '').localeCompare(a.created_at || '')
}
