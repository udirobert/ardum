// Edge-safe session adapter. The matching SSE stream route runs on the
// Edge runtime to clear the 10s Hobby ceiling, so it can't depend on the
// @supabase/supabase-js client (which transitively imports Node modules
// like `fs` via its realtime/websocket plumbing). Instead this module
// talks to Supabase's PostgREST endpoint over raw `fetch`, which is
// edge-native.
//
// It exposes the two functions the stream route actually uses —
// getProfile + saveMatchRun — and the same in-memory fallback shape so
// dev without Supabase configured still works.

import type { PractitionerProfile } from "@/calibration/schema";
import type { MatchRun } from "@/matching/types";

const TABLE = "sessions";

function envOrEmpty(name: string): string {
  return process.env[name] ?? "";
}

function hasSupabase(): boolean {
  return Boolean(envOrEmpty("SUPABASE_URL") && envOrEmpty("SUPABASE_SERVICE_ROLE_KEY"));
}

function restUrl(path: string): string {
  return `${envOrEmpty("SUPABASE_URL").replace(/\/$/, "")}/rest/v1${path}`;
}

function restHeaders(extra?: Record<string, string>): Record<string, string> {
  const key = envOrEmpty("SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// ─── In-memory fallback (dev without Supabase) ───────────────────────────

declare global {

  var __ardumEdgeSessions:
    | Map<string, { profile?: PractitionerProfile; matchRun?: MatchRun }>
    | undefined;
}

const memSessions =
  globalThis.__ardumEdgeSessions ??
  new Map<string, { profile?: PractitionerProfile; matchRun?: MatchRun }>();
if (!globalThis.__ardumEdgeSessions) globalThis.__ardumEdgeSessions = memSessions;

// ─── Public API ──────────────────────────────────────────────────────────

export async function getProfile(
  id: string
): Promise<PractitionerProfile | undefined> {
  if (!hasSupabase()) {
    return memSessions.get(id)?.profile;
  }
  const url =
    restUrl(`/${TABLE}`) +
    `?id=eq.${encodeURIComponent(id)}&select=profile&limit=1`;
  const res = await fetch(url, { headers: restHeaders() });
  if (!res.ok) {
    throw new Error(
      `Supabase getProfile failed: HTTP ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  const rows = (await res.json()) as Array<{ profile: PractitionerProfile | null }>;
  return rows[0]?.profile ?? undefined;
}

export async function saveMatchRun(id: string, run: MatchRun): Promise<void> {
  if (!hasSupabase()) {
    const existing = memSessions.get(id);
    memSessions.set(id, { profile: existing?.profile, matchRun: run });
    return;
  }
  const res = await fetch(restUrl(`/${TABLE}`), {
    method: "POST",
    headers: restHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({
      id,
      match_run: run,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(
      `Supabase saveMatchRun failed: HTTP ${res.status} ${await res.text().catch(() => "")}`
    );
  }
}
