# Alzaro ServiceOps

The signed-in portal for Alzaro ServiceOps. Built as a **parameterised template**
so SoloOps and PropertyOps can be created from the same core with minimal changes.

## How the template works

Everything product-specific lives in **two files**:

- `src/config/product.js` — name, accent colour, route basename, support email,
  tenant noun ("business"), pricing tiers, trial length.
- `src/config/nav.js` — the sidebar nav / page list for this product.

Everything else is shared core and should stay identical across products:

| File | Role |
|------|------|
| `src/lib/supabase.js` | Supabase client (tags requests with `x-product`) |
| `src/lib/db.js` | All tenant queries, scoped to this product |
| `src/store/useStore.js` | Auth state + session restore (zustand) |
| `src/components/TrialGuard.jsx` | Blocks suspended / trial-expired tenants |
| `src/components/Sidebar.jsx` | Nav, tier-locking, theme toggle |
| `src/components/UI.jsx` | Card / Btn / StatCard / Badge / PageHeader |
| `src/pages/Login.jsx` | Login + register + forgot password |
| `src/pages/ResetPassword.jsx` | Password reset landing |
| `src/pages/Admin.jsx` | Platform-owner panel (this product's tenants) |
| `src/App.jsx` | Routing + auth gating + layout |

The ServiceOps-specific pages are `Dashboard.jsx` and `pages/index.jsx`
(Jobs, Quotes, Invoices, Customers, Schedule, Settings).

## Setup

1. Run `SUPABASE_SETUP.sql` in the Supabase SQL editor (adds the `product`
   column to the shared `garages` table, the `platform_admins` table, etc.).
2. Add yourself to `platform_admins` (see the commented INSERT in the SQL).
3. Copy `.env.example` to `.env` and paste the real anon key.
4. `npm install` then `npm run dev`.

## Deploy (Vercel, under /serviceops/)

`vite.config.js` sets `base: '/serviceops/dist/'` to match the existing
alzaro-main layout. `npm run build` outputs to `dist/`.

## Creating SoloOps / PropertyOps from this

1. Copy the whole folder.
2. Edit `src/config/product.js` — change `id`, `name`, `accent`, `basename`,
   `tenantNoun`, `tiers`.
3. Edit `src/config/nav.js` — change the pages (e.g. Properties/Tenants for PropertyOps).
4. Replace the product-specific pages (`Dashboard.jsx`, `pages/index.jsx`).
5. Update `vite.config.js` `base` and the `<title>` in `index.html`.

The auth, trial guard, admin panel, sidebar and UI all carry over untouched.
