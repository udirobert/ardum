// Canonical attestation payload — both the client (to sign) and the server
// (to verify) must use this exact builder. Lives in its own module so they
// can't drift.
//
// The signature is EIP-191 personal_sign over the canonical string. The
// recovered address must equal `attestation.attestor`. This proves the wallet
// that wrote the attestation actually signed off on its contents, before
// the server hands it to 0G Storage.

import type { Attestation } from "./schema";

export function canonicalAttestationMessage(a: Attestation): string {
  // Stable field order so the signature is reproducible across clients.
  return [
    "Ardum attestation v1",
    `rootHash: ${a.rootHash}`,
    `title: ${a.title}`,
    `attestor: ${a.attestor}`,
    `location: ${a.claims.location}`,
    `durationDays: ${a.claims.durationDays}`,
    `priceUsd: ${a.claims.priceUsd}`,
    `capacity: ${a.claims.capacity}`,
    `practiceStyle: ${a.claims.practiceStyle.join(", ")}`,
    `energyFit: ${a.claims.energyFit.join(", ")}`,
    `socialFit: ${a.claims.socialFit.join(", ")}`,
    `breathPhase: ${a.claims.breathPhase.join(", ")}`,
  ].join("\n");
}
