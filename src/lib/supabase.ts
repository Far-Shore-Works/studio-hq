import { createClient } from "@supabase/supabase-js";

// Public by design: the project URL and the publishable key only let a browser talk to Supabase.
// Every table is closed to anonymous users and open only to the founders listed in public.members
// (row-level security). Never put the secret / service-role key in this repo.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ocliypdvdtiyucthykiu.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_EDj2LfCZpyFHm2D8iEkZEA_1Z6Md-us";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Implicit flow so a magic link opened on another device (phone mail app) still signs in.
    flowType: "implicit",
  },
  realtime: { params: { eventsPerSecond: 5 } },
});

/** Which sign-in methods are switched on (GitHub needs its OAuth app pasted into Supabase first). */
export async function authSettings(): Promise<{ github: boolean; email: boolean }> {
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/settings", { headers: { apikey: SUPABASE_KEY } });
    const j = await r.json();
    return { github: !!j?.external?.github, email: j?.external?.email !== false };
  } catch {
    return { github: false, email: true };
  }
}
