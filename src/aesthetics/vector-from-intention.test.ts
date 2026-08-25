import { describe, expect, it } from "vitest";
import { NEUTRAL_VECTOR } from "./image-pool";
import { vectorFromIntention } from "./vector-from-intention";

describe("vectorFromIntention", () => {
  it("returns NEUTRAL_VECTOR for empty text", () => {
    expect(vectorFromIntention("")).toBe(NEUTRAL_VECTOR);
    expect(vectorFromIntention("   ")).toBe(NEUTRAL_VECTOR);
  });

  it("returns NEUTRAL_VECTOR when no aesthetic signal is present", () => {
    expect(vectorFromIntention("I need to get this done")).toBe(NEUTRAL_VECTOR);
  });

  it("nudges ocean/calming/expansive for an ocean intention", () => {
    const v = vectorFromIntention("I want to be by the ocean, quiet and vast");
    expect(v.ocean).toBeGreaterThan(NEUTRAL_VECTOR.ocean);
    expect(v.calming).toBeGreaterThan(NEUTRAL_VECTOR.calming);
    expect(v.expansive).toBeGreaterThan(NEUTRAL_VECTOR.expansive);
  });

  it("nudges desert/warm/minimal for a desert intention", () => {
    const v = vectorFromIntention("A desert retreat, warm and simple");
    expect(v.desert).toBeGreaterThan(NEUTRAL_VECTOR.desert);
    expect(v.warm).toBeGreaterThan(NEUTRAL_VECTOR.warm);
    expect(v.minimal).toBeGreaterThan(NEUTRAL_VECTOR.minimal);
  });

  it("nudges forest/calming/intimate for a forest intention", () => {
    const v = vectorFromIntention("Quiet time in the forest, alone");
    expect(v.forest).toBeGreaterThan(NEUTRAL_VECTOR.forest);
    expect(v.calming).toBeGreaterThan(NEUTRAL_VECTOR.calming);
    expect(v.intimate).toBeGreaterThan(NEUTRAL_VECTOR.intimate);
  });

  it("clamps shifted values to [0, 1]", () => {
    const v = vectorFromIntention("dark night stars cave cold winter");
    expect(v.dark).toBeLessThanOrEqual(1);
    expect(v.dark).toBeGreaterThanOrEqual(0);
    expect(v.light).toBeLessThanOrEqual(1);
    expect(v.light).toBeGreaterThanOrEqual(0);
  });

  it("accumulates shifts from multiple matched rules", () => {
    const v = vectorFromIntention("warm ocean, quiet and expansive");
    expect(v.warm).toBeGreaterThan(NEUTRAL_VECTOR.warm);
    expect(v.ocean).toBeGreaterThan(NEUTRAL_VECTOR.ocean);
    expect(v.calming).toBeGreaterThan(NEUTRAL_VECTOR.calming);
  });

  it("is case-insensitive", () => {
    const lower = vectorFromIntention("i need the ocean");
    const upper = vectorFromIntention("I NEED THE OCEAN");
    expect(lower).toEqual(upper);
  });
});
