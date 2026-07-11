import type { AttestationIndex, AttestationKind } from "@/attestation/schema";
import { SEED_ATTESTATIONS } from "@/lib/seed-attestations";

const allowedKinds = new Set<AttestationKind>(["retreat"]);

export function localEvidence(kind: AttestationKind = "retreat"): AttestationIndex[] {
  if (!allowedKinds.has(kind)) return [];
  return SEED_ATTESTATIONS.filter(
    (item): item is AttestationIndex => item.kind === kind,
  );
}
