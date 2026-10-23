import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Served at the root of hq.farshoreworks.com (GitHub Pages custom domain), so base is "/".
// `vite --mode shots` swaps in preview/fake-supabase.ts for local screenshots; production never includes it.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "/",
  resolve: {
    alias: [
      ...(mode === "shots" ? [{ find: "@/lib/supabase", replacement: here("./preview/fake-supabase.ts") }] : []),
      { find: "@", replacement: here("./src") },
    ],
  },
  server: { port: 5173, host: "localhost" },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 800 },
}));
