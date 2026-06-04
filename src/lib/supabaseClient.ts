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

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loud in dev so a missing .env is obvious rather than a silent runtime error.
  console.warn(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your Supabase project values.",
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
