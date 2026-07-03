// The curated image pool — pre-selected images representing different
// aesthetic directions. Each image has a fixed aesthetic vector that
// we use to build the user's preference profile.
//
// This is Tier 1: zero API cost, instant load. The user's reactions
// to these images build a preference vector that later drives:
//   1. Which images we show next (bandit-style selection)
//   2. The fal.ai prompt for the generated "retreat vision" (Tier 2)
//   3. Mira's language in the match letter ("You were drawn to ocean
//      and warm tones...")
//
// Over time, the dataset improves: we learn which image vectors
// correlate with which retreat choices, and can predict preferences
// from 2-3 reactions.

export type AestheticVector = {
  // Environment (0-1, how present this quality is in the image)
  ocean: number;
  mountain: number;
  jungle: number;
  desert: number;
  forest: number;
  // Visual tone
  warm: number;
  cool: number;
  minimal: number;
  ornate: number;
  light: number;
  dark: number;
  // Emotional resonance
  calming: number;
  energizing: number;
  expansive: number;
  intimate: number;
};

export type PoolImage = {
  id: string;
  src: string;
  alt: string;
  vector: AestheticVector;
  // Tags for Mira's language generation
  tags: string[];
};

// Neutral starting vector — all qualities equally present
export const NEUTRAL_VECTOR: AestheticVector = {
  ocean: 0.5,
  mountain: 0.5,
  jungle: 0.5,
  desert: 0.5,
  forest: 0.5,
  warm: 0.5,
  cool: 0.5,
  minimal: 0.5,
  ornate: 0.5,
  light: 0.5,
  dark: 0.5,
  calming: 0.5,
  energizing: 0.5,
  expansive: 0.5,
  intimate: 0.5,
};

