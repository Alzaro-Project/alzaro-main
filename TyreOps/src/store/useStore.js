import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import * as db from '../lib/db'

// ============================================================
// CONSTANTS
// ============================================================
const TIER_ORDER = ['basic', 'bronze', 'silver', 'gold']
const TIER_PRICE = { basic: 40, bronze: 60, silver: 75, gold: 90 }

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
      garageId: null,
      garageStatus: null,
      trialEnds: null,
      welcomeBannerDismissed: false,  // Onboarding banner dismissal flag

      // --------------------------------------------------------
      // DATA STATE
      // --------------------------------------------------------
      settings: {
        name: '', addr: '', city: '',
        post: '', phone: '', email: '',
        vatScheme: 'standard', vatNumber: '', flatRate: 8.5,
      },
      customers: [],
      invoices: [],
      skus: [],
      batches: [],
      usedTyres: [],

      // --------------------------------------------------------
      // DASHBOARD
      // --------------------------------------------------------
      dashPeriod: 'month',
      dashWidgets: ['revenue', 'cogs', 'profit', 'stockval', 'plchart', 'brandchart', 'toptyres', 'alerts'],

      // --------------------------------------------------------
      // AUTH ACTIONS
      // --------------------------------------------------------
      login: async (email) => {
        // Clear any stale data from previous sessions before loading fresh data
        set({
          user: { name: email, email },
          customers: [],
          invoices: [],
          skus: [],
          batches: [],
          usedTyres: [],
        })

        await get().loadData(email)
      },

      // Load all garage data from Supabase. Called on login AND on app
      // start (page refresh), so data isn't lost when the page reloads.
      loadData: async (email) => {
        try {
          const data = await db.loadAllGarageData(email)

          // MULTI-PRODUCT — loadAllGarageData fetches this email's TyreOps
          // garage specifically. Null means no TyreOps membership yet; the
          // login page offers the "start your TyreOps trial" flow.
          if (!data) {
            showToast('No TyreOps account on this login yet — sign in again to set one up.')
            await get().logout()
            return
          }

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
                // Email / SMTP settings
                smtpHost: data.garage.smtp_host || '',
                smtpPort: data.garage.smtp_port || 587,
                smtpSecure: data.garage.smtp_secure || false,
                smtpUser: data.garage.smtp_user || '',
                smtpPass: data.garage.smtp_pass || '',
                emailFromName: data.garage.email_from_name || '',
                emailReplyTo: data.garage.email_reply_to || '',
                emailFooter: data.garage.email_footer || '',
                logoUrl: data.garage.logo_url || '',
                noteTemplates: data.garage.note_templates || null,
              },
              user: { name: data.garage.name, email },
            }

            set({
              ...baseState,
              skus: data.skus,
              batches: data.batches,
              usedTyres: data.usedTyres,
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
          garageId: null,
          garageStatus: null,
          trialEnds: null,
          skus: [],
          batches: [],
          usedTyres: [],
          invoices: [],
          customers: [],
        })
        window.location.href = '/tyreops/login'
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
            // Email / SMTP settings
            if (updates.smtpHost !== undefined) dbUpdates.smtp_host = updates.smtpHost
            if (updates.smtpPort !== undefined) dbUpdates.smtp_port = updates.smtpPort
            if (updates.smtpSecure !== undefined) dbUpdates.smtp_secure = updates.smtpSecure
            if (updates.smtpUser !== undefined) dbUpdates.smtp_user = updates.smtpUser
            if (updates.smtpPass !== undefined) dbUpdates.smtp_pass = updates.smtpPass
            if (updates.emailFromName !== undefined) dbUpdates.email_from_name = updates.emailFromName
            if (updates.emailReplyTo !== undefined) dbUpdates.email_reply_to = updates.emailReplyTo
            if (updates.emailFooter !== undefined) dbUpdates.email_footer = updates.emailFooter
            if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl
            if (updates.noteTemplates !== undefined) dbUpdates.note_templates = updates.noteTemplates

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
            // Roll back the optimistic row so the UI matches reality
            set(s => ({ skus: s.skus.filter(sk => sk.id !== tempId) }))
            showToast('Failed to save tyre — it was not added. ' + (err?.message || ''))
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

            let skuId = tempId
            if (garageId) {
              const saved = await db.insertSKU(garageId, normalizedSku)
              skuId = saved.id
              set(s => ({
                skus: s.skus.map(sk => sk.id === tempId ? { ...sk, id: saved.id } : sk)
              }))
            }

            // If a quantity was provided, create an opening stock batch so the
            // imported tyre actually shows stock (not just a definition).
            const importQty = parseInt(sku.qty) || 0
            if (importQty > 0) {
              const importCost = parseFloat(sku.cost) || 0
              await get().addBatch({
                id: 'B' + Date.now() + Math.floor(Math.random() * 1000),
                skuId,
                date: new Date().toISOString().split('T')[0],
                qty: importQty,
                cost: importCost,
                remaining: importQty,
                supplier: 'CSV import',
                ref: '',
                notes: 'Opening stock from CSV import',
              })
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

      deleteBatch: async (id) => {
        const batch = get().batches.find(b => b.id === id)
        set(s => ({ batches: s.batches.filter(b => b.id !== id) }))

        const garageId = get().garageId
        if (garageId && !String(id).startsWith('temp-')) {
          try {
            await db.deleteBatch(id)
            // Best-effort cleanup of the attached invoice file
            if (batch?.invoiceUrl) await db.deletePurchaseInvoice(batch.invoiceUrl)
          } catch (err) {
            console.error('Failed to delete batch:', err)
            showToast('Failed to delete stock batch.')
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
            await db.updateInvoice(garageId, id, updates)
          } catch (err) {
            console.error('Failed to update invoice:', err)
            showToast('Failed to update invoice.')
          }
        }
      },

      deleteInvoice: async (id) => {
        set(s => ({ invoices: s.invoices.filter(i => i.id !== id) }))

        const garageId = get().garageId
        if (garageId) {
          try {
            await db.deleteInvoice(garageId, id)
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
      // DASHBOARD
      // --------------------------------------------------------
      setDashPeriod: (period) => set({ dashPeriod: period }),
      setDashWidgets: (widgets) => set({ dashWidgets: widgets }),
      dismissWelcomeBanner: () => set({ welcomeBannerDismissed: true }),

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

    }),
    {
      name: 'garageiq-store',
      // Only persist certain fields to localStorage
      partialize: (state) => ({
        user: state.user,
        tier: state.tier,
        garageId: state.garageId,
        settings: state.settings,
        dashPeriod: state.dashPeriod,
        dashWidgets: state.dashWidgets,
        welcomeBannerDismissed: state.welcomeBannerDismissed,
        // Don't persist data — it comes from Supabase on login
      }),
    }
  )
)

export { TIER_ORDER, TIER_PRICE }
