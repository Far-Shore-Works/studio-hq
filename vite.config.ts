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
      { find: "@supabase/storage-js", replacement: here("./src/stubs/storage-js.ts") },
      { find: "@supabase/functions-js", replacement: here("./src/stubs/functions-js.ts") },
      { find: "@", replacement: here("./src") },
    ],
  },
  server: { port: 5173, host: "localhost" },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Libraries change far less often than the page, so they get their own files: a redeploy of the page
        // doesn't make a returning visitor download them again, and they load in parallel.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/framer-motion|node_modules\/motion-/.test(id)) return "motion";
          if (/node_modules\/@supabase\//.test(id)) return "supabase";
          return undefined;
        },
      },
    },
  },
}));
