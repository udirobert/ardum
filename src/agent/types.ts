// 0G Compute Router client contract. Kept server-side only — never import
// from a client component. The router API key stays in route handlers.

import type { AttestationIndex } from "@/attestation/schema";
import type { PractitionerProfile } from "@/calibration/schema";
import type { MatchRun } from "@/matching/types";
import type { MemoryContext } from "@/lib/cognee";

export type AgentProvider = "0g-compute";

export type AgentRequest = {
  practitioner: PractitionerProfile;
  attestations: AttestationIndex[];
  // Mira's recalled memory for this practitioner. When present and
  // isReturning is true, the prompt includes a memory section so the
  // agent can reason about the practitioner's history — energy
  // trajectory, past matches, past bookings, notes. This is what makes
  // Cognee memory actually change the recommendation, not just the UI.
  memory?: MemoryContext;
};

export type AgentResponse = {
  run: MatchRun;
};
