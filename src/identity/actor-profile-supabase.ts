import "server-only";

// Supabase actor profile adapter. Reads and writes the recognition columns
// (preferred_name, profile) on the actors row. The actors row is created
// by the episode repository on first episode create; this adapter upserts
// on update so a profile can be set before any episode exists.

import { supabaseAdmin } from "@/lib/supabase";
import type { ActorProfile } from "./actor-profile";

function client() {
  const value = supabaseAdmin();
  if (!value) throw new Error("Supabase is not configured.");
  return value;
}

type ActorRow = {
  preferred_name: string | null;
  profile: Record<string, unknown> | null;
};

function toProfile(row: ActorRow | null): ActorProfile {
  if (!row) return { preferredName: null, profile: {} };
  return {
    preferredName: row.preferred_name ?? null,
    profile: row.profile ?? {},
  };
}

export async function get(actorId: string): Promise<ActorProfile> {
  const { data, error } = await client()
    .from("actors")
    .select("preferred_name, profile")
    .eq("id", actorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toProfile(data as ActorRow | null);
}

export async function update(
  actorId: string,
  patch: Partial<ActorProfile>,
): Promise<ActorProfile> {
  const update: Record<string, unknown> = {};
  if (patch.preferredName !== undefined) {
    update.preferred_name = patch.preferredName;
  }
  if (patch.profile !== undefined) {
    update.profile = patch.profile;
  }
  // Upsert so a profile can be set before any episode creates the row.
  const { data, error } = await client()
    .from("actors")
    .upsert({ id: actorId, ...update }, { onConflict: "id" })
    .select("preferred_name, profile")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return toProfile(data as ActorRow | null);
}

// ADR 0011 §2: write the provider subject and flip kind to 'authenticated'.
// The subject is the cross-device join key; the cookie remains the ownership
// primitive. Upsert so an actor row is created if it does not yet exist.
export async function attachExternalSubject(
  actorId: string,
  subject: string,
): Promise<void> {
  const { error } = await client()
    .from("actors")
    .upsert(
      {
        id: actorId,
        external_subject: subject,
        kind: "authenticated",
      },
      { onConflict: "id" },
    );
  if (error) throw new Error(error.message);
}

// ADR 0011 §3: look up an actor by provider subject for cross-device
// restore. Returns the actor id or null. The unique index on
// external_subject (001-episodes.sql) guarantees at most one match.
export async function findByExternalSubject(
  subject: string,
): Promise<string | null> {
  const { data, error } = await client()
    .from("actors")
    .select("id")
    .eq("external_subject", subject)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}
