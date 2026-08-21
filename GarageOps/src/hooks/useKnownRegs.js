import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { supabase } from '../lib/supabase'

// ============================================================
// useKnownRegs — every car reg the garage knows about, deduped.
// Union of: the vehicles table, customer vehicle chips (incl.
// the legacy single reg field) and purchase regs (fetched once
// from Supabase). Feeds the reg comboboxes so typing a reg
// offers known vehicles while still allowing free text.
// ============================================================
export function useKnownRegs() {
  const customers = useStore(s => s.customers)
  const vehicles = useStore(s => s.vehicles)
  const garageId = useStore(s => s.garageId)
  const [purchaseRegs, setPurchaseRegs] = useState([])

  useEffect(() => {
    if (!garageId) return
    let cancelled = false
    supabase
      .from('purchases')
      .select('vehicle_reg')
      .eq('account_id', garageId)
      .not('vehicle_reg', 'is', null)
      .order('purchase_date', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error('useKnownRegs:', error); return }
        if (!cancelled) setPurchaseRegs((data || []).map(r => r.vehicle_reg).filter(Boolean))
      })
    return () => { cancelled = true }
  }, [garageId])

  return useMemo(() => {
    const seen = new Set()
    const out = []
    const add = (reg) => {
      const key = (reg || '').replace(/\s+/g, '').toUpperCase()
      if (!key || seen.has(key)) return
      seen.add(key)
      out.push((reg || '').toUpperCase().trim())
    }
    vehicles.forEach(v => add(v.reg))
    customers.forEach(c => {
      if (c.reg) add(c.reg)
      ;(c.vehicles || []).forEach(v => add(v.reg))
    })
    purchaseRegs.forEach(add)
    return out
  }, [customers, vehicles, purchaseRegs])
}
