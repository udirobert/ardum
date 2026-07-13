// Vector → generative vision prompt. Pure — no SDK imports.

import type { AestheticVector } from "./image-pool";

function dominantEnvironments(v: AestheticVector): string[] {
  const envs = [
    { name: "ocean coastline", score: v.ocean },
    { name: "mountain mist", score: v.mountain },
    { name: "jungle canopy", score: v.jungle },
    { name: "desert dunes", score: v.desert },
    { name: "forest stream", score: v.forest },
  ];
  return envs
    .filter((e) => e.score > 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((e) => e.name);
}

export function vectorToVisionPrompt(
  vector: AestheticVector,
  intention?: string,
): string {
  const envs = dominantEnvironments(vector);
  const envLine =
    envs.length > 0 ? envs.join(" and ") : "a quiet retreat landscape";

  const tone =
    vector.warm > vector.cool + 0.12
      ? "warm terracotta and golden hour light"
      : vector.cool > vector.warm + 0.12
        ? "cool slate mist and silver dawn"
        : "balanced warm cream atmosphere";

  const energy =
    vector.calming > vector.energizing + 0.1
      ? "deeply calming, slow, meditative"
      : vector.energizing > vector.calming + 0.1
        ? "alive with gentle movement"
        : "settled and restorative";

  const space =
    vector.expansive > vector.intimate + 0.1
      ? "vast open horizon, breathing room"
      : vector.intimate > vector.expansive + 0.1
        ? "intimate enclosed sanctuary"
        : "human-scaled quiet";

  const style =
    vector.minimal > vector.ornate + 0.1
      ? "minimal architectural simplicity"
      : vector.ornate > vector.minimal + 0.1
        ? "rich organic texture and detail"
        : "natural unhurried beauty";

  const intentionLine = intention?.trim()
    ? `The scene holds space for: ${intention.trim().slice(0, 120)}. `
    : "";

  return (
    `${intentionLine}Cinematic retreat vision, ${envLine}, ${tone}, ` +
    `${energy}, ${space}, ${style}. ` +
    `No people, no text, no logos. Photorealistic, atmospheric depth, ` +
    `soft volumetric light, editorial travel photography, 16:9.`
  );
}
