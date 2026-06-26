// /api/_billing-config.js
// ============================================================
// STRIPE BILLING CONFIG  (server-side only — no VITE_ prefix needed)
// ============================================================
// Maps each Alzaro product's subscription tiers to their Stripe Price IDs.
//
// Structure:  BILLING[product][tier] = stripePriceId
// To add another vertical later, add a new top-level key mirroring `tyreops`.
//
// NOTE: these are Stripe TEST price IDs. Swap them for live price IDs when
// going to production (ideally move them to env vars at that point).
// ============================================================

// Tier order, lowest -> highest. Shared concept with the TyreOps frontend
// (src/store/useStore.js). Used to fail closed: any uncertainty about a tier
// resolves to the LOWEST tier, never an accidental upgrade to gold.
export const TIER_ORDER = ['basic', 'bronze', 'silver', 'gold']

export const LOWEST_TIER = 'basic'

// Tiers are standardised across verticals, so every product currently maps to
// the SAME set of Stripe TEST price IDs. If a vertical's pricing diverges
// later, just give it its own price IDs here — the structure already supports
// per-product mappings.
const STANDARD_TIERS = {
  basic:  'price_1TmbnjRWazRh8KC4VPdWlQzb',
  bronze: 'price_1TmboIRWazRh8KC4bHUalyfW',
  silver: 'price_1TmbpZRWazRh8KC4pwSwVqUG',
  gold:   'price_1TmbqBRWazRh8KC4qEjJu6T3',
}

export const BILLING = {
  tyreops:     { ...STANDARD_TIERS },
  garageops:   { ...STANDARD_TIERS },
  serviceops:  { ...STANDARD_TIERS },
  propertyops: { ...STANDARD_TIERS },
  soloops:     { ...STANDARD_TIERS },
  // stockops: not on product_members billing yet.
}

// Resolve a Stripe Price ID for (product, tier).
// Returns null when the product is unknown or `tier` isn't a real paid tier.
export function priceIdFor(product, tier) {
  const tiers = BILLING[product]
  if (!tiers) return null
  return tiers[tier] || null
}

// Reverse lookup: given a Stripe Price ID, return its tier for a product.
// Used by the webhook to derive the tier from what was ACTUALLY subscribed,
// rather than trusting metadata alone. Returns null if not found.
export function tierForPriceId(product, priceId) {
  const tiers = BILLING[product]
  if (!tiers || !priceId) return null
  for (const [tier, id] of Object.entries(tiers)) {
    if (id === priceId) return tier
  }
  return null
}

// Fail-closed tier validation. Returns `tier` only if it's a known paid tier
// for `product`; otherwise the LOWEST tier. Never silently grants a higher
// tier (and in particular never defaults to gold).
export function safeTier(product, tier) {
  const tiers = BILLING[product]
  if (tiers && tier && Object.prototype.hasOwnProperty.call(tiers, tier)) return tier
  return LOWEST_TIER
}
