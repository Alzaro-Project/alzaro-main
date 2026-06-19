// ServiceOps data layer (thin).
// Re-exports the Supabase client as `db` so existing page code that calls
// db.from(...) / db.auth / db.storage keeps working unchanged.
// DB_READY mirrors the old guard the pages check everywhere.

import { supabase } from './supabase.js'

export const db = supabase

// The old Babel app gated every query on DB_READY. With env-var config the
// client only works when both vars are present, so DB_READY reflects that.
export const DB_READY = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
)
