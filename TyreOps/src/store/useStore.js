import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import * as db from '../lib/db'

// ============================================================
// CONSTANTS
// ============================================================
const TIER_ORDER = ['bronze', 'silver', 'gold']
const TIER_PRICE = { bronze: 60, silver: 75, gold: 90 }

// ============================================================
// TOAST NOTIFICATION HELPER
// ============================================================
const showToast = (message, type = 'error') => {
  let container = document.getElementById('garageiq-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'garageiq-toast-container'
    container.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px;
    `
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.style.cssText = `
    padding: 14px 20px; border-radius: 8px; color: white; font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 360px;
    animation: slideIn 0.3s ease;
    background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
  `
  toast.textContent = message

  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style')
    style.id = 'toast-styles'
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `
    document.head.appendChild(style)
  }

  container.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

// ============================================================
// SEED DATA (used only for demo/fallback when not logged into Supabase)
// ============================================================
const SEED_SKUS = [
  { id: 'SK1', brand: 'Michelin', model: 'Pilot Sport 4', w: 225, p: 45, r: 18, sell: 145, alert: 2, season: 'summer' },
  { id: 'SK2', brand: 'Continental', model: 'PremiumContact 6', w: 205, p: 55, r: 16, sell: 99, alert: 3, season: 'summer' },
  { id: 'SK3', brand: 'Pirelli', model: 'Cinturato P7', w: 215, p: 60, r: 16, sell: 89, alert: 2, season: 'summer' },
  { id: 'SK4', brand: 'Bridgestone', model: 'Turanza T005', w: 195, p: 65, r: 15, sell: 72, alert: 2, season: 'allseason' },
]

const SEED_BATCHES = [
  { id: 'B1', skuId: 'SK1', date: '2025-09-10', qty: 10, remaining: 8, cost: 89, supplier: 'Aldridge Tyres Ltd', ref: 'ALD-2025-0112', notes: '' },
  { id: 'B2', skuId: 'SK1', date: '2025-11-15', qty: 10, remaining: 10, cost: 82, supplier: 'Aldridge Tyres Ltd', ref: 'ALD-2025-0198', notes: 'Winter deal' },
  { id: 'B3', skuId: 'SK2', date: '2025-10-01', qty: 15, remaining: 12, cost: 62, supplier: 'National Tyre Wholesale', ref: 'NTW-88421', notes: '' },
  { id: 'B4', skuId: 'SK3', date: '2025-10-20', qty: 6, remaining: 1, cost: 58, supplier: 'National Tyre Wholesale', ref: 'NTW-88562', notes: '' },
  { id: 'B5', skuId: 'SK4', date: '2025-11-01', qty: 8, remaining: 6, cost: 45, supplier: 'Euro Tyre Direct', ref: 'ETD-2025-4421', notes: '' },
]

const SEED_USED = [
  { id: 'U1', brand: 'Michelin', model: 'Pilot Sport 4', w: 225, p: 45, r: 18, tread: 6.2, year: 2022, cost: 0, sell: 45, sourceCust: 'Dave Patel', date: '2025-11-05', notes: 'Good condition', sold: false },
  { id: 'U2', brand: 'Continental', model: 'PremiumContact 6', w: 205, p: 55, r: 16, tread: 4.8, year: 2021, cost: 10, sell: 35, sourceCust: 'Sarah Williams', date: '2025-11-12', notes: 'Even wear', sold: false },
]

const SEED_CUSTOMERS = [
  { id: 'C1', name: 'John Thompson', email: 'john.thompson@email.com', phone: '07700 900123', reg: 'MK21 ABC', vehicle: 'Ford Focus' },
  { id: 'C2', name: 'Sarah Williams', email: 'sarah.w@gmail.com', phone: '07800 111222', reg: 'LK70 XYZ', vehicle: 'VW Golf' },
  { id: 'C3', name: 'Dave Patel', email: 'dpatel@company.co.uk', phone: '07900 333444', reg: 'BD19 PWR', vehicle: 'BMW 3 Series' },
]

const SEED_INVOICES = [
  {
    id: 'INV-001', custId: 'C1', custName: 'John Thompson', custEmail: 'john.thompson@email.com',
    reg: 'MK21 ABC', date: '2025-11-12', due: '2025-11-26', status: 'paid', vatScheme: 'standard',
    lines: [
      { desc: 'Michelin Pilot Sport 4 (225/45R18)', qty: 2, unit: 145, skuId: 'SK1', batchId: 'B1', cost: 89, lineType: 'new' },
      { desc: 'Fitting & balancing', qty: 2, unit: 15, cost: 0, lineType: 'service' },
    ], notes: ''
  },
]

const SEED_LICENCES = [
  { id: 'L1', name: 'Smith Tyres MK', email: 'demo@smithtyres.co.uk', tier: 'gold', status: 'active', since: '2025-06-01' },
  { id: 'L2', name: 'Quick Fit Luton', email: 'owner@quickfitluton.co.uk', tier: 'silver', status: 'active', since: '2025-08-15' },
  { id: 'L3', name: 'Budget Tyres Northampton', email: 'info@budgettyres.co.uk', tier: 'bronze', status: 'active', since: '2025-09-01' },
  { id: 'L4', name: 'Premier Auto Bedford', email: 'premier@bedfordautos.co.uk', tier: 'gold', status: 'active', since: '2025-10-10' },
  { id: 'L5', name: 'FastLane Tyres Coventry', email: 'fastlane@tyres.co.uk', tier: 'silver', status: 'trial', since: '2025-11-01' },
]

// ============================================================
// STORE
// ============================================================
export const useStore = create(
  persist(
    (set, get) => ({
      // --------------------------------------------------------
      // AUTH STATE
      // --------------------------------------------------------
      user: null,
      tier: 'gold',
      isAdmin: false,
      garageId: null,
      garageStatus: null,
      trialEnds: null,
      product: 'tyreops',  // NEW: 'tyreops' | 'garageops' — drives UI and which data to load

      // --------------------------------------------------------
      // SHARED DATA STATE (both products)
      // --------------------------------------------------------
      settings: {
        name: 'Smith Tyres MK', addr: '14 Tyrewell Road', city: 'Milton Keynes',
        post: 'MK1 1AB', phone: '01908 123456', email: 'info@smithtyres.co.uk',
        vatScheme: 'standard', vatNumber: 'GB123456789', flatRate: 8.5,
      },
      customers: SEED_CUSTOMERS,
      invoices: SEED_INVOICES,
      licences: SEED_LICENCES,

      // --------------------------------------------------------
      // TYREOPS DATA STATE
      // --------------------------------------------------------
      skus: SEED_SKUS,
      batches: SEED_BATCHES,
      usedTyres: SEED_USED,

      // --------------------------------------------------------
      // GARAGEOPS DATA STATE (NEW)
      // --------------------------------------------------------
      vehicles: [],
      services: [],
      parts: [],
      partBatches: [],
      labourRates: [],
      jobs: [],
      motReminders: [],

      // --------------------------------------------------------
      // DASHBOARD
      // --------------------------------------------------------
      dashPeriod: 'month',
      dashWidgets: ['revenue', 'cogs', 'profit', 'stockval', 'plchart', 'brandchart', 'toptyres', 'alerts'],

      // --------------------------------------------------------
      // AUTH ACTIONS
      // --------------------------------------------------------
      login: async (email, isAdmin = false) => {
        if (isAdmin) {
          set({ user: { name: 'GarageIQ Admin', email }, isAdmin: true, tier: 'admin' })
          return
        }

        set({ user: { name: email, email }, isAdmin: false })

        try {
          const data = await db.loadAllGarageData(email)
          console.log('Loaded garage data:', data)

          if (data) {
            const baseState = {
              // Shared
              customers: data.customers,
              invoices: data.invoices,
              // Auth / garage metadata
              tier: data.garage.tier,
              garageId: data.garage.id,
              garageStatus: data.garage.status,
              trialEnds: data.garage.trial_ends,
              product: data.product || 'tyreops',
              settings: {
                name: data.garage.name,
                addr: data.garage.addr || '',
                city: data.garage.city || '',
                post: data.garage.post || '',
                phone: data.garage.phone || '',
                email: data.garage.email || '',
                vatScheme: data.garage.vat_scheme || 'standard',
                vatNumber: data.garage.vat_number || '',
                flatRate: data.garage.flat_rate || 8.5,
              },
              user: { name: data.garage.name, email },
            }

            if (data.product === 'garageops') {
              set({
                ...baseState,
                // GarageOps data
                vehicles: data.vehicles || [],
                services: data.services || [],
                parts: data.parts || [],
                partBatches: data.partBatches || [],
                labourRates: data.labourRates || [],
                jobs: data.jobs || [],
                motReminders: data.motReminders || [],
                // Clear TyreOps collections — not relevant
                skus: [],
                batches: [],
                usedTyres: [],
              })
            } else {
              // TyreOps (default)
              set({
                ...baseState,
                skus: data.skus,
                batches: data.batches,
                usedTyres: data.usedTyres,
                // Clear GarageOps collections — not relevant
                vehicles: [],
                services: [],
                parts: [],
                partBatches: [],
                labourRates: [],
                jobs: [],
                motReminders: [],
              })
            }
          }
        } catch (err) {
          console.error('Failed to load garage data:', err)
          showToast('Failed to load garage data. Using offline mode.')
        }
      },

      logout: async () => {
        try {
          await supabase.auth.signOut()
        } catch (err) {
          console.error('Logout error:', err)
        }
        // Clear all state
        set({
          user: null,
          tier: 'gold',
          isAdmin: false,
          garageId: null,
          garageStatus: null,
          trialEnds: null,
          product: 'tyreops',
          // TyreOps data reset to seed
          skus: SEED_SKUS,
          batches: SEED_BATCHES,
          usedTyres: SEED_USED,
          invoices: SEED_INVOICES,
          customers: SEED_CUSTOMERS,
          // GarageOps data cleared
          vehicles: [],
          services: [],
          parts: [],
          partBatches: [],
          labourRates: [],
          jobs: [],
          motReminders: [],
        })
        // Redirect to login — respect whichever product the user was on
        const productPath = get().product === 'garageops' ? '/garageops/login' : '/tyreops/login'
        window.location.href = productPath
      },

      // --------------------------------------------------------
      // TIER / SUBSCRIPTION
      // --------------------------------------------------------
      setTier: async (newTier) => {
        const garageId = get().garageId
        const oldTier = get().tier

        set({ tier: newTier })

        if (garageId) {
          try {
            await db.updateGarageTier(garageId, newTier)
            showToast(`Plan changed to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}`, 'success')
          } catch (err) {
            console.error('Failed to update tier:', err)
            set({ tier: oldTier })
            showToast('Failed to update subscription. Please try again.')
          }
        } else {
          showToast(`Plan changed to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} (demo)`, 'success')
        }
      },

      // --------------------------------------------------------
      // SETTINGS
      // --------------------------------------------------------
      updateSettings: async (updates) => {
        set(s => ({ settings: { ...s.settings, ...updates } }))

        const garageId = get().garageId
        if (garageId) {
          try {
            const dbUpdates = {}
            if (updates.name !== undefined) dbUpdates.name = updates.name
            if (updates.addr !== undefined) dbUpdates.addr = updates.addr
            if (updates.city !== undefined) dbUpdates.city = updates.city
            if (updates.post !== undefined) dbUpdates.post = updates.post
            if (updates.phone !== undefined) dbUpdates.phone = updates.phone
            if (updates.email !== undefined) dbUpdates.email = updates.email
            if (updates.vatScheme !== undefined) dbUpdates.vat_scheme = updates.vatScheme
            if (updates.vatNumber !== undefined) dbUpdates.vat_number = updates.vatNumber
            if (updates.flatRate !== undefined) dbUpdates.flat_rate = updates.flatRate

            await db.updateGarage(garageId, dbUpdates)
          } catch (err) {
            console.error('Failed to save settings:', err)
            showToast('Failed to save settings. Changes may not persist.')
          }
        }
      },

      // ========================================================
      // ====================== TYREOPS =========================
      // ========================================================
      // (Existing TyreOps actions — unchanged in behaviour)

      // --------------------------------------------------------
      // SKUS
      // --------------------------------------------------------
      addSKU: async (sku) => {
        const garageId = get().garageId
        const tempId = sku.id || `temp-${Date.now()}`
        const optimisticSku = { ...sku, id: tempId }
        set(s => ({ skus: [...s.skus, optimisticSku] }))

        if (garageId) {
          try {
            const saved = await db.insertSKU(garageId, sku)
            set(s => ({
              skus: s.skus.map(sk => sk.id === tempId ? { ...sk, id: saved.id } : sk)
            }))
          } catch (err) {
            console.error('Failed to save SKU:', err)
            showToast('Failed to save tyre. It may not persist after refresh.')
          }
        }
      },

      bulkAddSKUs: async (skusArray) => {
        const garageId = get().garageId
        const results = { success: 0, failed: 0, errors: [] }

        for (const sku of skusArray) {
          try {
            if (!sku.brand || !sku.model || !sku.w || !sku.p || !sku.r) {
              results.failed++
              results.errors.push(`Missing required fields for ${sku.brand || 'unknown'} ${sku.model || ''}`)
              continue
            }

            const normalizedSku = {
              brand: String(sku.brand).trim(),
              model: String(sku.model).trim(),
              w: parseInt(sku.w) || 0,
              p: parseInt(sku.p) || 0,
              r: parseInt(sku.r) || 0,
              sell: parseFloat(sku.sell) || 0,
              alert: parseInt(sku.alert) || 2,
              season: ['summer', 'winter', 'allseason'].includes(sku.season?.toLowerCase()) 
                ? sku.season.toLowerCase() 
                : 'allseason',
            }

            const existing = get().skus.find(s => 
              s.brand === normalizedSku.brand && 
              s.model === normalizedSku.model && 
              s.w === normalizedSku.w && 
              s.p === normalizedSku.p && 
              s.r === normalizedSku.r
            )

            if (existing) {
              results.failed++
              results.errors.push(`Duplicate: ${normalizedSku.brand} ${normalizedSku.model} ${normalizedSku.w}/${normalizedSku.p}R${normalizedSku.r}`)
              continue
            }

            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const optimisticSku = { ...normalizedSku, id: tempId }
            set(s => ({ skus: [...s.skus, optimisticSku] }))

            if (garageId) {
              const saved = await db.insertSKU(garageId, normalizedSku)
              set(s => ({
                skus: s.skus.map(sk => sk.id === tempId ? { ...sk, id: saved.id } : sk)
              }))
            }

            results.success++
          } catch (err) {
            results.failed++
            results.errors.push(`Error importing ${sku.brand || 'unknown'}: ${err.message}`)
          }
        }

        if (results.success > 0) {
          showToast(`Imported ${results.success} SKU${results.success > 1 ? 's' : ''} successfully`, 'success')
        }
        if (results.failed > 0) {
          showToast(`Failed to import ${results.failed} SKU${results.failed > 1 ? 's' : ''}`, 'error')
        }

        return results
      },

      updateSKU: async (id, updates) => {
        set(s => ({ skus: s.skus.map(sk => sk.id === id ? { ...sk, ...updates } : sk) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updateSKU(id, updates)
          } catch (err) {
            console.error('Failed to update SKU:', err)
            showToast('Failed to update tyre. Changes may not persist.')
          }
        }
      },

      deleteSKU: async (id) => {
        set(s => ({
          skus: s.skus.filter(sk => sk.id !== id),
          batches: s.batches.filter(b => b.skuId !== id)
        }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteSKU(id)
          } catch (err) {
            console.error('Failed to delete SKU:', err)
            showToast('Failed to delete tyre from database.')
          }
        }
      },

      // --------------------------------------------------------
      // BATCHES (TyreOps)
      // --------------------------------------------------------
      addBatch: async (batch) => {
        const garageId = get().garageId
        const tempId = batch.id || `temp-${Date.now()}`
        const optimisticBatch = { ...batch, id: tempId }
        set(s => ({ batches: [...s.batches, optimisticBatch] }))

        if (garageId) {
          try {
            const saved = await db.insertBatch(garageId, batch)
            set(s => ({
              batches: s.batches.map(b => b.id === tempId ? { ...b, id: saved.id } : b)
            }))
          } catch (err) {
            console.error('Failed to save batch:', err)
            showToast('Failed to save stock batch. It may not persist.')
          }
        }
      },

      updateBatch: async (id, updates) => {
        set(s => ({ batches: s.batches.map(b => b.id === id ? { ...b, ...updates } : b) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            const dbUpdates = { ...updates }
            if (updates.skuId !== undefined) {
              dbUpdates.sku_id = updates.skuId
              delete dbUpdates.skuId
            }
            await db.updateBatch(id, dbUpdates)
          } catch (err) {
            console.error('Failed to update batch:', err)
            showToast('Failed to update stock batch.')
          }
        }
      },

      // --------------------------------------------------------
      // USED TYRES
      // --------------------------------------------------------
      addUsedTyre: async (tyre) => {
        const garageId = get().garageId
        const tempId = tyre.id || `temp-${Date.now()}`
        const optimisticTyre = { ...tyre, id: tempId }
        set(s => ({ usedTyres: [...s.usedTyres, optimisticTyre] }))

        if (garageId) {
          try {
            const saved = await db.insertUsedTyre(garageId, tyre)
            set(s => ({
              usedTyres: s.usedTyres.map(u => u.id === tempId ? { ...u, id: saved.id } : u)
            }))
          } catch (err) {
            console.error('Failed to save used tyre:', err)
            showToast('Failed to save used tyre. It may not persist.')
          }
        }
      },

      updateUsedTyre: async (id, updates) => {
        set(s => ({ usedTyres: s.usedTyres.map(u => u.id === id ? { ...u, ...updates } : u) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updateUsedTyre(id, updates)
          } catch (err) {
            console.error('Failed to update used tyre:', err)
            showToast('Failed to update used tyre.')
          }
        }
      },

      deleteUsedTyre: async (id) => {
        set(s => ({ usedTyres: s.usedTyres.filter(u => u.id !== id) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteUsedTyre(id)
          } catch (err) {
            console.error('Failed to delete used tyre:', err)
            showToast('Failed to delete used tyre from database.')
          }
        }
      },

      // --------------------------------------------------------
      // INVOICES (shared)
      // --------------------------------------------------------
      addInvoice: async (inv) => {
        const garageId = get().garageId
        set(s => ({ invoices: [...s.invoices, inv] }))

        if (garageId) {
          try {
            await db.insertInvoice(garageId, inv)
          } catch (err) {
            console.error('Failed to save invoice:', err)
            showToast('Failed to save invoice. It may not persist.')
          }
        }
      },

      updateInvoice: async (id, updates) => {
        set(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, ...updates } : i) }))

        const garageId = get().garageId
        if (garageId) {
          try {
            if (Object.keys(updates).length === 1 && updates.status) {
              await db.updateInvoiceStatus(id, updates.status)
            }
          } catch (err) {
            console.error('Failed to update invoice:', err)
            showToast('Failed to update invoice status.')
          }
        }
      },

      deleteInvoice: async (id) => {
        set(s => ({ invoices: s.invoices.filter(i => i.id !== id) }))

        const garageId = get().garageId
        if (garageId) {
          try {
            await db.deleteInvoice(id)
          } catch (err) {
            console.error('Failed to delete invoice:', err)
            showToast('Failed to delete invoice from database.')
          }
        }
      },

      // --------------------------------------------------------
      // CUSTOMERS (shared)
      // --------------------------------------------------------
      addCustomer: async (customer) => {
        const garageId = get().garageId
        const tempId = customer.id || `temp-${Date.now()}`
        const optimisticCustomer = { ...customer, id: tempId }
        set(s => ({ customers: [...s.customers, optimisticCustomer] }))

        if (garageId) {
          try {
            const saved = await db.insertCustomer(garageId, customer)
            set(s => ({
              customers: s.customers.map(c => c.id === tempId ? { ...c, id: saved.id } : c)
            }))
          } catch (err) {
            console.error('Failed to save customer:', err)
            showToast('Failed to save customer. They may not persist.')
          }
        }
      },

      updateCustomer: async (id, updates) => {
        set(s => ({ customers: s.customers.map(c => c.id === id ? { ...c, ...updates } : c) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updateCustomer(id, updates)
          } catch (err) {
            console.error('Failed to update customer:', err)
            showToast('Failed to update customer.')
          }
        }
      },

      deleteCustomer: async (id) => {
        set(s => ({ customers: s.customers.filter(c => c.id !== id) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteCustomer(id)
          } catch (err) {
            console.error('Failed to delete customer:', err)
            showToast('Failed to delete customer from database.')
          }
        }
      },

      // --------------------------------------------------------
      // LICENCES (Admin only — local state)
      // --------------------------------------------------------
      addLicence: (l) => set(s => ({ licences: [...s.licences, l] })),
      updateLicence: (id, updates) => set(s => ({ licences: s.licences.map(l => l.id === id ? { ...l, ...updates } : l) })),
      deleteLicence: (id) => set(s => ({ licences: s.licences.filter(l => l.id !== id) })),

      // --------------------------------------------------------
      // DASHBOARD
      // --------------------------------------------------------
      setDashPeriod: (period) => set({ dashPeriod: period }),
      setDashWidgets: (widgets) => set({ dashWidgets: widgets }),

      // --------------------------------------------------------
      // FIFO HELPERS (TyreOps)
      // --------------------------------------------------------
      getFIFOCost: (skuId) => {
        const batches = get().batches
          .filter(b => b.skuId === skuId && b.remaining > 0)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        return batches[0]?.cost || 0
      },

      getTotalStock: (skuId) => {
        return get().batches
          .filter(b => b.skuId === skuId && b.remaining > 0)
          .reduce((a, b) => a + b.remaining, 0)
      },

      getActiveBatches: (skuId) => {
        return get().batches
          .filter(b => b.skuId === skuId && b.remaining > 0)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
      },

      decrementBatch: async (batchId, qty) => {
        const batch = get().batches.find(b => b.id === batchId)
        if (!batch) return

        const newRemaining = Math.max(0, batch.remaining - qty)

        set(s => ({
          batches: s.batches.map(b =>
            b.id === batchId ? { ...b, remaining: newRemaining } : b
          )
        }))

        const garageId = get().garageId
        if (garageId && !String(batchId).startsWith('temp-')) {
          try {
            await db.updateBatch(batchId, { remaining: newRemaining })
          } catch (err) {
            console.error('Failed to update batch remaining:', err)
            showToast('Failed to update stock levels.')
          }
        }
      },

      // ========================================================
      // ====================== GARAGEOPS =======================
      // ========================================================
      // All new actions for GarageOps. Only called when product === 'garageops'.

      // --------------------------------------------------------
      // VEHICLES
      // --------------------------------------------------------
      addVehicle: async (vehicle) => {
        const garageId = get().garageId
        const tempId = vehicle.id || `temp-${Date.now()}`
        const optimisticVehicle = { ...vehicle, id: tempId }
        set(s => ({ vehicles: [...s.vehicles, optimisticVehicle] }))

        if (garageId) {
          try {
            const saved = await db.insertVehicle(garageId, vehicle)
            set(s => ({
              vehicles: s.vehicles.map(v => v.id === tempId ? saved : v)
            }))
            return saved
          } catch (err) {
            console.error('Failed to save vehicle:', err)
            showToast('Failed to save vehicle. It may not persist.')
          }
        }
      },

      updateVehicle: async (id, updates) => {
        set(s => ({ vehicles: s.vehicles.map(v => v.id === id ? { ...v, ...updates } : v) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updateVehicle(id, updates)
          } catch (err) {
            console.error('Failed to update vehicle:', err)
            showToast('Failed to update vehicle.')
          }
        }
      },

      deleteVehicle: async (id) => {
        set(s => ({ vehicles: s.vehicles.filter(v => v.id !== id) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteVehicle(id)
          } catch (err) {
            console.error('Failed to delete vehicle:', err)
            showToast('Failed to delete vehicle from database.')
          }
        }
      },

      // --------------------------------------------------------
      // SERVICES (the service menu)
      // --------------------------------------------------------
      addService: async (service) => {
        const garageId = get().garageId
        const tempId = service.id || `temp-${Date.now()}`
        const optimisticService = { ...service, id: tempId }
        set(s => ({ services: [...s.services, optimisticService] }))

        if (garageId) {
          try {
            const saved = await db.insertService(garageId, service)
            set(s => ({
              services: s.services.map(sv => sv.id === tempId ? saved : sv)
            }))
          } catch (err) {
            console.error('Failed to save service:', err)
            showToast('Failed to save service. It may not persist.')
          }
        }
      },

      updateService: async (id, updates) => {
        set(s => ({ services: s.services.map(sv => sv.id === id ? { ...sv, ...updates } : sv) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updateService(id, updates)
          } catch (err) {
            console.error('Failed to update service:', err)
            showToast('Failed to update service.')
          }
        }
      },

      deleteService: async (id) => {
        set(s => ({ services: s.services.filter(sv => sv.id !== id) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteService(id)
          } catch (err) {
            console.error('Failed to delete service:', err)
            showToast('Failed to delete service.')
          }
        }
      },

      // --------------------------------------------------------
      // PARTS
      // --------------------------------------------------------
      addPart: async (part) => {
        const garageId = get().garageId
        const tempId = part.id || `temp-${Date.now()}`
        const optimisticPart = { ...part, id: tempId }
        set(s => ({ parts: [...s.parts, optimisticPart] }))

        if (garageId) {
          try {
            const saved = await db.insertPart(garageId, part)
            set(s => ({
              parts: s.parts.map(p => p.id === tempId ? saved : p)
            }))
          } catch (err) {
            console.error('Failed to save part:', err)
            showToast('Failed to save part. It may not persist.')
          }
        }
      },

      updatePart: async (id, updates) => {
        set(s => ({ parts: s.parts.map(p => p.id === id ? { ...p, ...updates } : p) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updatePart(id, updates)
          } catch (err) {
            console.error('Failed to update part:', err)
            showToast('Failed to update part.')
          }
        }
      },

      deletePart: async (id) => {
        set(s => ({
          parts: s.parts.filter(p => p.id !== id),
          partBatches: s.partBatches.filter(b => b.partId !== id),
        }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deletePart(id)
          } catch (err) {
            console.error('Failed to delete part:', err)
            showToast('Failed to delete part.')
          }
        }
      },

      // --------------------------------------------------------
      // PART BATCHES
      // --------------------------------------------------------
      addPartBatch: async (batch) => {
        const garageId = get().garageId
        const tempId = batch.id || `temp-${Date.now()}`
        const optimisticBatch = { ...batch, id: tempId, remaining: batch.qty }
        set(s => ({ partBatches: [...s.partBatches, optimisticBatch] }))

        if (garageId) {
          try {
            const saved = await db.insertPartBatch(garageId, batch)
            set(s => ({
              partBatches: s.partBatches.map(b => b.id === tempId ? saved : b)
            }))
          } catch (err) {
            console.error('Failed to save part batch:', err)
            showToast('Failed to save stock batch.')
          }
        }
      },

      updatePartBatch: async (id, updates) => {
        set(s => ({ partBatches: s.partBatches.map(b => b.id === id ? { ...b, ...updates } : b) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updatePartBatch(id, updates)
          } catch (err) {
            console.error('Failed to update part batch:', err)
            showToast('Failed to update stock batch.')
          }
        }
      },

      decrementPartBatch: async (batchId, qty) => {
        const batch = get().partBatches.find(b => b.id === batchId)
        if (!batch) return

        const newRemaining = Math.max(0, batch.remaining - qty)

        set(s => ({
          partBatches: s.partBatches.map(b =>
            b.id === batchId ? { ...b, remaining: newRemaining } : b
          )
        }))

        const garageId = get().garageId
        if (garageId && !String(batchId).startsWith('temp-')) {
          try {
            await db.updatePartBatch(batchId, { remaining: newRemaining })
          } catch (err) {
            console.error('Failed to update part batch remaining:', err)
            showToast('Failed to update stock levels.')
          }
        }
      },

      // --------------------------------------------------------
      // LABOUR RATES
      // --------------------------------------------------------
      addLabourRate: async (rate) => {
        const garageId = get().garageId
        const tempId = rate.id || `temp-${Date.now()}`
        const optimisticRate = { ...rate, id: tempId }
        set(s => ({ labourRates: [...s.labourRates, optimisticRate] }))

        if (garageId) {
          try {
            const saved = await db.insertLabourRate(garageId, rate)
            set(s => ({
              labourRates: s.labourRates.map(r => r.id === tempId ? saved : r)
            }))
          } catch (err) {
            console.error('Failed to save labour rate:', err)
            showToast('Failed to save labour rate.')
          }
        }
      },

      updateLabourRate: async (id, updates) => {
        set(s => ({ labourRates: s.labourRates.map(r => r.id === id ? { ...r, ...updates } : r) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updateLabourRate(id, updates)
          } catch (err) {
            console.error('Failed to update labour rate:', err)
            showToast('Failed to update labour rate.')
          }
        }
      },

      deleteLabourRate: async (id) => {
        set(s => ({ labourRates: s.labourRates.filter(r => r.id !== id) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteLabourRate(id)
          } catch (err) {
            console.error('Failed to delete labour rate:', err)
            showToast('Failed to delete labour rate.')
          }
        }
      },

      getDefaultLabourRate: () => {
        return get().labourRates.find(r => r.isDefault && r.active)
          || get().labourRates.find(r => r.active)
          || null
      },

      // --------------------------------------------------------
      // JOBS
      // --------------------------------------------------------
      addJob: async (job) => {
        const garageId = get().garageId
        set(s => ({ jobs: [...s.jobs, job] }))

        if (garageId) {
          try {
            await db.insertJob(garageId, job)
          } catch (err) {
            console.error('Failed to save job:', err)
            showToast('Failed to save job card. It may not persist.')
          }
        }
      },

      updateJob: async (id, updates) => {
        set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, ...updates } : j) }))

        const garageId = get().garageId
        if (garageId) {
          try {
            // If lines changed, replace them as a batch
            if (updates.lines !== undefined) {
              await db.replaceJobLines(id, garageId, updates.lines)
              // Strip lines from the jobs-table update
              const jobUpdates = { ...updates }
              delete jobUpdates.lines
              if (Object.keys(jobUpdates).length > 0) {
                await db.updateJob(id, jobUpdates)
              }
            } else {
              await db.updateJob(id, updates)
            }
          } catch (err) {
            console.error('Failed to update job:', err)
            showToast('Failed to update job card.')
          }
        }
      },

      updateJobStatus: async (id, status) => {
        set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, status } : j) }))

        const garageId = get().garageId
        if (garageId) {
          try {
            await db.updateJobStatus(id, status)
          } catch (err) {
            console.error('Failed to update job status:', err)
            showToast('Failed to update job status.')
          }
        }
      },

      deleteJob: async (id) => {
        set(s => ({ jobs: s.jobs.filter(j => j.id !== id) }))

        const garageId = get().garageId
        if (garageId) {
          try {
            await db.deleteJob(id)
          } catch (err) {
            console.error('Failed to delete job:', err)
            showToast('Failed to delete job.')
          }
        }
      },

      // --------------------------------------------------------
      // MOT REMINDERS
      // --------------------------------------------------------
      addMotReminder: async (reminder) => {
        const garageId = get().garageId
        const tempId = reminder.id || `temp-${Date.now()}`
        const optimistic = { ...reminder, id: tempId }
        set(s => ({ motReminders: [...s.motReminders, optimistic] }))

        if (garageId) {
          try {
            const saved = await db.insertMotReminder(garageId, reminder)
            set(s => ({
              motReminders: s.motReminders.map(r => r.id === tempId ? saved : r)
            }))
          } catch (err) {
            console.error('Failed to save MOT reminder:', err)
            showToast('Failed to save MOT reminder.')
          }
        }
      },

      updateMotReminder: async (id, updates) => {
        set(s => ({ motReminders: s.motReminders.map(r => r.id === id ? { ...r, ...updates } : r) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.updateMotReminder(id, updates)
          } catch (err) {
            console.error('Failed to update MOT reminder:', err)
            showToast('Failed to update MOT reminder.')
          }
        }
      },

      deleteMotReminder: async (id) => {
        set(s => ({ motReminders: s.motReminders.filter(r => r.id !== id) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteMotReminder(id)
          } catch (err) {
            console.error('Failed to delete MOT reminder:', err)
            showToast('Failed to delete MOT reminder.')
          }
        }
      },

      // --------------------------------------------------------
      // GARAGEOPS FIFO + STOCK HELPERS
      // --------------------------------------------------------
      getPartFIFOCost: (partId) => {
        const batches = get().partBatches
          .filter(b => b.partId === partId && b.remaining > 0)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        return batches[0]?.cost || 0
      },

      getPartTotalStock: (partId) => {
        return get().partBatches
          .filter(b => b.partId === partId && b.remaining > 0)
          .reduce((a, b) => a + b.remaining, 0)
      },

      getPartActiveBatches: (partId) => {
        return get().partBatches
          .filter(b => b.partId === partId && b.remaining > 0)
          .sort((a, b) => new Date(a.date) - new Date(b.date))
      },
    }),
    {
      name: 'garageiq-store',
      // Only persist certain fields to localStorage
      partialize: (state) => ({
        user: state.user,
        tier: state.tier,
        isAdmin: state.isAdmin,
        garageId: state.garageId,
        product: state.product,  // NEW: remember which product on reload
        settings: state.settings,
        dashPeriod: state.dashPeriod,
        dashWidgets: state.dashWidgets,
        // Don't persist data — it comes from Supabase on login
      }),
    }
  )
)

export { TIER_ORDER, TIER_PRICE }
