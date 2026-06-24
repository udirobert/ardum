// 0G Compute Router client contract. Kept server-side only — never import
// from a client component. The router API key stays in route handlers.

import type { AttestationIndex } from "@/attestation/schema";
import type { PractitionerProfile } from "@/calibration/schema";
import type { MatchRun } from "@/matching/types";

export type AgentProvider = "0g-compute" | "local" | "0g-compute-fallback";

export type AgentRequest = {
  practitioner: PractitionerProfile;
  attestations: AttestationIndex[];
};

export type AgentResponse = {
  run: MatchRun;
};
