import "server-only";

import { cookies } from "next/headers";
import { signActorId, verifySignedActor } from "./signature";

const COOKIE_NAME = "ardum-actor";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function secret(): string {
  return (
    process.env.ARDUM_ACTOR_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "ardum-local-development-secret"
  );
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

export function verifyActorCookie(value: string): string | null {
  return parse(value);
}
