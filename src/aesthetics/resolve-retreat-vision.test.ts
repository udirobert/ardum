import { describe, expect, it } from "vitest";
import { NEUTRAL_VECTOR } from "./image-pool";
import {
  pickVisionImage,
  resolveRetreatVision,
} from "./resolve-retreat-vision";
import { vectorFingerprint } from "./vector-fingerprint";

describe("resolveRetreatVision", () => {
  it("returns a stable local asset URL", () => {
    const artifact = resolveRetreatVision({ vector: NEUTRAL_VECTOR });
    expect(artifact.imageUrl).toMatch(/^\/aesthetics\/visions\/.+\.jpg$/);
    expect(artifact.source).toBe("curated");
    expect(artifact.fingerprint).toBe(vectorFingerprint(NEUTRAL_VECTOR));
  });

  it("boosts images the user resonated with", () => {
    const without = pickVisionImage({
      ...NEUTRAL_VECTOR,
      desert: 0.2,
      ocean: 0.55,
    });
    const withResonance = pickVisionImage(
      { ...NEUTRAL_VECTOR, desert: 0.2, ocean: 0.55 },
      [{ imageId: "desert-dunes", reaction: "resonate" }],
    );
    expect(withResonance.id).toBe("desert-dunes");
    expect(without.id).not.toBe("desert-dunes");
  });

  it("includes intention in fingerprint and prompt", () => {
    const artifact = resolveRetreatVision({
      vector: NEUTRAL_VECTOR,
      intention: "quiet reset",
    });
    expect(artifact.prompt).toContain("quiet reset");
    expect(artifact.fingerprint).toContain("quiet reset");
  });
});
