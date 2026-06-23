// In-memory session cache for the v0 demo. Replaced by Supabase + pgvector
// when SUPABASE_URL is configured. The shape mirrors what the production
// store will need.

import type { PractitionerProfile } from "@/calibration/schema";
import type { MatchRun } from "@/matching/types";

type Session = {
  profile: PractitionerProfile;
  matchRun?: MatchRun;
  createdAt: number;
};

// Module-level singleton — fine for a single-process Vercel/Netlify demo.
// Server-only; never import from a client component.
declare global {
  // eslint-disable-next-line no-var
  var __ardumSessions: Map<string, Session> | undefined;
}

const sessions: Map<string, Session> =
  globalThis.__ardumSessions ?? new Map<string, Session>();

if (!globalThis.__ardumSessions) globalThis.__ardumSessions = sessions;

export function newSessionId(): string {
  return crypto.randomUUID();
}

export function saveProfile(id: string, profile: PractitionerProfile): void {
  const existing = sessions.get(id);
  sessions.set(id, {
    profile,
    matchRun: existing?.matchRun,
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export function saveMatchRun(id: string, run: MatchRun): void {
  const existing = sessions.get(id);
  if (!existing) {
    sessions.set(id, {
      // Placeholder profile — the real one will arrive via saveProfile()
      // before the user hits the match page.
      profile: {
        energy: "settled",
        budget: "1k-2k",
        social: "small-circle",
        createdAt: new Date().toISOString(),
      },
      matchRun: run,
      createdAt: Date.now(),
    });
    return;
  }
  existing.matchRun = run;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function getProfile(id: string): PractitionerProfile | undefined {
  return sessions.get(id)?.profile;
}

export function getMatchRun(id: string): MatchRun | undefined {
  return sessions.get(id)?.matchRun;
}
