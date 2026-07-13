// Stable fingerprint for aesthetic vectors — used to cache retreat visions.

import type { AestheticVector } from "./image-pool";

const VECTOR_KEYS: (keyof AestheticVector)[] = [
  "ocean",
  "mountain",
  "jungle",
  "desert",
  "forest",
  "warm",
  "cool",
  "minimal",
  "ornate",
  "light",
  "dark",
  "calming",
  "energizing",
  "expansive",
  "intimate",
];

function quantize(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Deterministic string key for a vector (+ optional intention snippet). */
export function vectorFingerprint(
  vector: AestheticVector,
  intention?: string,
): string {
  const parts = VECTOR_KEYS.map((key) => `${key}:${quantize(vector[key])}`);
  const intentionPart = intention?.trim()
    ? `|i:${intention.trim().slice(0, 80).toLowerCase()}`
    : "";
  return parts.join(",") + intentionPart;
}
