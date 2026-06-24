// Session store dispatcher. Server-only; never import from a client
// component. Picks the in-memory or Supabase adapter at module load,
// based on env. The two adapters are kept as separate modules so each
// one is independently testable and replaceable.
//
// All async functions are async regardless of backend so call sites don't
// branch.

import "server-only";

import { hasSupabase } from "./env";
import type { PractitionerProfile } from "@/calibration/schema";
import type { MatchRun } from "@/matching/types";
import type { Session } from "./session.memory";

import * as memory from "./session.memory";
import * as supabase from "./session.supabase";

const backend = hasSupabase() ? supabase : memory;

export function newSessionId(): string {
  return crypto.randomUUID();
}

export const saveProfile: (
  id: string,
  profile: PractitionerProfile
) => Promise<void> = backend.saveProfile;

export const saveMatchRun: (id: string, run: MatchRun) => Promise<void> =
  backend.saveMatchRun;

export const getSession: (id: string) => Promise<Session | undefined> =
  backend.getSession;

export const getProfile: (
  id: string
) => Promise<PractitionerProfile | undefined> = backend.getProfile;

export const getMatchRun: (id: string) => Promise<MatchRun | undefined> =
  backend.getMatchRun;

export const findMatchRunForRetreat: (
  rootHash: string
) => Promise<MatchRun | undefined> = backend.findMatchRunForRetreat;
