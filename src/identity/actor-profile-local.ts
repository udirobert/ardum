// In-memory actor profile adapter for the local/demo path.
// Mirrors the Supabase adapter contract; state survives HMR via globalThis.

import type { ActorProfile } from "./actor-profile";

declare global {
  var __ardumActorProfiles: Map<string, ActorProfile> | undefined;
}

const profiles =
  globalThis.__ardumActorProfiles ?? new Map<string, ActorProfile>();

if (!globalThis.__ardumActorProfiles) {
  globalThis.__ardumActorProfiles = profiles;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export async function get(actorId: string): Promise<ActorProfile> {
  const profile = profiles.get(actorId);
  return profile ? clone(profile) : { preferredName: null, profile: {} };
}

export async function update(
  actorId: string,
  patch: Partial<ActorProfile>,
): Promise<ActorProfile> {
  const existing = profiles.get(actorId) ?? {
    preferredName: null,
    profile: {},
  };
  const next: ActorProfile = {
    preferredName:
      patch.preferredName !== undefined
        ? patch.preferredName
        : existing.preferredName,
    profile:
      patch.profile !== undefined
        ? { ...patch.profile }
        : { ...existing.profile },
  };
  profiles.set(actorId, clone(next));
  return clone(next);
}

// The local adapter does not model external_subject or kind — those are
// cross-device concerns that only matter when a provider is configured.
// This is a no-op so the client-side attach call succeeds in demo mode.
export async function attachExternalSubject(
  actorId: string,
  subject: string,
): Promise<void> {
  void actorId;
  void subject;
}

// No external_subject is stored in local mode; cross-device restore is
// a Supabase-only feature. Returns null so the restore route responds
// with "no existing identity found" in demo mode.
export async function findByExternalSubject(
  subject: string,
): Promise<string | null> {
  void subject;
  return null;
}
