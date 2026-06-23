// Supabase client. Server-only — the service role key never leaves the
// server. In v0 this is optional; the in-memory session store is the
// default. When SUPABASE_URL is set, sessions + match runs persist across
// requests/restarts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabase, readServerEnv } from "./env";

let _client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (_client) return _client;
  const env = readServerEnv();
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return _client;
}
