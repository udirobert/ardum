import { describe, expect, it } from "vitest";
import { signActorId, verifySignedActor } from "./signature";

describe("signed actor cookie", () => {
  it("accepts a correctly signed actor", () => {
    const actor = "actor-123";
    const secret = "test-secret";
    expect(
      verifySignedActor(`${actor}.${signActorId(actor, secret)}`, secret),
    ).toBe(actor);
  });

  it("rejects tampered identifiers and signatures", () => {
    const secret = "test-secret";
    const signed = `actor-123.${signActorId("actor-123", secret)}`;
    expect(verifySignedActor(signed.replace("actor-123", "actor-999"), secret)).toBeNull();
    expect(verifySignedActor(`${signed}x`, secret)).toBeNull();
  });
});
