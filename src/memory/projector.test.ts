import { describe, expect, it } from "vitest";
import { projectMemoryForActor } from "./projector";
import { EMPTY_MEMORY } from "./semantic-memory";
import type { Episode } from "@/episodes/model";
import type { MatchResult } from "@/matching/types";

const baseIntention = {
  version: 1,
  statement: "find a quiet week",
  constraints: { energy: "settled" as const, budget: "1k-2k" as const },
  changeReason: "Initial intention",
  createdAt: "2024-06-01T00:00:00.000Z",
};

function mkMatch(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    id: "match",
    retreatRootHash: "bali-ubud-stillness-0001",
    retreatTitle: "Ubud Stillness Retreat",
    retreatDescription: "Seven silent days.",
    retreatLocation: "Ubud, Bali",
    durationDays: 7,
    priceUsd: 1800,
    capacity: 12,
    practiceStyle: ["gentle vinyasa", "yin"],
    score: 0.82,
    headline: "A quiet reset.",
    reasoning: [],
    attestationCount: 1,
    attestor: "0x0",
    attestedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mkEpisode(overrides: Partial<Episode> = {}): Episode {
  return {
    schemaVersion: 1,
    id: "ep",
    actorId: "actor-1",
    revision: 1,
    status: "ready",
    intentions: [baseIntention],
    processedIdempotencyKeys: [],
    events: [],
    createdAt: "2024-06-01T00:00:00.000Z",
    updatedAt: "2024-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("projectMemoryForActor", () => {
  it("returns EMPTY_MEMORY-shaped output when no episodes exist", () => {
    const result = projectMemoryForActor("actor-1", []);
    expect(result).toEqual(EMPTY_MEMORY);
    expect(result.isReturning).toBe(false);
    expect(result.provider).toBe("none");
  });

  it("returns isReturning=false for episodes that never reached recommendation", () => {
    const episodes = [
      mkEpisode({
        status: "capturing",
        intentions: [
          { ...baseIntention, statement: "" },
        ],
      }),
    ];
    const result = projectMemoryForActor("actor-1", episodes);
    expect(result.isReturning).toBe(false);
    expect(result.pastMatches).toHaveLength(0);
    expect(result.pastBookings).toHaveLength(0);
  });

  it("derives pastMatches from episodes with a surfaced recommendation", () => {
    const episodes = [
      mkEpisode({
        updatedAt: "2024-06-02T00:00:00.000Z",
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: mkMatch(),
          alternatives: [],
          uncertainties: [],
          generatedAt: "2024-06-02T00:00:00.000Z",
        },
      }),
    ];
    const result = projectMemoryForActor("actor-1", episodes);
    expect(result.isReturning).toBe(true);
    expect(result.pastMatches).toEqual([
      { title: "Ubud Stillness Retreat", location: "Ubud, Bali", score: 0.82 },
    ]);
  });

  it("records pastBookings only when commitment.status is booked", () => {
    const episodes = [
      mkEpisode({
        commitment: {
          status: "booked",
          bookingRootHash: "0xbooking",
          depositTxId: "0xdeposit",
          bookedAt: "2024-06-03T00:00:00.000Z",
        },
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: mkMatch({ retreatTitle: "Tulum Cenote" }),
          alternatives: [],
          uncertainties: [],
          generatedAt: "2024-06-03T00:00:00.000Z",
        },
      }),
    ];
    const result = projectMemoryForActor("actor-1", episodes);
    expect(result.isReturning).toBe(true);
    expect(result.pastBookings).toEqual([
      { title: "Tulum Cenote", location: "Ubud, Bali" },
    ]);
  });

  it("preserves newest-first ordering for pastMatches across multiple episodes", () => {
    const episodes = [
      mkEpisode({
        updatedAt: "2024-06-04T00:00:00.000Z",
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: mkMatch({ retreatTitle: "Newest match" }),
          alternatives: [],
          uncertainties: [],
          generatedAt: "2024-06-04T00:00:00.000Z",
        },
      }),
      mkEpisode({
        id: "ep2",
        updatedAt: "2024-06-02T00:00:00.000Z",
        recommendation: {
          intentionVersion: 1,
          rankingPolicyVersion: "intention.v1",
          result: mkMatch({ retreatTitle: "Older match" }),
          alternatives: [],
          uncertainties: [],
          generatedAt: "2024-06-02T00:00:00.000Z",
        },
      }),
    ];
    const result = projectMemoryForActor("actor-1", episodes);
    expect(result.pastMatches.map((m) => m.title)).toEqual([
      "Newest match",
      "Older match",
    ]);
  });

  it("orders energyHistory oldest-first so the tail is the most recent", () => {
    const episodes = [
      mkEpisode({
        updatedAt: "2024-06-04T00:00:00.000Z",
        intentions: [
          { ...baseIntention, version: 2, constraints: { energy: "low", budget: "1k-2k" } },
          { ...baseIntention, constraints: { energy: "settled", budget: "1k-2k" } },
        ],
      }),
      mkEpisode({
        id: "ep2",
        updatedAt: "2024-06-01T00:00:00.000Z",
        intentions: [
          { ...baseIntention, constraints: { energy: "sharp", budget: "1k-2k" } },
        ],
      }),
    ];
    const result = projectMemoryForActor("actor-1", episodes);
    expect(result.energyHistory).toEqual([
      "sharp", // oldest episode, newest-first per episode appends last
      "settled",
      "low",
    ]);
  });

  it("skips intentions without a recorded energy constraint", () => {
    const episodes = [
      mkEpisode({
        intentions: [
          { ...baseIntention, constraints: {} },
          { ...baseIntention, constraints: { energy: "in-movement" } },
        ],
      }),
    ];
    const result = projectMemoryForActor("actor-1", episodes);
    expect(result.energyHistory).toEqual(["in-movement"]);
  });

  it("throws nothing on malformed inputs and never returns provider != 'none'", () => {
    const result = projectMemoryForActor("actor-1", []);
    // Recognition gate in matchLetter() branches on this; the projector
    // never accidentally upgrades the semantic flag itself.
    expect(result.provider).toBe("none");
    expect(result.pastNotes).toEqual([]);
    expect(result.rawRecall).toEqual([]);
  });
});
