import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Deployed under /ServiceOps/dist/ — base MUST match the repo folder casing
// so the /ServiceOps/:path((?!dist).*) redirect leaves asset paths alone,
// exactly like TyreOps (/TyreOps/dist/).
export default defineConfig({
  plugins: [react()],
  base: '/ServiceOps/dist/',
})
