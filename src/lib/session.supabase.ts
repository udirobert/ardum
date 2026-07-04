// Supabase session adapter. Used when SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY are set. Persists across serverless cold-starts
// and Vercel function restarts. The dispatcher in ./session.ts picks this
// adapter at module load.

import "server-only";

import type { PractitionerProfile } from "@/calibration/schema";
import type { MatchRun } from "@/matching/types";
import type { Session } from "./session.memory";
import { supabaseAdmin } from "./supabase";

const TABLE = "sessions";

function rowToSession(row: {
  id: string;
  profile: PractitionerProfile | null;
  match_run: MatchRun | null;
  created_at: string;
}): Session {
  return {
    profile:
      row.profile ?? {
        energy: "settled",
        budget: "1k-2k",
        social: "small-circle",
        createdAt: row.created_at,
      },
    matchRun: row.match_run ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function saveProfile(
  id: string,
  profile: PractitionerProfile
): Promise<void> {
  const sb = supabaseAdmin();
  if (!sb) return;
  try {
    const { error } = await sb
      .from(TABLE)
      .upsert(
        { id, profile, updated_at: new Date().toISOString() },
        { onConflict: "id" }
      );
    if (error) throw new Error(`Supabase saveProfile failed: ${error.message}`);
  } catch (err) {
    // Supabase unreachable (paused project, DNS failure, etc.) —
    // don't 500 the profile POST. The stream reads the profile from
    // the `p` query param, so persistence here is best-effort.
    console.warn("saveProfile: Supabase unreachable, skipping:", err);
  }
}

export async function saveMatchRun(
  id: string,
  run: MatchRun
): Promise<void> {
  const sb = supabaseAdmin();
  if (!sb) return;
  const { error } = await sb
    .from(TABLE)
    .upsert(
      { id, match_run: run, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  if (error) throw new Error(`Supabase saveMatchRun failed: ${error.message}`);
}

export async function getSession(
  id: string
): Promise<Session | undefined> {
  const sb = supabaseAdmin();
  if (!sb) return;
  try {
    const { data, error } = await sb
      .from(TABLE)
      .select("id, profile, match_run, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getSession failed: ${error.message}`);
    return data ? rowToSession(data) : undefined;
  } catch (err) {
    // Supabase unreachable — return undefined rather than 500ing.
    console.warn("getSession: Supabase unreachable:", err);
    return undefined;
  }
}

export async function getProfile(
  id: string
): Promise<PractitionerProfile | undefined> {
  return (await getSession(id))?.profile;
}

export async function getMatchRun(
  id: string
): Promise<MatchRun | undefined> {
  return (await getSession(id))?.matchRun;
}

export async function findMatchRunForRetreat(
  rootHash: string
): Promise<MatchRun | undefined> {
  const sb = supabaseAdmin();
  if (!sb) return;
  // `match_run` is jsonb; containment check matches any run whose results
  // array contains an entry with the target id. Postgres indexes on the
  // containment operator exist out of the box for jsonb.
  const { data, error } = await sb
    .from(TABLE)
    .select("match_run")
    .contains("match_run", { results: [{ id: rootHash, retreatRootHash: rootHash }] })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Supabase findMatchRunForRetreat failed: ${error.message}`);
  return data?.match_run ?? undefined;
}
