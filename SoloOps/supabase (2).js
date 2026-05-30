// ============================================================
//  SoloOps — Supabase client
//  Paste your project's values below:
//  Supabase dashboard → Project Settings → API
// ============================================================
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY'

// `supabase` global comes from the CDN script in app.html
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// expose for Login.jsx / Dashboard.jsx
window.sb = sb
