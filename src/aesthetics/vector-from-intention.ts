// Derive a preliminary aesthetic vector from the intention statement.
//
// The product contract (experience-layer.md) says the intention ask is
// the first interaction, not image reactions. Aesthetic calibration is
// off by default, so most practitioners never build a vector through
// the swipe flow. Without this mapping, the retreat vision and orb
// palette fall back to NEUTRAL_VECTOR — generic for everyone.
//
// This is a soft, keyword-based derivation: it nudges the neutral vector
// toward qualities named in the intention. It never overrides a stored
// calibrated vector (callers prefer the stored vector when present), and
// it is deliberately coarse — it produces a preliminary signal, not a
// preference claim. The ranking policy is unaffected; only the vision
// image selection and the orb palette consume this.
//
// Style matches src/agent/conversation-extractor.ts: keyword matching,
// no external services, demo-grade.

import { NEUTRAL_VECTOR, type AestheticVector } from "./image-pool";

// Each rule nudges named vector keys by a signed delta when the
// intention contains any of the keywords. Deltas are small (±0.25)
// because this is a preliminary signal, not a calibrated preference.
type Rule = {
  keywords: string[];
  shifts: Partial<Record<keyof AestheticVector, number>>;
};

const RULES: Rule[] = [
  {
    keywords: ["ocean", "sea", "beach", "coast", "water", "surf", "island"],
    shifts: { ocean: 0.35, warm: 0.1, calming: 0.15, expansive: 0.2 },
  },
  {
    keywords: ["mountain", "peak", "summit", "altitude", "alpine", "himalay"],
    shifts: { mountain: 0.35, cool: 0.15, expansive: 0.2, minimal: 0.1 },
  },
  {
    keywords: ["jungle", "rainforest", "canopy", "tropical", "tropics"],
    shifts: { jungle: 0.35, warm: 0.15, ornate: 0.15, intimate: 0.1 },
  },
  {
    keywords: ["desert", "dune", "arid", "sand"],
    shifts: { desert: 0.35, warm: 0.2, minimal: 0.2, expansive: 0.25 },
  },
  {
    keywords: ["forest", "woods", "trees", "cedar", "pine", "old-growth"],
    shifts: { forest: 0.35, cool: 0.1, calming: 0.15, intimate: 0.15 },
  },
  {
    keywords: ["quiet", "silence", "still", "peaceful", "calm", "rest", "restore", "slow"],
    shifts: { calming: 0.3, minimal: 0.15, intimate: 0.1, energizing: -0.2 },
  },
  {
    keywords: ["energiz", "active", "movement", "dynamic", "challenge", "intense", "push"],
    shifts: { energizing: 0.3, expansive: 0.1, light: 0.1, calming: -0.15 },
  },
  {
    keywords: ["dark", "night", "stars", "stargaz", "moonlight", "cave"],
    shifts: { dark: 0.35, cool: 0.1, intimate: 0.15, light: -0.2 },
  },
  {
    keywords: ["light", "sun", "bright", "sunrise", "dawn", "golden"],
    shifts: { light: 0.35, warm: 0.1, expansive: 0.1, dark: -0.2 },
  },
  {
    keywords: ["minimal", "simple", "clean", "sparse", "bare", "austerity"],
    shifts: { minimal: 0.3, ornate: -0.2, light: 0.1 },
  },
  {
    keywords: ["ornate", "temple", "ancient", "intricate", "carved", "detailed", "ritual"],
    shifts: { ornate: 0.3, minimal: -0.15, intimate: 0.1 },
  },
  {
    keywords: ["alone", "solo", "myself", "private", "solitude", "hermit"],
    shifts: { intimate: 0.25, calming: 0.1, expansive: -0.1 },
  },
  {
    keywords: ["open", "vast", "expansive", "horizon", "sky", "space"],
    shifts: { expansive: 0.3, intimate: -0.1, light: 0.1 },
  },
  {
    keywords: ["cold", "cool", "winter", "snow", "ice", "frost"],
    shifts: { cool: 0.3, warm: -0.2, dark: 0.1 },
  },
  {
    keywords: ["warm", "fire", "sun", "heat", "tropical"],
    shifts: { warm: 0.3, cool: -0.15 },
  },
];

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Derive a preliminary aesthetic vector from an intention statement.
 * Returns NEUTRAL_VECTOR when the intention carries no recognizable
 * aesthetic signal. Callers should prefer a stored calibrated vector
 * when one exists; this is the fallback for un-calibrated practitioners.
 */
export function vectorFromIntention(intention: string): AestheticVector {
  const text = intention.toLowerCase().trim();
  if (!text) return NEUTRAL_VECTOR;

  const vector: AestheticVector = { ...NEUTRAL_VECTOR };
  let matched = false;

  for (const rule of RULES) {
    if (!rule.keywords.some((keyword) => text.includes(keyword))) continue;
    matched = true;
    for (const [key, delta] of Object.entries(rule.shifts) as [
      keyof AestheticVector,
      number,
    ][]) {
      vector[key] = clamp(vector[key] + delta);
    }
  }

  return matched ? vector : NEUTRAL_VECTOR;
}
