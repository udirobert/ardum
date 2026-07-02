// Canonical booking attestation message — both the client (to sign) and
// the server (to verify) must use this exact builder. Mirrors the pattern
// from src/attestation/sign.ts for retreat attestations.

import type { BookingAttestation } from "./types";

export function canonicalBookingMessage(b: BookingAttestation): string {
  return [
    "Ardum booking attestation v1",
    `rootHash: ${b.rootHash}`,
    `retreatRootHash: ${b.claims.retreatRootHash}`,
    `practitioner: ${b.claims.practitionerAddress}`,
    `operator: ${b.claims.operatorAddress}`,
    `depositUsd: ${b.claims.depositUsd}`,
    `depositToken: ${b.claims.depositToken}`,
    `depositTxId: ${b.claims.depositTxId ?? ""}`,
    `escrowAddress: ${b.claims.escrowAddress ?? ""}`,
    `status: ${b.claims.status}`,
    `bookedAt: ${b.claims.bookedAt}`,
  ].join("\n");
}
