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
// Simple toast system - shows error alerts to user
const showToast = (message, type = 'error') => {
  // Create toast container if it doesn't exist
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

  // Add animation keyframes if not present
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

  // Auto-remove after 4 seconds
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => toast.remove(), 300)
  }, 4000)
}

// ============================================================
// SEED DATA (used only for demo/fallback)
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

      // --------------------------------------------------------
      // DATA STATE
      // --------------------------------------------------------
      settings: {
        name: 'Smith Tyres MK', addr: '14 Tyrewell Road', city: 'Milton Keynes',
        post: 'MK1 1AB', phone: '01908 123456', email: 'info@smithtyres.co.uk',
        vatScheme: 'standard', vatNumber: 'GB123456789', flatRate: 8.5,
      },
      skus: SEED_SKUS,
      batches: SEED_BATCHES,
      usedTyres: SEED_USED,
      invoices: SEED_INVOICES,
      customers: SEED_CUSTOMERS,
      licences: SEED_LICENCES,

      // Dashboard
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
            set({
              skus: data.skus,
              batches: data.batches,
              usedTyres: data.usedTyres,
              customers: data.customers,
              invoices: data.invoices,
              tier: data.garage.tier,
              garageId: data.garage.id,
              garageStatus: data.garage.status,
              trialEnds: data.garage.trial_ends,
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
              user: { name: data.garage.name, email }
            })
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
          skus: SEED_SKUS,
          batches: SEED_BATCHES,
          usedTyres: SEED_USED,
          invoices: SEED_INVOICES,
          customers: SEED_CUSTOMERS,
        })
        // Redirect to login
        window.location.href = '/login'
      },

      // --------------------------------------------------------
      // TIER / SUBSCRIPTION
      // --------------------------------------------------------
      setTier: async (newTier) => {
        const garageId = get().garageId
        const oldTier = get().tier

        // Optimistic update
        set({ tier: newTier })

        if (garageId) {
          try {
            await db.updateGarageTier(garageId, newTier)
            showToast(`Plan changed to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)}`, 'success')
          } catch (err) {
            console.error('Failed to update tier:', err)
            // Rollback on error
            set({ tier: oldTier })
            showToast('Failed to update subscription. Please try again.')
          }
        } else {
          // Demo mode - just show success
          showToast(`Plan changed to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} (demo)`, 'success')
        }
      },

      // --------------------------------------------------------
      // SETTINGS
      // --------------------------------------------------------
      updateSettings: async (updates) => {
        // Optimistic update
        set(s => ({ settings: { ...s.settings, ...updates } }))

        const garageId = get().garageId
        if (garageId) {
          try {
            // Map frontend field names to DB column names
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

      // --------------------------------------------------------
      // SKUS
      // --------------------------------------------------------
      addSKU: async (sku) => {
        const garageId = get().garageId

        // Optimistic update with temp ID
        const tempId = sku.id || `temp-${Date.now()}`
        const optimisticSku = { ...sku, id: tempId }
        set(s => ({ skus: [...s.skus, optimisticSku] }))

        if (garageId) {
          try {
            const saved = await db.insertSKU(garageId, sku)
            // Replace temp ID with real ID from DB
            set(s => ({
              skus: s.skus.map(sk => sk.id === tempId ? { ...sk, id: saved.id } : sk)
            }))
          } catch (err) {
            console.error('Failed to save SKU:', err)
            showToast('Failed to save tyre. It may not persist after refresh.')
          }
        }
      },

      // Bulk import SKUs from CSV
      bulkAddSKUs: async (skusArray) => {
        const garageId = get().garageId
        const results = { success: 0, failed: 0, errors: [] }

        for (const sku of skusArray) {
          try {
            // Validate required fields
            if (!sku.brand || !sku.model || !sku.w || !sku.p || !sku.r) {
              results.failed++
              results.errors.push(`Missing required fields for ${sku.brand || 'unknown'} ${sku.model || ''}`)
              continue
            }

            // Normalize the SKU data
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

            // Check for duplicate
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

            // Add to store
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

        // Show summary toast
        if (results.success > 0) {
          showToast(`Imported ${results.success} SKU${results.success > 1 ? 's' : ''} successfully`, 'success')
        }
        if (results.failed > 0) {
          showToast(`Failed to import ${results.failed} SKU${results.failed > 1 ? 's' : ''}`, 'error')
        }

        return results
      },

      updateSKU: async (id, updates) => {
        // Optimistic update
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
        // Optimistic update - also remove associated batches
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
      // BATCHES
      // --------------------------------------------------------
      addBatch: async (batch) => {
        const garageId = get().garageId

        // Optimistic update with temp ID
        const tempId = batch.id || `temp-${Date.now()}`
        const optimisticBatch = { ...batch, id: tempId }
        set(s => ({ batches: [...s.batches, optimisticBatch] }))

        if (garageId) {
          try {
            const saved = await db.insertBatch(garageId, batch)
            // Replace temp ID with real ID
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
        // Optimistic update
        set(s => ({ batches: s.batches.map(b => b.id === id ? { ...b, ...updates } : b) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            // Map frontend field names to DB column names
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

        // Optimistic update with temp ID
        const tempId = tyre.id || `temp-${Date.now()}`
        const optimisticTyre = { ...tyre, id: tempId }
        set(s => ({ usedTyres: [...s.usedTyres, optimisticTyre] }))

        if (garageId) {
          try {
            const saved = await db.insertUsedTyre(garageId, tyre)
            // Replace temp ID with real ID
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
        // Optimistic update
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
        // Optimistic update
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
      // INVOICES
      // --------------------------------------------------------
      addInvoice: async (inv) => {
        const garageId = get().garageId

        // Optimistic update
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
        // Optimistic update
        set(s => ({ invoices: s.invoices.map(i => i.id === id ? { ...i, ...updates } : i) }))

        const garageId = get().garageId
        if (garageId) {
          try {
            // If only updating status, use the optimized function
            if (Object.keys(updates).length === 1 && updates.status) {
              await db.updateInvoiceStatus(id, updates.status)
            }
            // For other updates, we'd need a more comprehensive update function
            // For now, status updates are the main use case
          } catch (err) {
            console.error('Failed to update invoice:', err)
            showToast('Failed to update invoice status.')
          }
        }
      },

      deleteInvoice: async (id) => {
        // Optimistic update
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
      // CUSTOMERS
      // --------------------------------------------------------
      addCustomer: async (customer) => {
        const garageId = get().garageId

        // Optimistic update with temp ID
        const tempId = customer.id || `temp-${Date.now()}`
        const optimisticCustomer = { ...customer, id: tempId }
        set(s => ({ customers: [...s.customers, optimisticCustomer] }))

        if (garageId) {
          try {
            const saved = await db.insertCustomer(garageId, customer)
            // Replace temp ID with real ID
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
        // Optimistic update
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
        // Optimistic update
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
      // LICENCES (Admin only - local state)
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
      // FIFO HELPERS
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

      // --------------------------------------------------------
      // BATCH DECREMENT (for invoice line items)
      // --------------------------------------------------------
      decrementBatch: async (batchId, qty) => {
        const batch = get().batches.find(b => b.id === batchId)
        if (!batch) return

        const newRemaining = Math.max(0, batch.remaining - qty)

        // Optimistic update
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
    }),
    {
      name: 'garageiq-store',
      // Only persist certain fields to localStorage
      partialize: (state) => ({
        user: state.user,
        tier: state.tier,
        isAdmin: state.isAdmin,
        garageId: state.garageId,
        settings: state.settings,
        dashPeriod: state.dashPeriod,
        dashWidgets: state.dashWidgets,
        // Don't persist data - it comes from Supabase on login
      }),
    }
  )
)

export { TIER_ORDER, TIER_PRICE }