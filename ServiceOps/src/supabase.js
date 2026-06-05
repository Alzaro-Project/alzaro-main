/* ==================================================================
   ALZARO SERVICEOPS — SUPABASE CONFIG
   ------------------------------------------------------------------
   Same Supabase project as PropertyOps. The anon key is SAFE in
   front-end code. ServiceOps uses the svc_ tables.
   ================================================================== */

const SUPABASE_URL = "https://cxsaeftacozyphuejuxo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_W9AHDRz7bDupOoz8OQPbJw_RdbwUayE";

/* Creates a global `db` client the rest of the app uses. */
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Quick flag so the app can show a friendly message if keys aren't set yet. */
const DB_READY = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
