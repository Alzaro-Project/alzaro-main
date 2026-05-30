import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed under /serviceops/ on the alzaro-main Vercel app.
export default defineConfig({
  plugins: [react()],
  base: '/serviceops/dist/',
})
