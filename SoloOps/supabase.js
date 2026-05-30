// ============================================================
//  SoloOps — Supabase client
//  Paste your project's values below:
//  Supabase dashboard → Project Settings → API
// ============================================================
const SUPABASE_URL = 'https://cxsaeftacozyphuejuxo.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4c2FlZnRhY296eXBodWVqdXhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODExNTEsImV4cCI6MjA4OTQ1NzE1MX0.hqx-0ZfG3MOHPg_fwVhPGh2CJAWqJd3GqPssWpRKDEo'

// `supabase` global comes from the CDN script in app.html
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// expose for Login.jsx / Dashboard.jsx
window.sb = sb
