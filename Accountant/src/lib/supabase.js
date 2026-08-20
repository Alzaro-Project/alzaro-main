import { createClient } from '@supabase/supabase-js'

// Same Supabase project as the verticals; the portal is just another frontend.
const SUPABASE_URL = 'https://cxsaeftacozyphuejuxo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4c2FlZnRhY296eXBodWVqdXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODExNTEsImV4cCI6MjA4OTQ1NzE1MX0.hqx-0ZfG3MOHPg_fwVhPGh2CJAWqJd3GqPssWpRKDEo'

// Unique storageKey: an accountant logging in here never disturbs any client
// login in another tab, and vice versa (same isolation rule as each vertical).
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'alzaro-accountant-auth' },
})
