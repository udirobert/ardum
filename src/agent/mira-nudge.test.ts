import { describe, expect, it } from "vitest";
import { hasNudge, nudgeForEpisode } from "./mira-voice";
import type { MatchResult } from "@/matching/types";
import type { Episode } from "@/episodes/model";

function makeMatch(overrides: Partial<MatchResult> = {}): MatchResult {
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
    attestationCount: 3,
    ...overrides,
  };
}

function mkEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    schemaVersion: 1,
    id: "ep-1",
    actorId: "actor-1",
    revision: 1,
    status: "ready",
    intentions: [
      {
        version: 1,
        statement: "find a quiet week",
        constraints: { energy: "settled", budget: "1k-2k" },
        changeReason: "Initial intention",
        createdAt: "2024-06-01T00:00:00.000Z",
      },
    ],
    recommendation: {
      intentionVersion: 1,
      rankingPolicyVersion: "intention.v1",
      result: makeMatch(),
      alternatives: [],
      uncertainties: [],
      generatedAt: "2024-06-01T00:00:00.000Z",
    },
    processedIdempotencyKeys: [],
    events: [],
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("nudgeForEpisode", () => {
  // ── Pre-hold: recommendation surfaced ──

  it("returns uncertainty nudge when uncertainties exist", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "recommendation-ready",
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: makeMatch(),
          alternatives: [],
          uncertainties: ["whether the silence is held or imposed"],
          generatedAt: "2024-06-01T00:00:00.000Z",
        },
      }),
    );
    expect(nudge?.kind).toBe("uncertainty");
    expect(nudge?.text).toContain("whether the silence is held or imposed");
  });

  it("returns thin-trust nudge when attestation count is 1", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "recommendation-ready",
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: makeMatch({ attestationCount: 1 }),
          alternatives: [],
          uncertainties: [],
          generatedAt: "2024-06-01T00:00:00.000Z",
        },
      }),
    );
    expect(nudge?.kind).toBe("thin-trust");
    expect(nudge?.text).toContain("One practitioner has vouched");
  });

  it("returns provisional-fit nudge when score is below 0.7", () => {
    const match = makeMatch({
      score: 0.55,
      reasoning: [
        {
          axis: "Energy alignment",
          given: "g",
          when: "w",
          then: "Strong energy fit; pulls toward this match.",
          weight: 0.35,
        },
        {
          axis: "Budget",
          given: "g",
          when: "w",
          then: "Budget constraint not satisfied.",
          weight: 0.05,
        },
      ],
    });
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "recommendation-ready",
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: match,
          alternatives: [],
          uncertainties: [],
          generatedAt: "2024-06-01T00:00:00.000Z",
        },
      }),
    );
    expect(nudge?.kind).toBe("provisional-fit");
    expect(nudge?.text).toContain("provisional fit");
  });

  it("returns idle nudge when recommendation is strong with no issues", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "recommendation-ready",
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: makeMatch({ score: 0.88, attestationCount: 5 }),
          alternatives: [],
          uncertainties: [],
          generatedAt: "2024-06-01T00:00:00.000Z",
        },
      }),
    );
    expect(nudge?.kind).toBe("idle");
    expect(nudge?.text).toContain("I'm here");
  });

  // ── Post-hold: monitoring ──

  it("returns price-drop nudge when observed price is lower", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "held",
        hold: {
          id: "hold-1",
          retreatId: "r1",
          status: "active",
          expiresAt: "2024-06-10T00:00:00.000Z",
          createdAt: "2024-06-01T00:00:00.000Z",
          provider: "local",
        },
        monitor: {
          status: "active",
          watchFor: ["price"],
          nextCheckAt: "2024-06-02T00:00:00.000Z",
          observations: [
            {
              id: "obs-1",
              available: true,
              priceUsd: 1500,
              observedAt: "2024-06-01T12:00:00.000Z",
              summary: "Price dropped.",
            },
          ],
        },
      }),
    );
    expect(nudge?.kind).toBe("price-drop");
    expect(nudge?.text).toContain("$1,500");
  });

  it("returns slot-opened nudge when availability transitions from false to true", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "monitoring",
        monitor: {
          status: "active",
          watchFor: ["availability"],
          nextCheckAt: "2024-06-02T00:00:00.000Z",
          observations: [
            {
              id: "obs-1",
              available: false,
              priceUsd: 1800,
              observedAt: "2024-06-01T06:00:00.000Z",
              summary: "No availability.",
            },
            {
              id: "obs-2",
              available: true,
              priceUsd: 1800,
              observedAt: "2024-06-01T12:00:00.000Z",
              summary: "Slot opened.",
            },
          ],
        },
      }),
    );
    expect(nudge?.kind).toBe("slot-opened");
  });

  it("does not return slot-opened when availability was already true", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "monitoring",
        monitor: {
          status: "active",
          watchFor: ["availability"],
          nextCheckAt: "2024-06-02T00:00:00.000Z",
          observations: [
            {
              id: "obs-1",
              available: true,
              priceUsd: 1800,
              observedAt: "2024-06-01T06:00:00.000Z",
              summary: "Available.",
            },
            {
              id: "obs-2",
              available: true,
              priceUsd: 1800,
              observedAt: "2024-06-01T12:00:00.000Z",
              summary: "Still available.",
            },
          ],
        },
      }),
    );
    // No price drop, no slot transition — should fall through to idle
    // or hold-expiring depending on hold state. No hold here → idle.
    expect(nudge?.kind).not.toBe("slot-opened");
  });

  it("returns hold-expiring nudge when hold is near expiry", () => {
    const now = Date.parse("2024-06-02T13:00:00.000Z");
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "held",
        hold: {
          id: "hold-1",
          retreatId: "r1",
          status: "active",
          expiresAt: "2024-06-02T14:00:00.000Z",
          createdAt: "2024-06-01T00:00:00.000Z",
          provider: "local",
        },
      }),
      now,
    );
    expect(nudge?.kind).toBe("hold-expiring");
    expect(nudge?.text).toContain("expires in");
  });

  // ── Post-booking: preparation arc ──

  it("returns preparation-ready nudge when within the 5-day arc", () => {
    const now = Date.parse("2024-06-02T00:00:00.000Z");
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "booked",
        commitment: {
          status: "booked",
          bookingRootHash: "0x1",
          depositTxId: "0x2",
          bookedAt: "2024-06-01T00:00:00.000Z",
        },
      }),
      now,
    );
    expect(nudge?.kind).toBe("preparation-ready");
  });

  it("returns preparation-complete nudge after the 5-day arc", () => {
    const now = Date.parse("2024-06-10T00:00:00.000Z");
    const nudge = nudgeForEpisode(
      mkEpisode({
        status: "booked",
        commitment: {
          status: "booked",
          bookingRootHash: "0x1",
          depositTxId: "0x2",
          bookedAt: "2024-06-01T00:00:00.000Z",
        },
      }),
      now,
    );
    expect(nudge?.kind).toBe("preparation-complete");
  });

  // ── Default ──

  it("returns reaching nudge when capturing (no recommendation yet)", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({ status: "capturing" }),
    );
    expect(nudge?.kind).toBe("reaching");
    expect(nudge?.text).toContain("make space for");
  });

  it("returns reaching nudge for paused episodes", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({ status: "paused" }),
    );
    expect(nudge?.kind).toBe("reaching");
  });

  it("returns idle nudge for a strong recommendation with no uncertainties", () => {
    const nudge = nudgeForEpisode(
      mkEpisode({ status: "ready" }),
    );
    expect(nudge?.kind).toBe("idle");
  });
});

describe("hasNudge", () => {
  it("returns true when a non-idle nudge is available", () => {
    expect(
      hasNudge(
        mkEpisode({
          status: "recommendation-ready",
          recommendation: {
            intentionVersion: 1,
            rankingPolicyVersion: "intention.v1",
            result: makeMatch(),
            alternatives: [],
            uncertainties: ["whether the silence is held or imposed"],
            generatedAt: "2024-06-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(true);
  });

  it("returns false for the reaching nudge (capturing — companionable, not urgent)", () => {
    expect(hasNudge(mkEpisode({ status: "capturing" }))).toBe(false);
  });

  it("returns false for a strong recommendation with no issues", () => {
    expect(
      hasNudge(
        mkEpisode({
          status: "recommendation-ready",
          recommendation: {
            intentionVersion: 1,
            rankingPolicyVersion: "intention.v1",
            result: makeMatch({ score: 0.88, attestationCount: 5 }),
            alternatives: [],
            uncertainties: [],
            generatedAt: "2024-06-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(false);
  });
});
