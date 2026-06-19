import { createClient } from "@supabase/supabase-js";

/* ==================================================================
   ALZARO PROPERTYOPS — SUPABASE CLIENT (Vite)
   Values come from Vercel env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
   The x-product header is REQUIRED — RLS scopes every query by it.
   ================================================================== */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: "alzaro-propertyops-auth" },
  global: { headers: { "x-product": "propertyops" } },
});

// True only when both env vars are present at build time.
export const DB_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
