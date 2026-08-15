import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ---------------------------------------------------------------------------
// Support access (admin "View client portal")
//
// When an admin opens a customer's account from /platform, that tab must NOT
// disturb any real login. Two things keep it separate:
//
//   * a different storageKey - so it can never overwrite alzaro-serviceops-auth
//   * sessionStorage         - so it is scoped to that one tab and is gone the
//                              moment the tab closes
//
// SUPPORT_FLAG is written by pages/Support.jsx BEFORE it reloads the app, so by
// the time this module runs on the next page load the flag is already set and
// the client below is built in support mode. The flag lives in sessionStorage
// too, so a normal tab is never affected.
// ---------------------------------------------------------------------------
export const SUPPORT_FLAG = 'alzaro-support-session'
export const SUPPORT_STORAGE_KEY = 'alzaro-serviceops-support-auth'

function readSupportMeta() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SUPPORT_FLAG)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export const supportMeta = readSupportMeta()
export const SUPPORT_MODE = supportMeta !== null

function authConfig() {
  if (SUPPORT_MODE) {
    return {
      storageKey: SUPPORT_STORAGE_KEY,
      storage: window.sessionStorage,
      persistSession: true,
      // Deliberately NO refresh: the session genuinely dies when the access
      // token expires (~1 hour), so the banner countdown is a real limit.
      autoRefreshToken: false,
      detectSessionInUrl: false,
    }
  }
  return {
    storageKey: 'alzaro-serviceops-auth'
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: authConfig(),
  global: {
    headers: {
      'x-product': 'serviceops'
    }
  }
})

// A throwaway client used only by pages/Support.jsx to redeem the one-time
// support token. It writes into the same tab-scoped slot the support client
// reads from on the next load.
export function createSupportClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      storageKey: SUPPORT_STORAGE_KEY,
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { 'x-product': 'serviceops' } },
  })
}
