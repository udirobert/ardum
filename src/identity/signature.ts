import { createHmac, timingSafeEqual } from "node:crypto";

export function signActorId(actorId: string, secret: string): string {
  return createHmac("sha256", secret).update(actorId).digest("base64url");
}

export function verifySignedActor(
  value: string | undefined,
  secret: string,
): string | null {
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const actorId = value.slice(0, separator);
  const supplied = Buffer.from(value.slice(separator + 1));
  const expected = Buffer.from(signActorId(actorId, secret));
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }
  return actorId;
}
