// Wider-aperture evidence — tier B (cohort) and tier C (public web).
// Product contract: docs/decisions/0010-wider-aperture-evidence.md
// Beat 2 surfaces: docs/design/recommendation-reveal.md

import type { IntentionConstraints } from "@/episodes/model";
import type { EnergyState, SocialComfort } from "@/calibration/schema";

export const MIN_COHORT_SAMPLE_SIZE = 30;

export type EvidenceProvenance =
  | "explicit"
  | "reported"
  | "inferred"
  | "uncertain";

export type InspectedClaim = {
  text: string;
  sourceLabel: string;
  sourceUrl?: string;
  fetchedAt: string;
  provenance: EvidenceProvenance;
};

export type CohortEvidence = {
  summary: string;
  intentionShapeLabel: string;
  sampleSize: number;
  refreshedAt: string;
  provenance: "reported";
};

export type PublicEvidence = {
  summary: string;
  claims: InspectedClaim[];
  refreshedAt: string;
};

export type WiderApertureEvidence = {
  cohort: CohortEvidence | null;
  public: PublicEvidence | null;
};

/** Coarse intention shape for cohort matching — never verbatim statements. */
export type IntentionShape = {
  energy?: EnergyState;
  social?: SocialComfort;
};

export type CohortSliceRecord = IntentionShape & {
  sampleSize: number;
  summary: string;
  intentionShapeLabel: string;
  refreshedAt: string;
};

export type PublicEvidenceRecord = {
  /** Retreat catalog id and/or attestation root hash. */
  retreatKeys: string[];
  summary: string;
  claims: InspectedClaim[];
  refreshedAt: string;
  /** Minimum 0–1; rows hidden below 0.5 */
  confidence: number;
};

export function intentionShapeFromConstraints(
  constraints: IntentionConstraints,
): IntentionShape {
  return {
    energy: constraints.energy,
    social: constraints.social,
  };
}

/** Episode shape matches a cohort slice when shared dimensions agree. */
export function intentionShapeMatches(
  episode: IntentionShape,
  slice: IntentionShape,
): boolean {
  if (slice.energy !== undefined && episode.energy !== slice.energy) {
    return false;
  }
  if (slice.social !== undefined && episode.social !== slice.social) {
    return false;
  }
  return slice.energy !== undefined || slice.social !== undefined;
}

/** Optional ≤15-word letter clause when uncertainty is high and evidence exists. */
export function letterEvidenceClause(
  evidence: WiderApertureEvidence,
  uncertaintyCount: number,
): string | null {
  if (uncertaintyCount <= 0) return null;

  const publicClause = pickPublicLetterClause(evidence.public);
  if (publicClause) return publicClause;

  return pickCohortLetterClause(evidence.cohort);
}

function pickPublicLetterClause(
  pub: PublicEvidence | null,
): string | null {
  if (!pub?.summary) return null;
  const firstSentence = pub.summary.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (!firstSentence || firstSentence.length > 72) return null;
  if (/\d+%/.test(firstSentence)) return null;
  return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
}

function pickCohortLetterClause(
  cohort: CohortEvidence | null,
): string | null {
  if (!cohort?.summary) return null;
  const firstSentence = cohort.summary.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (!firstSentence || firstSentence.length > 72) return null;
  if (/\d+%/.test(firstSentence)) return null;
  return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
}

export function composeBeat2Letter(
  baseLetter: string,
  evidence: WiderApertureEvidence | null | undefined,
  uncertainties: string[] | undefined,
): string {
  if (!evidence) return baseLetter;
  const clause = letterEvidenceClause(
    evidence,
    uncertainties?.length ?? 0,
  );
  if (!clause) return baseLetter;
  const trimmed = baseLetter.trim();
  const end = trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
  return `${end} ${clause}`;
}
