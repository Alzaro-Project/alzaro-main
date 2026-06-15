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
      const res = await get().hydrateUser(session.user)
      // Valid session but no account for THIS product. Keep the session
      // alive (so the user can start a trial) but leave user null so the
      // router won't show the dashboard.
      if (!res.ok) {
        set({ user: null, isAdmin: false, tenantId: null, status: null, settings: {} })
      }
    }
    set({ ready: true })

    supabase.auth.onAuthStateChange(async (_event, session) => {
     if (session?.user) {
        const res = await get().hydrateUser(session.user)
        if (!res.ok) {
          set({ user: null, isAdmin: false, tenantId: null, status: null, settings: {} })
        }
      } else {
        set({ user: null, isAdmin: false, tenantId: null, status: null, settings: {} })
      }
    })
  },

  /* Pull tenant + admin info for a logged-in auth user.
     Returns { ok, isAdmin }. ok=false means this user has no account
     for THIS product (even if their email/password is valid elsewhere). */
  hydrateUser: async (authUser) => {
    const email = authUser.email
    const isAdmin = await checkIsAdmin(email)

    if (isAdmin) {
      set({
        user: { id: authUser.id, email, name: 'Administrator' },
        isAdmin: true,
        tenantId: null,
      })
      return { ok: true, isAdmin: true }
    }

    const tenant = await getTenantByUserId(authUser.id)

    // No tenant row for this product → user does not belong here.
    if (!tenant) {
      return { ok: false, isAdmin: false }
    }

    set({
      user: { id: authUser.id, email, name: tenant.name || email },
      isAdmin: false,
      tenantId: tenant.id,
      tier: tenant.tier || TIER_ORDER[0],
      status: tenant.status || 'trial',
      settings: {
        name: tenant.name || '',
        addr: tenant.address || '',
        phone: tenant.phone || '',
        email,
      },
    })
    return { ok: true, isAdmin: false }
  },

  /* Called by Login after a successful supabase sign-in. */
  login: async (authUser) => {
    return await get().hydrateUser(authUser)
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