// The curated pool — 12 images covering the aesthetic space.
// Unsplash URLs with carefully chosen photos that represent
// distinct aesthetic directions.
export const IMAGE_POOL: PoolImage[] = [
  {
    id: "bali-ocean",
    src: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=70&auto=format&fit=crop",
    alt: "Ocean meeting jungle at a Bali coastline",
    vector: { ocean: 0.9, mountain: 0.2, jungle: 0.5, desert: 0.0, forest: 0.3, warm: 0.8, cool: 0.3, minimal: 0.6, ornate: 0.2, light: 0.7, dark: 0.2, calming: 0.9, energizing: 0.3, expansive: 0.8, intimate: 0.3 },
    tags: ["ocean", "warm", "calming", "expansive"],
  },
  {
    id: "mountain-mist",
    src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=70&auto=format&fit=crop",
    alt: "Mist over layered mountain ridges at dawn",
    vector: { ocean: 0.1, mountain: 0.9, jungle: 0.1, desert: 0.2, forest: 0.3, warm: 0.3, cool: 0.8, minimal: 0.7, ornate: 0.1, light: 0.6, dark: 0.4, calming: 0.85, energizing: 0.2, expansive: 0.9, intimate: 0.2 },
    tags: ["mountain", "cool", "calming", "expansive", "mist"],
  },
  {
    id: "jungle-canopy",
    src: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=70&auto=format&fit=crop",
    alt: "Sunlight filtering through dense jungle canopy",
    vector: { ocean: 0.1, mountain: 0.2, jungle: 0.95, desert: 0.0, forest: 0.8, warm: 0.6, cool: 0.4, minimal: 0.2, ornate: 0.8, light: 0.5, dark: 0.5, calming: 0.6, energizing: 0.5, expansive: 0.3, intimate: 0.7 },
    tags: ["jungle", "forest", "ornate", "intimate"],
  },
  {
    id: "desert-dunes",
    src: "https://images.unsplash.com/photo-1473580044384-34fe828d2e6f?w=800&q=70&auto=format&fit=crop",
    alt: "Smooth desert dunes at golden hour",
    vector: { ocean: 0.0, mountain: 0.3, jungle: 0.0, desert: 0.95, forest: 0.0, warm: 0.9, cool: 0.1, minimal: 0.9, ornate: 0.1, light: 0.8, dark: 0.2, calming: 0.8, energizing: 0.3, expansive: 0.95, intimate: 0.15 },
    tags: ["desert", "warm", "minimal", "expansive"],
  },
  {
    id: "forest-stream",
    src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70&auto=format&fit=crop",
    alt: "Quiet stream through old-growth forest",
    vector: { ocean: 0.2, mountain: 0.3, jungle: 0.4, desert: 0.0, forest: 0.95, warm: 0.3, cool: 0.7, minimal: 0.4, ornate: 0.6, light: 0.4, dark: 0.6, calming: 0.9, energizing: 0.15, expansive: 0.3, intimate: 0.8 },
    tags: ["forest", "cool", "calming", "intimate"],
  },
  {
    id: "minimal-studio",
    src: "https://images.unsplash.com/photo-1593810451137-5dc55105dace?w=800&q=70&auto=format&fit=crop",
    alt: "Minimal yoga studio with natural light",
    vector: { ocean: 0.0, mountain: 0.0, jungle: 0.0, desert: 0.0, forest: 0.1, warm: 0.4, cool: 0.5, minimal: 0.95, ornate: 0.05, light: 0.85, dark: 0.15, calming: 0.8, energizing: 0.3, expansive: 0.5, intimate: 0.6 },
    tags: ["minimal", "light", "calming", "studio"],
  },
  {
    id: "tropical-sunset",
    src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70&auto=format&fit=crop",
    alt: "Tropical beach at sunset with palm silhouettes",
    vector: { ocean: 0.85, mountain: 0.1, jungle: 0.3, desert: 0.2, forest: 0.2, warm: 0.95, cool: 0.1, minimal: 0.5, ornate: 0.4, light: 0.6, dark: 0.4, calming: 0.7, energizing: 0.5, expansive: 0.85, intimate: 0.4 },
    tags: ["ocean", "warm", "tropical", "expansive"],
  },
  {
    id: "alpine-lake",
    src: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=800&q=70&auto=format&fit=crop",
    alt: "Still alpine lake reflecting peaks",
    vector: { ocean: 0.3, mountain: 0.85, jungle: 0.0, desert: 0.1, forest: 0.3, warm: 0.2, cool: 0.85, minimal: 0.6, ornate: 0.3, light: 0.5, dark: 0.5, calming: 0.9, energizing: 0.2, expansive: 0.7, intimate: 0.4 },
    tags: ["mountain", "cool", "calming", "still"],
  },
  {
    id: "temple-stone",
    src: "https://images.unsplash.com/photo-1545569310-acec1c7f9b0f?w=800&q=70&auto=format&fit=crop",
    alt: "Ancient stone temple in soft morning light",
    vector: { ocean: 0.0, mountain: 0.3, jungle: 0.3, desert: 0.2, forest: 0.2, warm: 0.6, cool: 0.4, minimal: 0.4, ornate: 0.8, light: 0.5, dark: 0.5, calming: 0.75, energizing: 0.2, expansive: 0.4, intimate: 0.7 },
    tags: ["temple", "ornate", "ancient", "intimate"],
  },
  {
    id: "desert-night",
    src: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=70&auto=format&fit=crop",
    alt: "Starfield over desert landscape at night",
    vector: { ocean: 0.0, mountain: 0.2, jungle: 0.0, desert: 0.8, forest: 0.0, warm: 0.2, cool: 0.7, minimal: 0.7, ornate: 0.3, light: 0.15, dark: 0.9, calming: 0.85, energizing: 0.15, expansive: 0.95, intimate: 0.25 },
    tags: ["desert", "dark", "night", "expansive", "stars"],
  },
  {
    id: "rice-terraces",
    src: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=70&auto=format&fit=crop",
    alt: "Lush rice terraces in tropical highlands",
    vector: { ocean: 0.1, mountain: 0.6, jungle: 0.6, desert: 0.0, forest: 0.5, warm: 0.7, cool: 0.3, minimal: 0.3, ornate: 0.7, light: 0.7, dark: 0.2, calming: 0.7, energizing: 0.4, expansive: 0.6, intimate: 0.5 },
    tags: ["tropical", "warm", "terraces", "green"],
  },
  {
    id: "nordic-fjord",
    src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=70&auto=format&fit=crop",
    alt: "Nordic fjord with low clouds and deep water",
    vector: { ocean: 0.6, mountain: 0.8, jungle: 0.0, desert: 0.0, forest: 0.3, warm: 0.1, cool: 0.95, minimal: 0.6, ornate: 0.2, light: 0.3, dark: 0.7, calming: 0.85, energizing: 0.2, expansive: 0.8, intimate: 0.3 },
    tags: ["mountain", "ocean", "cool", "dark", "calming"],
  },
];

