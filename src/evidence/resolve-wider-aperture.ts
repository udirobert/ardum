import type { IntentionConstraints } from "@/episodes/model";
import {
  intentionShapeFromConstraints,
  intentionShapeMatches,
  MIN_COHORT_SAMPLE_SIZE,
  type CohortSliceRecord,
  type PublicEvidenceRecord,
  type WiderApertureEvidence,
} from "./wider-aperture";

const MIN_PUBLIC_CONFIDENCE = 0.5;

export type WiderApertureStores = {
  cohortSlices?: CohortSliceRecord[];
  publicRecords?: PublicEvidenceRecord[];
};

export function resolveWiderApertureEvidence(input: {
  constraints: IntentionConstraints;
  retreatKey: string;
  stores?: WiderApertureStores;
}): WiderApertureEvidence {
  const stores = input.stores ?? {};
  const retreatKey = input.retreatKey.trim();
  const shape = intentionShapeFromConstraints(input.constraints);

  return {
    cohort: resolveCohortEvidence(shape, stores.cohortSlices ?? []),
    public: retreatKey
      ? resolvePublicEvidence(retreatKey, stores.publicRecords ?? [])
      : null,
  };
}

function resolveCohortEvidence(
  shape: ReturnType<typeof intentionShapeFromConstraints>,
  slices: CohortSliceRecord[],
): WiderApertureEvidence["cohort"] {
  const match = slices.find(
    (slice) =>
      intentionShapeMatches(shape, slice) &&
      slice.sampleSize >= MIN_COHORT_SAMPLE_SIZE,
  );
  if (!match) return null;

  return {
    summary: match.summary,
    intentionShapeLabel: match.intentionShapeLabel,
    sampleSize: match.sampleSize,
    refreshedAt: match.refreshedAt,
    provenance: "reported",
  };
}

function resolvePublicEvidence(
  retreatKey: string,
  records: PublicEvidenceRecord[],
): WiderApertureEvidence["public"] {
  const match = records.find(
    (record) =>
      record.retreatKeys.includes(retreatKey) &&
      record.confidence >= MIN_PUBLIC_CONFIDENCE &&
      record.claims.length > 0,
  );
  if (!match) return null;

  return {
    summary: match.summary,
    claims: match.claims,
    refreshedAt: match.refreshedAt,
  };
}

export function hasWiderApertureEvidence(
  evidence: WiderApertureEvidence | null | undefined,
): boolean {
  if (!evidence) return false;
  return evidence.cohort !== null || evidence.public !== null;
}
