import "server-only";

// Actor profile — the recognition rungs below payment identity.
//
// ADR 0011: voluntary naming and explicit preferences live on the actors
// row, not on the episode. The cookie (ADR 0004) remains the ownership
// primitive; this module reads and writes recognition fields by actor id.
//
// Two adapters implement the same contract, mirroring the episode
// repository pattern: an in-memory local adapter for the demo path and a
// Supabase adapter for production. `hasSupabase()` picks the active
// adapter; callers never branch on the provider.

import { hasSupabase } from "@/lib/env";
import * as local from "./actor-profile-local";
import * as supabase from "./actor-profile-supabase";

export type ActorProfile = {
  preferredName: string | null;
  /** Free-form preferences (accommodation, time-of-day, dietary, …). */
  profile: Record<string, unknown>;
};

export const EMPTY_PROFILE: ActorProfile = {
  preferredName: null,
  profile: {},
};

export interface ActorProfileRepository {
  get(actorId: string): Promise<ActorProfile>;
  /** Patch the actor row. Unknown fields are ignored; null clears. */
  update(
    actorId: string,
    patch: Partial<ActorProfile>,
  ): Promise<ActorProfile>;
  /** Attach a provider subject (Magic wallet address, future providers)
   *  and flip kind to 'authenticated'. ADR 0011 §2. The subject is the
   *  cross-device join key; it is never displayed to the practitioner. */
  attachExternalSubject(actorId: string, subject: string): Promise<void>;
  /** Look up an actor by provider subject. Returns the actor id or null.
   *  ADR 0011 §3: the cross-device restore path. */
  findByExternalSubject(subject: string): Promise<string | null>;
  /** Check if the actor has an attached provider subject (is authenticated).
   *  ADR 0011 §5: used by the booked landing to decide whether to show
   *  the cross-device continuity CTA. */
  isAuthenticated(actorId: string): Promise<boolean>;
}

export const actorProfileRepository: ActorProfileRepository = hasSupabase()
  ? supabase
  : local;

/** Trim and cap a submitted preferred name. Returns null to clear. */
export function normalizePreferredName(input: string): string | null {
  const trimmed = input.trim().slice(0, 80);
  return trimmed.length > 0 ? trimmed : null;
}
