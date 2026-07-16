import { describe, expect, it } from "vitest";
import {
  EPISODE_SCHEMA_VERSION,
  currentIntention,
  nextDecision,
  type Episode,
} from "./model";
import type { MatchResult } from "@/matching/types";

function episode(constraints: Episode["intentions"][number]["constraints"]): Episode {
  return {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id: "episode-1",
    actorId: "actor-1",
    revision: 1,
    status: "clarifying",
    intentions: [
      {
        version: 1,
        statement: "Recover after a difficult launch",
        constraints,
        changeReason: "Initial intention",
        createdAt: "2026-07-11T00:00:00.000Z",
      },
    ],
    processedIdempotencyKeys: [],
    events: [],
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
  };
}

const fullConstraints = {
  energy: "low" as const,
  budget: "1k-2k" as const,
  social: "solo" as const,
};

const stubResult = {
  id: "r1",
  retreatRootHash: "hash-1",
  retreatTitle: "Quiet Valley",
  retreatDescription: "A place to rest.",
  retreatLocation: "Bali",
  durationDays: 5,
  priceUsd: 1200,
  capacity: 8,
  practiceStyle: ["rest"],
  score: 0.9,
  headline: "Rest",
  reasoning: [],
  attestationCount: 1,
  attestor: "0x0",
  attestedAt: "2026-07-11T00:00:00.000Z",
} satisfies MatchResult;

function withRecommendation(base: Episode): Episode {
  return {
    ...base,
    status: "recommendation-ready",
    recommendation: {
      intentionVersion: 1,
      rankingPolicyVersion: "intention.v1",
      result: stubResult,
      alternatives: [],
      uncertainties: [],
      generatedAt: "2026-07-11T00:00:00.000Z",
    },
  };
}

function withActiveHold(base: Episode): Episode {
  return {
    ...withRecommendation(base),
    status: "held",
    hold: {
      id: "hold-1",
      retreatId: "hash-1",
      status: "active",
      expiresAt: "2026-07-13T00:00:00.000Z",
      createdAt: "2026-07-11T00:00:00.000Z",
      provider: "local",
    },
  };
}

describe("episode decisions", () => {
  it("asks only for the next unresolved constraint", () => {
    expect(nextDecision(episode({})).kind).toBe("clarify-energy");
    expect(nextDecision(episode({ energy: "low" })).kind).toBe("clarify-budget");
    expect(
      nextDecision(episode({ energy: "low", budget: "1k-2k" })).kind,
    ).toBe("clarify-social");
  });

  it("moves to recommendation only when context is sufficient", () => {
    expect(
      nextDecision(
        episode({
          energy: "low",
          budget: "1k-2k",
          social: "small-circle",
        }),
      ).kind,
    ).toBe("review-recommendation");
  });

  it("treats the final intention revision as authoritative", () => {
    const value = episode({ energy: "low" });
    value.intentions.push({
      ...value.intentions[0],
      version: 2,
      statement: "Reconnect with my partner",
      changeReason: "The intention changed",
    });
    expect(currentIntention(value).statement).toBe("Reconnect with my partner");
  });

  it("opens solo ready-to-book after a hold without an invite branch", () => {
    const held = withActiveHold(episode(fullConstraints));
    const decision = nextDecision(held);
    expect(decision.kind).toBe("ready-to-book");
    expect(decision.primaryLabel).toBe("Secure my place");
  });

  it("awaits invite responses when the multi-party branch is open", () => {
    const held = withActiveHold(episode(fullConstraints));
    held.coordination = {
      sharingConsent: true,
      participantName: "Sam",
      inviteCreatedAt: "2026-07-11T00:00:00.000Z",
      inviteExpiresAt: "2026-07-12T00:00:00.000Z",
      responses: [],
    };
    held.status = "coordinating";
    expect(nextDecision(held).kind).toBe("await-responses");
  });

  it("unlocks ready-to-book when a participant says yes", () => {
    const held = withActiveHold(episode(fullConstraints));
    held.coordination = {
      sharingConsent: true,
      participantName: "Sam",
      inviteCreatedAt: "2026-07-11T00:00:00.000Z",
      inviteExpiresAt: "2026-07-12T00:00:00.000Z",
      responses: [
        {
          participantId: "p1",
          decision: "yes",
          respondedAt: "2026-07-11T01:00:00.000Z",
        },
      ],
    };
    held.status = "ready-to-book";
    const decision = nextDecision(held);
    expect(decision.kind).toBe("ready-to-book");
    expect(decision.primaryLabel).toBe("Secure my place");
  });

  it("returns to review-hold when invite responses are not a yes", () => {
    const held = withActiveHold(episode(fullConstraints));
    held.coordination = {
      sharingConsent: true,
      participantName: "Sam",
      inviteCreatedAt: "2026-07-11T00:00:00.000Z",
      inviteExpiresAt: "2026-07-12T00:00:00.000Z",
      responses: [
        {
          participantId: "p1",
          decision: "no",
          respondedAt: "2026-07-11T01:00:00.000Z",
        },
      ],
    };
    held.status = "coordinating";
    expect(nextDecision(held).kind).toBe("review-hold");
  });

  it("lands on preparation after commitment is recorded", () => {
    const booked = withActiveHold(episode(fullConstraints));
    booked.status = "booked";
    booked.hold = { ...booked.hold!, status: "converted" };
    booked.commitment = {
      status: "booked",
      bookingRootHash: "0g-booking-1",
      depositTxId: "0xtx-1",
      bookedAt: "2026-07-11T02:00:00.000Z",
    };
    const decision = nextDecision(booked);
    expect(decision.kind).toBe("preparation");
    expect(decision.prompt).toMatch(/booked/i);
  });
});
