import "server-only";

import { cookies } from "next/headers";
import { signActorId, verifySignedActor } from "./signature";

const COOKIE_NAME = "ardum-actor";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function secret(): string {
  const explicit = process.env.ARDUM_ACTOR_SECRET;
  if (explicit) return explicit;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseKey) return supabaseKey;
  // Production must set a real secret — the fallback is public in the repo
  // and would let anyone forge actor cookies and impersonate users.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ARDUM_ACTOR_SECRET (or SUPABASE_SERVICE_ROLE_KEY) must be set in production.",
    );
  }
  return "ardum-local-development-secret";
}

function parse(value: string | undefined): string | null {
  return verifySignedActor(value, secret());
}

export async function resolveActor(options?: {
  create?: boolean;
}): Promise<string | null> {
  const store = await cookies();
  const existing = parse(store.get(COOKIE_NAME)?.value);
  if (existing || !options?.create) return existing;

  const actorId = crypto.randomUUID();
  store.set(COOKIE_NAME, `${actorId}.${signActorId(actorId, secret())}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return actorId;
}

/** Re-sign the cookie against an existing actor id. Used by the
 *  cross-device restore flow (ADR 0011 §3): after verifying the
 *  practitioner owns the provider subject, the server re-attaches
 *  this device's cookie to the existing actor row. */
export async function setActorCookie(actorId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, `${actorId}.${signActorId(actorId, secret())}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function verifyActorCookie(value: string): string | null {
  return parse(value);
}
