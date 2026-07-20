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

// Canonical agent booking authorization message — signed by the agent's EOA
// to authorize a specific deposit for a specific retreat on a specific
// episode. Unlike the practitioner attestation message above, this is an
// authorization (not an attestation): the agent signs it BEFORE the server
// generates the booking rootHash, so it covers only the fields the agent
// knows at sign time.
//
// Includes operatorAddress (bound to the signature — issue 5) and
// nonce + timestamp (replay protection — issue 2). The episodeId binds the
// authorization to a specific episode whose actorId must equal agentAddress
// (issue 2/3 — ownership via authenticated match).
export type AgentBookingAuthorization = {
  episodeId: string;
  retreatRootHash: string;
  operatorAddress: string;
  depositTxHash: string;
  depositUsd: number;
  agentAddress: string;
  nonce: string;
  timestamp: number;
};

export function canonicalAgentBookingMessage(
  a: AgentBookingAuthorization,
): string {
  return [
    "Ardum agent booking authorization v2",
    `episodeId: ${a.episodeId}`,
    `retreatRootHash: ${a.retreatRootHash}`,
    `operatorAddress: ${a.operatorAddress}`,
    `depositTxHash: ${a.depositTxHash}`,
    `depositUsd: ${a.depositUsd}`,
    `agentAddress: ${a.agentAddress}`,
    `nonce: ${a.nonce}`,
    `timestamp: ${a.timestamp}`,
  ].join("\n");
}

// Canonical agent match authorization — signed by the agent's EOA to create
// an episode. The recovered address becomes the episode's actorId, which
// /api/agent/book later checks. Includes nonce + timestamp for replay
// protection (issue 3).
export type AgentMatchAuthorization = {
  intention: string;
  agentAddress: string;
  nonce: string;
  timestamp: number;
};

export function canonicalAgentMatchMessage(
  a: AgentMatchAuthorization,
): string {
  return [
    "Ardum agent match authorization v1",
    `intention: ${a.intention}`,
    `agentAddress: ${a.agentAddress}`,
    `nonce: ${a.nonce}`,
    `timestamp: ${a.timestamp}`,
  ].join("\n");
}
