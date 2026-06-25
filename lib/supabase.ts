import { createClient } from "@supabase/supabase-js";

const url = process.env.DASHBOARD_SUPABASE_URL!;
const key = process.env.DASHBOARD_SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  throw new Error(
    "Configure DASHBOARD_SUPABASE_URL e DASHBOARD_SUPABASE_SERVICE_ROLE_KEY no .env.local"
  );
}

// Singleton server-side (service role — nunca expor no client)
export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
