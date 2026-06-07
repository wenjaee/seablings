import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null | undefined;

// Browser Supabase client used only for realtime subscriptions. Returns null when the
// public URL / anon (publishable) key are not configured, so callers fall back to polling.
export function getBrowserSupabaseClient(): SupabaseClient | null {
  if (supabaseClient !== undefined) {
    return supabaseClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false
    }
  });

  return supabaseClient;
}
