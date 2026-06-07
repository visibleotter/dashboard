import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

/*
  Browser Supabase client.

  Uses ONLY the anon key + project URL (the two VITE_ vars). Per brief §2, the
  service-role key and the Anthropic key are server-only and must NEVER appear in
  client code — those live in Vercel API routes (api/) and read process.env there.

  All data access through this client is gated by auth + RLS (added in the auth phase).
*/

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Don't crash the whole app (createClient throws on an empty URL). Render the login
  // screen with a "not configured" notice instead of a black screen. On Vercel this means
  // the VITE_ env vars weren't set at BUILD time — set them and redeploy.
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Set them in your .env (local) or Vercel env vars (production) and rebuild.",
  );
}

// Fall back to a syntactically-valid placeholder so createClient never throws at import.
export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
);
