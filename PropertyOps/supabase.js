/* ==================================================================
   ALZARO PROPERTYOPS — SUPABASE CONFIG
   ------------------------------------------------------------------
   1. Paste your two values from:
        Supabase  ->  Project Settings  ->  API
   2. Save, upload, done. The anon key is SAFE in front-end code.
   ================================================================== */

const SUPABASE_URL = "https://cxsaeftacozyphuejuxo.supabase.co";      // e.g. https://abcd1234.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_W9AHDRz7bDupOoz8OQPbJw_RdbwUayE"; // publishable / anon public key

/* Creates a global `db` client the rest of the app uses. */
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: "alzaro-propertyops-auth" }
});

/* Quick flag so the app can show a friendly message if keys aren't set yet. */
const DB_READY = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
