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

// How the purchase was paid — stored in purchases.payment_method.
// `short` is the compact label used for list badges.
export const PAYMENT_METHODS = [
  { value: 'business_bank_account', label: 'Business Bank Account', short: 'Bank' },
  { value: 'business_debit_card',   label: 'Business Debit Card',   short: 'Debit card' },
  { value: 'business_credit_card',  label: 'Business Credit Card',  short: 'Credit card' },
  { value: 'cash',                  label: 'Cash',                  short: 'Cash' },
  { value: 'direct_debit',          label: 'Direct Debit',          short: 'Direct debit' },
  { value: 'other',                 label: 'Other',                 short: 'Other' },
]

// ============================================================
// Receipt storage ('receipts' private bucket)
// ------------------------------------------------------------
// purchases.receipt_url stores the storage PATH (not a URL) —
// the bucket is private, so viewing goes via a signed URL.
// Paths are `${garageId}/...` to satisfy the bucket's RLS.
// ============================================================
export const RECEIPTS_BUCKET = 'receipts'

export function safeFileName(name) {
  const cleaned = (name || 'receipt').replace(/[^a-zA-Z0-9._-]+/g, '_')
  // keep the tail so the extension survives on very long names
  return cleaned.length > 80 ? cleaned.slice(-80) : cleaned
}

export async function uploadReceipt(garageId, file) {
  const path = `${garageId}/${Date.now()}_${safeFileName(file.name)}`
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw new Error(error.message || 'Receipt upload failed')
  return path
}

export async function removeReceiptObject(path) {
  if (!path) return
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([path])
  if (error) throw new Error(error.message || 'Could not delete receipt file')
}

export async function getReceiptSignedUrl(path, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Could not open receipt')
  return data.signedUrl
}

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
        supabase.from('purchases').select('*').eq('account_id', garageId)
          .order('purchase_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('product_settings')
          .select('default_markup_pct')
          .eq('account_id', garageId).maybeSingle(),
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
      .from('purchases').insert(payload).select().maybeSingle()

    if (insErr) {
      console.error('createPurchase insert error:', insErr)
      throw new Error(insErr.message || insErr.details || insErr.hint || 'Could not save purchase')
    }

    // If RLS allows the insert but blocks the select-back, `inserted` is null.
    // The row still saved — refetch so it appears, rather than looking failed.
    if (!inserted) {
      await fetchAll()
      return null
    }

    setPurchases(prev => [inserted, ...prev].sort(byDateDesc))
    return inserted
  }, [garageId, fetchAll])

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
    const row = purchases.find(p => p.id === id)
    const { error: delErr } = await supabase.from('purchases').delete().eq('id', id)
    if (delErr) throw delErr
    setPurchases(prev => prev.filter(p => p.id !== id))
    // Best-effort receipt cleanup — the row is already gone, so a failed
    // storage delete only leaves an orphaned file, never a broken purchase.
    if (row?.receipt_url) {
      try { await removeReceiptObject(row.receipt_url) }
      catch (err) { console.error('deletePurchase: receipt cleanup failed:', err) }
    }
  }, [purchases])

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
    account_id: garageId,
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
    payment_method: data.payment_method || null,
    customer_id: isUuid(data.customer_id) ? data.customer_id : null,
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

function isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

function round2(n) {
  return Math.round(n * 100) / 100
}

function byDateDesc(a, b) {
  if (a.purchase_date !== b.purchase_date) return b.purchase_date.localeCompare(a.purchase_date)
  return (b.created_at || '').localeCompare(a.created_at || '')
}
