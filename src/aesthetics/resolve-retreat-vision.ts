// Deterministic retreat vision — curated pool, zero runtime generation cost.

import {
  IMAGE_POOL,
  NEUTRAL_VECTOR,
  type AestheticVector,
  type PoolImage,
} from "./image-pool";
import { vectorFingerprint } from "./vector-fingerprint";
import { vectorToVisionPrompt } from "./vision-prompt";

export type RetreatVisionSource = "curated";

export type RetreatVisionArtifact = {
  fingerprint: string;
  imageId: string;
  imageUrl: string;
  alt: string;
  prompt: string;
  source: RetreatVisionSource;
  /** Vector-driven tint for client overlays (0–1). */
  grade: {
    warmth: number;
    darkness: number;
    calm: number;
  };
};

export type ResolveRetreatVisionInput = {
  vector?: AestheticVector | null;
  intention?: string;
  /** Calibration reactions — boost resonated images, penalize skipped. */
  interactions?: { imageId: string; reaction: "resonate" | "skip" }[];
};

function localVisionSrc(imageId: string): string {
  return `/aesthetics/visions/${imageId}.jpg`;
}

function scoreImage(
  image: PoolImage,
  vector: AestheticVector,
  interactions: ResolveRetreatVisionInput["interactions"],
): number {
  let score = 0;
  for (const key of Object.keys(vector) as (keyof AestheticVector)[]) {
    score += vector[key] * image.vector[key];
  }

  if (interactions) {
    for (const item of interactions) {
      if (item.imageId !== image.id) continue;
      score += item.reaction === "resonate" ? 1.2 : -0.35;
    }
  }

  return score;
}

export function pickVisionImage(
  vector: AestheticVector,
  interactions?: ResolveRetreatVisionInput["interactions"],
): PoolImage {
  let best = IMAGE_POOL[0];
  let bestScore = -Infinity;

  for (const image of IMAGE_POOL) {
    const score = scoreImage(image, vector, interactions);
    if (score > bestScore || (score === bestScore && image.id < best.id)) {
      bestScore = score;
      best = image;
    }
  }

  return best;
}

export function gradeForVector(vector: AestheticVector): RetreatVisionArtifact["grade"] {
  return {
    warmth: Math.min(1, Math.max(0, (vector.warm - vector.cool + 1) / 2)),
    darkness: Math.min(1, Math.max(0, vector.dark * 0.65 + (1 - vector.light) * 0.35)),
    calm: Math.min(1, Math.max(0, (vector.calming - vector.energizing + 1) / 2)),
  };
}

export function resolveRetreatVision(
  input: ResolveRetreatVisionInput = {},
): RetreatVisionArtifact {
  const vector = input.vector ?? NEUTRAL_VECTOR;
  const intention = input.intention?.trim();
  const image = pickVisionImage(vector, input.interactions);
  const fingerprint = vectorFingerprint(vector, intention);

  return {
    fingerprint,
    imageId: image.id,
    imageUrl: localVisionSrc(image.id),
    alt: image.alt,
    prompt: vectorToVisionPrompt(vector, intention),
    source: "curated",
    grade: gradeForVector(vector),
  };
}
