/* ==================================================================
   ALZARO OPS — PRODUCT CONFIG  (ServiceOps)
   ------------------------------------------------------------------
   This is the ONLY file that should differ between products.
   To spin up a new product, copy this file, change the values,
   and supply the product-specific pages + nav. The shared core
   (auth, trial guard, admin panel, sidebar, UI) reads everything
   it needs from here.
   ================================================================== */

export const PRODUCT = {
  // Identity ---------------------------------------------------------
  id: 'serviceops',                 // matches Supabase `product` column + x-product header
  name: 'ServiceOps',               // shown after "Alzaro" in logos
  fullName: 'Alzaro ServiceOps',
  tagline: 'Field Service Operations',
  description: 'The operating system for UK tradespeople — quotes, jobs, invoicing and compliance.',

  // The word used for a tenant in this product (garage / business / landlord…)
  tenantNoun: 'business',           // singular, lowercase
  tenantNounPlural: 'businesses',
  tenantLabel: 'Business name',     // shown on the register form

  // Routing ----------------------------------------------------------
  basename: '/serviceops',          // react-router basename + Vite base is derived from this

  // Branding ---------------------------------------------------------
  // Each product gets its own accent. ServiceOps = teal/green (its landing-page family).
  accent: '#10b981',
  accentDark: '#0d9488',

  // Support / billing ------------------------------------------------
  supportEmail: 'support@alzaro.co.uk',
  billingSubject: 'Alzaro ServiceOps Subscription',

  // Pricing tiers (label + monthly £). Order matters: low → high.
  tiers: [
    { id: 'starter',  label: 'Starter',  price: 29, icon: '🔧' },
    { id: 'pro',      label: 'Pro',      price: 49, icon: '⚡' },
    { id: 'business', label: 'Business', price: 89, icon: '🏆' },
  ],

  trialDays: 14,
}

// Derived helpers ----------------------------------------------------
export const TIER_ORDER = PRODUCT.tiers.map(t => t.id)
export const TIER_PRICE = Object.fromEntries(PRODUCT.tiers.map(t => [t.id, t.price]))
export const TIER_META  = Object.fromEntries(PRODUCT.tiers.map(t => [t.id, t]))
