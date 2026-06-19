import { createClient } from '@supabase/supabase-js'

// Supabase dashboard → Project Settings → API
const SUPABASE_URL = 'https://cxsaeftacozyphuejuxo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4c2FlZnRhY296eXBodWVqdXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODExNTEsImV4cCI6MjA4OTQ1NzE1MX0.hqx-0ZfG3MOHPg_fwVhPGh2CJAWqJd3GqPssWpRKDEo'

// Unique storageKey keeps SoloOps' session separate from other verticals
// that share the same Supabase project.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: 'alzaro-soloops-auth' },
})

// Some legacy/co-located code still references window.sb — keep it available.
if (typeof window !== 'undefined') window.sb = sb

export default sb
