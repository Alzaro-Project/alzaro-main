import { createClient } from "@supabase/supabase-js";

/* ==================================================================
   ALZARO PROPERTYOPS — SUPABASE CLIENT (Vite)
   Values come from Vercel env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
   The x-product header is REQUIRED — RLS scopes every query by it.
   ================================================================== */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// True only when both env vars are present at build time.
export const DB_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// "Keep me signed in" preference. The Supabase client picks its storage ONCE
// at construction (you can't swap it after login), so the login screen saves
// this choice and we read it here on the next page load:
//   • checked (default) -> localStorage  -> session survives closing the tab
//   • unchecked         -> sessionStorage -> logged out when the tab closes
// The pref key itself lives in localStorage so the choice is remembered even
// when the auth session is stored in sessionStorage.
export const REMEMBER_KEY = "propops_keep_signed_in";
function authStorage() {
  if (typeof window === "undefined") return undefined;
  let keep = true; // default: stay signed in
  try {
    const v = window.localStorage.getItem(REMEMBER_KEY);
    if (v !== null) keep = v === "1";
  } catch (e) {}
  return keep ? window.localStorage : window.sessionStorage;
}

// Only build a real client when both keys exist. createClient(undefined, …)
// throws at import time, which would white-screen the whole app instead of
// falling back to the intended "demo mode" (DB_READY === false). The stub
// mirrors the tiny slice of the API used before DB_READY is checked, so a
// stray call can't crash either.
export const db = DB_READY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storageKey: "alzaro-propertyops-auth",
        storage: authStorage(),
        persistSession: true,
        autoRefreshToken: true,
      },
      global: { headers: { "x-product": "propertyops" } },
    })
  : {
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null }),
      },
    };
