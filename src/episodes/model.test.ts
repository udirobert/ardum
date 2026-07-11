import { describe, expect, it } from "vitest";
import {
  EPISODE_SCHEMA_VERSION,
  currentIntention,
  nextDecision,
  type Episode,
} from "./model";

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
});
