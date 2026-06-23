// An attestation is a signed, verifiable claim about a retreat (or anything
// else — the schema is intentionally generic). Stored on 0G Storage.
//
// The breathCycle shape is a subset of the Nafas JSON config schema
// ({ unit, pre, cycle, ratio }) — structured breath metadata that the
// matching agent can reason over, instead of free-text prose.

export type AttestationKind = "retreat" | "teacher" | "venue" | "practice";

// One segment of a programmable breath cycle. Each phase is the duration
// in `unit`s; `repeat` is how many times this segment runs before moving on.
export type BreathCycleSegment = {
  repeat: number;
  inhale: number;
  retain: number;
  exhale: number;
  sustain: number;
};

// A pre-cycle calibration phase — used at the very start of a session to
// settle the practitioner before the main cycle begins.
export type BreathPhaseKey = "inhale" | "retain" | "exhale" | "sustain";

export type BreathCycle = {
  unit: "seconds";
  // Pre-cycle: a list of single-phase durations (only the keys present are used).
  pre: Partial<Record<BreathPhaseKey, number>>[];
  // The main cycle: each entry runs `repeat` times.
  cycle: BreathCycleSegment[];
  // A human-readable ratio string, e.g. "1:1:1:0" (inhale:retain:exhale:sustain).
  // Reducible from the cycle but stored explicitly so the UI can show it.
  ratio: string;
};

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
    // Optional structured breath cycle, Nafas-shaped. Strongest signal for
    // pranayama / breathwork retreats.
    breathCycle?: BreathCycle;
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
