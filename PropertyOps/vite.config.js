import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base MUST match the GitHub repo folder casing exactly: /PropertyOps/
export default defineConfig({
  plugins: [react()],
  base: "/PropertyOps/dist/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Split rarely-changing libraries into their own chunk. The browser caches
    // this across deploys, so a refresh only re-downloads the small app chunk.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "supabase-vendor": ["@supabase/supabase-js"],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
