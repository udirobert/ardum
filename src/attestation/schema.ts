// An attestation is a signed, verifiable claim about a retreat (or anything
// else — the schema is intentionally generic). Stored on 0G Storage.

export type AttestationKind = "retreat" | "teacher" | "venue" | "practice";

export type Attestation = {
  // The root hash returned by 0G Storage after upload. Acts as the content-id.
  rootHash: string;
  kind: AttestationKind;
  // Free-form title shown in match cards.
  title: string;
  // Plain-language description, single paragraph.
  description: string;
  // What the attestor is claiming to be true about this retreat.
  claims: {
    location: string;
    durationDays: number;
    priceUsd: number;
    capacity: number;
    practiceStyle: string[];
    energyFit: string[];
    socialFit: string[];
    breathPhase: string[];
    notes?: string;
  };
  // Wallet that wrote the attestation (verification key).
  attestor: string;
  createdAt: string;
};

// Lightweight metadata used by the matching agent — the full attestation can
// be fetched by rootHash when the user clicks a match card.
export type AttestationIndex = Pick<
  Attestation,
  "rootHash" | "kind" | "title" | "description" | "claims" | "createdAt"
>;
