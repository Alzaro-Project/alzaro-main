import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getTenantByUserId, checkIsAdmin } from '../lib/db'
import { PRODUCT, TIER_ORDER } from '../config/product'

export { TIER_ORDER }

export const useStore = create((set, get) => ({
  // Auth / session ---------------------------------------------------
  user: null,          // { id, email, name }
  isAdmin: false,
  tenantId: null,      // row id in the garages table
  tier: TIER_ORDER[0],
  status: null,        // active | trial | suspended
  settings: {},        // tenant profile (name, addr, phone…)
  ready: false,        // has the initial session check completed?

  // Product-specific data (filled by pages as needed) ---------------
  customers: [],
  invoices: [],
  jobs: [],

  /* Restore a session on app load (and on auth state changes). */
  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await get().hydrateUser(session.user)
    }
    set({ ready: true })

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        get().hydrateUser(session.user)
      } else {
        set({ user: null, isAdmin: false, tenantId: null, status: null, settings: {} })
      }
    })
  },

  /* Pull tenant + admin info for a logged-in auth user. */
  hydrateUser: async (authUser) => {
    const email = authUser.email
    const isAdmin = await checkIsAdmin(email)

    if (isAdmin) {
      set({
        user: { id: authUser.id, email, name: 'Administrator' },
        isAdmin: true,
        tenantId: null,
      })
      return
    }

    const tenant = await getTenantByUserId(authUser.id)
    set({
      user: { id: authUser.id, email, name: tenant?.name || email },
      isAdmin: false,
      tenantId: tenant?.id || null,
      tier: tenant?.tier || TIER_ORDER[0],
      status: tenant?.status || 'trial',
      settings: {
        name: tenant?.name || '',
        addr: tenant?.address || '',
        phone: tenant?.phone || '',
        email,
      },
    })
  },

  /* Called by Login after a successful supabase sign-in. */
  login: async (authUser) => {
    await get().hydrateUser(authUser)
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({
      user: null, isAdmin: false, tenantId: null,
      tier: TIER_ORDER[0], status: null, settings: {},
      customers: [], invoices: [], jobs: [],
    })
  },
}))