// ── Preference vector operations ────────────────────────────────────

export type UserPreference = {
  vector: AestheticVector;
  interactions: { imageId: string; reaction: "resonate" | "skip"; dwellMs: number }[];
};

export function emptyPreference(): UserPreference {
  return {
    vector: { ...NEUTRAL_VECTOR },
    interactions: [],
  };
}

// Update the preference vector based on a user reaction.
// Resonate → move toward the image's vector (weighted by dwell time).
// Skip → move slightly away.
// The learning rate scales with dwell time — longer looks = stronger signal.
export function updatePreference(
  pref: UserPreference,
  image: PoolImage,
  reaction: "resonate" | "skip",
  dwellMs: number,
): UserPreference {
  // Dwell time factor: 0.1 (quick) to 0.4 (long gaze)
  const dwellFactor = Math.min(0.4, Math.max(0.1, dwellMs / 5000));
  const lr = reaction === "resonate" ? dwellFactor : -dwellFactor * 0.5;

  const newVector = { ...pref.vector };
  for (const key of Object.keys(image.vector) as (keyof AestheticVector)[]) {
    const current = newVector[key];
    const target = image.vector[key];
    newVector[key] = Math.min(1, Math.max(0, current + (target - current) * lr));
  }

  return {
    vector: newVector,
    interactions: [
      ...pref.interactions,
      { imageId: image.id, reaction, dwellMs },
    ],
  };
}

// Pick the next image to show — bandit-style selection.
// Favor images that are dissimilar to what we've already shown
// (exploration) but slightly biased toward the user's current
// preference vector (exploitation).
export function pickNextImage(
  pool: PoolImage[],
  pref: UserPreference,
  shownIds: Set<string>,
): PoolImage | null {
  const available = pool.filter((img) => !shownIds.has(img.id));
  if (available.length === 0) return null;

  // Score each image: similarity to user vector + novelty bonus
  let best = available[0];
  let bestScore = -Infinity;

  for (const img of available) {
    // Similarity: dot product of user vector and image vector
    let similarity = 0;
    for (const key of Object.keys(img.vector) as (keyof AestheticVector)[]) {
      similarity += pref.vector[key] * img.vector[key];
    }

    // Novelty: images not yet shown get a bonus
    const noveltyBonus = 0.5;

    const score = similarity * 0.6 + noveltyBonus * 0.4;
    if (score > bestScore) {
      bestScore = score;
      best = img;
    }
  }

  return best;
}

// Generate a textual description of the user's aesthetic preferences
// for Mira's match letter. Returns the top 2-3 dominant qualities.
export function describePreferences(pref: UserPreference): string[] {
  const v = pref.vector;
  const qualities: { key: keyof AestheticVector; label: string; value: number }[] = [
    { key: "ocean", label: "ocean", value: v.ocean },
    { key: "mountain", label: "mountain", value: v.mountain },
    { key: "jungle", label: "jungle", value: v.jungle },
    { key: "desert", label: "desert", value: v.desert },
    { key: "forest", label: "forest", value: v.forest },
    { key: "warm", label: "warm tones", value: v.warm },
    { key: "cool", label: "cool tones", value: v.cool },
    { key: "minimal", label: "minimal spaces", value: v.minimal },
    { key: "ornate", label: "ornate detail", value: v.ornate },
    { key: "calming", label: "calming energy", value: v.calming },
    { key: "expansive", label: "expansive landscapes", value: v.expansive },
    { key: "intimate", label: "intimate spaces", value: v.intimate },
  ];

  // Sort by value descending, take top qualities above 0.6
  const dominant = qualities
    .filter((q) => q.value > 0.6)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
    .map((q) => q.label);

  return dominant;
}
