import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// IMPORTANT: base must be /SoloOps/dist/ (capital S) to match the repo folder
// name and the Vercel build output path used by the other verticals.
export default defineConfig({
  plugins: [react()],
  base: '/SoloOps/dist/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
