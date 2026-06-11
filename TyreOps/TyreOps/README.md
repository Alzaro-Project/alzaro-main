# Alzaro TyreOps

Tyre garage management — inventory with FIFO batch costing, invoicing, customers, purchases, and VAT reporting (standard, flat rate, and margin scheme).

## Stack

- React 19 + Vite
- Zustand (state, persisted to localStorage; data lives in Supabase)
- Supabase (auth + database)
- jsPDF (invoice/billing PDFs, imported dynamically)
- react-router-dom (routed under `/tyreops`)

## Project layout

```
src/
  App.jsx              Routes, layout, mobile shell, ErrorBoundary
  components/          Sidebar, GlobalSearch, TrialGuard, WelcomeBanner, UI primitives, ErrorBoundary
  pages/               Dashboard, Invoices, Inventory, Purchases, Customers, VATReport, Settings, Admin, Login, ResetPassword
  store/useStore.js    Zustand store — auth, settings, all data actions
  lib/db.js            Supabase data layer (all table access goes through here)
  lib/email.js         Invoice email generation + sending (SMTP via /api endpoints)
  lib/supabase.js      Supabase client (reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
```

## Development

```
npm install
npm run dev
```

Requires a `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Deployment

Built by the repo-root `vercel.json` (`npm run build` with base `/TyreOps/dist/`), served at `/tyreops`. When committing changes that add or remove dependencies, always commit `package.json` and `package-lock.json` together with the source files.
