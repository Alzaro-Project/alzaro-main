import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the repo folder name + Vercel output path, same rule as the
// other verticals (see SoloOps/vite.config.js).
export default defineConfig({
  plugins: [react()],
  base: '/Accountant/dist/',
  build: { outDir: 'dist', emptyOutDir: true },
})
