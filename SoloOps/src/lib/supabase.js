import { createClient } from '@supabase/supabase-js'

// Supabase dashboard → Project Settings → API
const SUPABASE_URL = 'https://cxsaeftacozyphuejuxo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4c2FlZnRhY296eXBodWVqdXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODExNTEsImV4cCI6MjA4OTQ1NzE1MX0.hqx-0ZfG3MOHPg_fwVhPGh2CJAWqJd3GqPssWpRKDEo'

// ---------------------------------------------------------------------------
// Support access (admin "View client portal")
//
// When an admin opens a customer's account from /platform, that tab must NOT
// disturb any real login. Two things keep it separate:
//
//   * a different storageKey - so it can never overwrite alzaro-soloops-auth
//   * sessionStorage         - so it is scoped to that one tab and is gone the
//                              moment the tab closes
//
// SUPPORT_FLAG is written by pages/Support.jsx BEFORE it reloads the app, so by
// the time this module runs on the next page load the flag is already set and
// the client below is built in support mode. The flag lives in sessionStorage
// too, so a normal tab is never affected.
//
// The client is constructed once at import and its storage can't be swapped
// afterwards (the same constraint PropertyOps documents), which is exactly why
// the handover is a full page reload rather than a state change.
// ---------------------------------------------------------------------------
export const SUPPORT_FLAG = 'alzaro-support-session'
export const SUPPORT_STORAGE_KEY = 'alzaro-soloops-support-auth'

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
  if (typeof window === 'undefined') return { storageKey: 'alzaro-soloops-auth' }
  if (SUPPORT_MODE) {
    return {
      storageKey: SUPPORT_STORAGE_KEY,
      storage: window.sessionStorage,
      persistSession: true,
      // Deliberately NO refresh. With refresh on, a support tab left open could
      // renew itself indefinitely and the countdown would be decoration. Off,
      // the session genuinely dies when the access token expires (~1 hour),
      // so the banner's timer reflects a real limit.
      autoRefreshToken: false,
      // The token arrives in the URL fragment and is exchanged by hand in
      // pages/Support.jsx - don't let the SDK race us for it.
      detectSessionInUrl: false,
    }
  }
  // Unique storageKey keeps SoloOps' session separate from other verticals
  // that share the same Supabase project.
  return { storageKey: 'alzaro-soloops-auth' }
}

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: authConfig(),
  // product_members RLS keys off this header (same as the other verticals).
  global: { headers: { 'x-product': 'soloops' } },
})

// A throwaway client used only to redeem the support token. It writes into the
// same tab-scoped slot the support client reads from on the next load.
export function createSupportClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storageKey: SUPPORT_STORAGE_KEY,
      storage: window.sessionStorage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { 'x-product': 'soloops' } },
  })
}
