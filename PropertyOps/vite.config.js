import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base MUST match the GitHub repo folder casing exactly: /PropertyOps/
export default defineConfig({
  plugins: [react()],
  base: "/PropertyOps/dist/",
  build: { outDir: "dist", emptyOutDir: true },
});
