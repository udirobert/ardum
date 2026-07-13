import { describe, expect, it } from "vitest";
import { NEUTRAL_VECTOR } from "./image-pool";
import { vectorToVisionPrompt } from "./vision-prompt";

describe("vectorToVisionPrompt", () => {
  it("includes intention when provided", () => {
    const prompt = vectorToVisionPrompt(NEUTRAL_VECTOR, "rest after burnout");
    expect(prompt).toContain("rest after burnout");
    expect(prompt).toContain("Cinematic retreat vision");
  });

  it("prefers warm tone when vector leans warm", () => {
    const prompt = vectorToVisionPrompt({
      ...NEUTRAL_VECTOR,
      warm: 0.9,
      cool: 0.1,
    });
    expect(prompt).toContain("warm terracotta");
  });

  it("prefers cool tone when vector leans cool", () => {
    const prompt = vectorToVisionPrompt({
      ...NEUTRAL_VECTOR,
      warm: 0.1,
      cool: 0.9,
    });
    expect(prompt).toContain("cool slate mist");
  });

  it("includes dominant environments above threshold", () => {
    const prompt = vectorToVisionPrompt({
      ...NEUTRAL_VECTOR,
      ocean: 0.8,
      mountain: 0.7,
      jungle: 0.2,
    });
    expect(prompt).toContain("ocean coastline");
    expect(prompt).toContain("mountain mist");
    expect(prompt).not.toContain("jungle canopy");
  });

  it("omits people, text, and logos", () => {
    const prompt = vectorToVisionPrompt(NEUTRAL_VECTOR);
    expect(prompt).toContain("No people, no text, no logos");
  });
});
