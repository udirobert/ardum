import { describe, expect, it } from "vitest";
import { reasoningBeat } from "./mira-voice";
import type { MatchResult } from "@/matching/types";

function makeResult(): MatchResult {
  return {
    id: "r1",
    retreatRootHash: "hash-1",
    retreatTitle: "Stillwater Retreat",
    retreatDescription: "A gentle reset.",
    retreatLocation: "Big Sur",
    durationDays: 5,
    priceUsd: 1800,
    capacity: 8,
    practiceStyle: ["restorative", "yin"],
    score: 0.88,
    headline: "Held for someone arriving low.",
    reasoning: [
      {
        axis: "Energy alignment",
        given: "Practitioner energy: low. Retreat fits: low, settled.",
        when: "Both list 'low' — direct match.",
        then: "Strong energy fit; pulls toward this match.",
        weight: 0.35,
      },
      {
        axis: "Social comfort",
        given: "Practitioner comfort: solo. Retreat fits: solo, small-circle.",
        when: "Practitioner's comfort overlaps the retreat's social register.",
        then: "Cohort shape matches stated comfort.",
        weight: 0.25,
      },
      {
        axis: "Budget",
        given: "Retreat $1,800. Practitioner band: 1k-2k.",
        when: "Price fits inside the band's ceiling.",
        then: "Budget constraint satisfied.",
        weight: 0.15,
      },
    ],
    attestationCount: 1,
  };
}

describe("reasoningBeat", () => {
  it("emits constraints + pool + conclusion without a top pick", () => {
    const steps = reasoningBeat(
      undefined,
      undefined,
      { energy: "low", budget: "1k-2k", social: "solo" },
      3,
    );
    expect(steps.map((s) => s.text)).toEqual([
      "Let me sit with what you've told me.",
      "You asked for low energy, 1k-2k budget, solo comfort.",
      "I'm weighing 3 retreats against that.",
      "One sits closest.",
    ]);
    // Delays are monotonic.
    const delays = steps.map((s) => s.delayMs);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
  });

  it("surfaces the top pick's strongest axes when provided", () => {
    const top = makeResult();
    const steps = reasoningBeat(top, undefined, { energy: "low" }, 3);
    const texts = steps.map((s) => s.text);
    expect(texts).toContain("Strong energy fit; pulls toward this match.");
    expect(texts).toContain("Cohort shape matches stated comfort.");
    expect(texts[texts.length - 1]).toBe("One sits closest.");
  });

  it("surfaces considered-and-rejected when an alternative is provided", () => {
    const top = makeResult();
    const alt: MatchResult = {
      ...makeResult(),
      retreatTitle: "Mountain Flow",
      score: 0.72,
      reasoning: [
        {
          axis: "Energy alignment",
          given: "Practitioner energy: low. Retreat fits: in-movement.",
          when: "'low' is not in the retreat's energy register.",
          then: "Energy register doesn't match; retreat will feel mis-pitched.",
          weight: 0.35,
        },
        {
          axis: "Social comfort",
          given: "Practitioner comfort: solo. Retreat fits: open-circle.",
          when: "No overlap in stated social registers.",
          then: "Cohort shape is mismatched; expect social friction.",
          weight: 0.25,
        },
      ],
    };
    const steps = reasoningBeat(top, alt, { energy: "low" }, 3);
    const rejected = steps.find((s) => s.text.includes("Mountain Flow"));
    expect(rejected).toBeDefined();
    expect(rejected!.text).toContain("16 points lower");
    expect(rejected!.text).toContain("Energy register doesn't match");
  });

  it("skips display-only axes (weight 0) when surfacing reasoning", () => {
    const top: MatchResult = {
      ...makeResult(),
      reasoning: [
        {
          axis: "Energy alignment",
          given: "g",
          when: "w",
          then: "Strong energy fit.",
          weight: 0.35,
        },
        {
          axis: "Breath cycle",
          given: "g",
          when: "w",
          then: "Cycle timing aligns.",
          weight: 0, // display-only
        },
      ],
    };
    const steps = reasoningBeat(top, undefined, { energy: "low" }, 2);
    const texts = steps.map((s) => s.text);
    expect(texts).toContain("Strong energy fit.");
    expect(texts).not.toContain("Cycle timing aligns.");
  });
});
