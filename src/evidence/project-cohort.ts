// Pure cohort aggregate projection — tier B wider-aperture evidence.
// Operational episodes with an active contribution grant only; never
// verbatim statements or actor ids in output.

import type { Episode } from "@/episodes/model";
import type { EnergyState, SocialComfort } from "@/calibration/schema";
import { currentIntention } from "@/episodes/model";
import { contributionEligibleEpisodes } from "./contribution";
import {
  MIN_COHORT_SAMPLE_SIZE,
  type CohortSliceRecord,
  type IntentionShape,
} from "./wider-aperture";

type ShapeKey = `${EnergyState | "*"}:${SocialComfort | "*"}`;

const SHAPE_LABELS: Partial<Record<ShapeKey, string>> = {
  "low:solo": "recovery and solitude",
  "settled:solo": "quiet and solitude",
  "settled:small-circle": "settled energy in a small circle",
  "in-movement:open-circle": "movement in an open circle",
  "sharp:small-circle": "intensity in a small circle",
};

const SHAPE_SUMMARIES: Partial<Record<ShapeKey, string>> = {
  "low:solo":
    "Among practitioners who named recovery and chose solitude, quiet mornings and short containers tended to matter more than destination. This is a pattern, not a rule — your hold does not depend on it.",
  "settled:solo":
    "Among practitioners who arrived settled and chose solitude, unhurried mornings and minimal scheduling tended to matter more than amenities. This is a pattern, not a rule.",
  "settled:small-circle":
    "Among practitioners who arrived settled and wanted a small circle, gentle structure and predictable rhythm tended to matter more than novelty.",
  "in-movement:open-circle":
    "Among practitioners who arrived in motion and wanted company, active mornings and shared meals tended to matter more than location prestige.",
};

function shapeKey(shape: IntentionShape): ShapeKey {
  return `${shape.energy ?? "*"}:${shape.social ?? "*"}`;
}

function labelForShape(shape: IntentionShape): string {
  const key = shapeKey(shape);
  if (SHAPE_LABELS[key]) return SHAPE_LABELS[key]!;
  const parts: string[] = [];
  if (shape.energy) parts.push(`${shape.energy} energy`);
  if (shape.social) parts.push(shape.social.replace("-", " "));
  return parts.join(" and ") || "similar intentions";
}

function summaryForShape(shape: IntentionShape, sampleSize: number): string {
  const key = shapeKey(shape);
  if (SHAPE_SUMMARIES[key]) return SHAPE_SUMMARIES[key]!;
  return `Among practitioners with ${labelForShape(shape)}, ${sampleSize} anonymized journeys contributed to this pattern. This is normalization, not a recommendation.`;
}

export function projectCohortSlices(episodes: Episode[]): CohortSliceRecord[] {
  const eligible = contributionEligibleEpisodes(episodes);
  const buckets = new Map<
    ShapeKey,
    { shape: IntentionShape; episodes: Episode[] }
  >();

  for (const episode of eligible) {
    try {
      const intention = currentIntention(episode);
      const shape: IntentionShape = {
        energy: intention.constraints.energy,
        social: intention.constraints.social,
      };
      if (!shape.energy && !shape.social) continue;
      const key = shapeKey(shape);
      const bucket = buckets.get(key) ?? { shape, episodes: [] };
      bucket.episodes.push(episode);
      buckets.set(key, bucket);
    } catch {
      continue;
    }
  }

  const refreshedAt = new Date().toISOString();
  const slices: CohortSliceRecord[] = [];

  for (const { shape, episodes: bucketEpisodes } of buckets.values()) {
    if (bucketEpisodes.length < MIN_COHORT_SAMPLE_SIZE) continue;
    slices.push({
      ...shape,
      sampleSize: bucketEpisodes.length,
      intentionShapeLabel: labelForShape(shape),
      refreshedAt,
      summary: summaryForShape(shape, bucketEpisodes.length),
    });
  }

  return slices.sort((a, b) => b.sampleSize - a.sampleSize);
}
