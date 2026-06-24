// In-memory session adapter. Used when SUPABASE_URL is not configured
// (demo mode). The shape mirrors what the production Supabase store
// needs; the dispatcher in ./session.ts picks this adapter at module load.

import "server-only";

import type { PractitionerProfile } from "@/calibration/schema";
import type { MatchRun } from "@/matching/types";

export type Session = {
  profile: PractitionerProfile;
  matchRun?: MatchRun;
  createdAt: number;
};

declare global {
  var __ardumSessions: Map<string, Session> | undefined;
}

const sessions: Map<string, Session> =
  globalThis.__ardumSessions ?? new Map<string, Session>();

if (!globalThis.__ardumSessions) globalThis.__ardumSessions = sessions;

const PLACEHOLDER_PROFILE: PractitionerProfile = {
  energy: "settled",
  budget: "1k-2k",
  social: "small-circle",
  createdAt: new Date(0).toISOString(),
};

export async function saveProfile(
  id: string,
  profile: PractitionerProfile
): Promise<void> {
  const existing = sessions.get(id);
  sessions.set(id, {
    profile,
    matchRun: existing?.matchRun,
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export async function saveMatchRun(
  id: string,
  run: MatchRun
): Promise<void> {
  const existing = sessions.get(id);
  sessions.set(id, {
    profile: existing?.profile ?? PLACEHOLDER_PROFILE,
    matchRun: run,
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export async function getSession(
  id: string
): Promise<Session | undefined> {
  return sessions.get(id);
}

export async function getProfile(
  id: string
): Promise<PractitionerProfile | undefined> {
  return sessions.get(id)?.profile;
}

export async function getMatchRun(
  id: string
): Promise<MatchRun | undefined> {
  return sessions.get(id)?.matchRun;
}

// Scans recent sessions for a run that contains the given retreat rootHash.
// Used by the OG image generator. Bounded by `limit` to keep the scan cheap.
export async function findMatchRunForRetreat(
  rootHash: string,
  limit = 50
): Promise<MatchRun | undefined> {
  let scanned = 0;
  for (const s of sessions.values()) {
    if (scanned++ >= limit) return;
    if (!s.matchRun) continue;
    if (
      s.matchRun.results.some(
        (r) => r.id === rootHash || r.retreatRootHash === rootHash
      )
    ) {
      return s.matchRun;
    }
  }
  return;
}
