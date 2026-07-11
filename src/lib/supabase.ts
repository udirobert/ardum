// Supabase client. Server-only — the service role key never leaves the
// server. In v0 this is optional; the in-memory session store is the
// default. When SUPABASE_URL is set, sessions + match runs persist across
// requests/restarts.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabase, readServerEnv } from "./env";

let _client: SupabaseClient | null = null;
// Test affordance. Allows scripts/test-supabase-live.mjs (and any future
// integration test) to inject a Supabase client pointed at a project other
// than the one configured by environment variables. Production code paths
// never touch this — the override defaults to null. setSupabaseAdminForTest
// should only ever be called from a test setup file with restricted scope.
let _override: SupabaseClient | null = null;

export function setSupabaseAdminForTest(client: SupabaseClient | null): void {
  _override = client;
}

export function supabaseAdmin(): SupabaseClient | null {
  if (_override) return _override;
  if (!hasSupabase()) return null;
  if (_client) return _client;
  const env = readServerEnv();
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return _client;
}
