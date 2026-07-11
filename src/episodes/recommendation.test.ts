import { describe, expect, it } from "vitest";
import { EPISODE_SCHEMA_VERSION, type Episode } from "./model";
import { recommendForEpisode } from "./recommendation";

const base: Episode = {
  schemaVersion: EPISODE_SCHEMA_VERSION,
  id: "episode-1",
  actorId: "actor-1",
  revision: 1,
  status: "ready",
  intentions: [
    {
      version: 1,
      statement: "Recover slowly after a difficult season",
      constraints: {
        energy: "low",
        budget: "1k-2k",
        social: "small-circle",
      },
      changeReason: "Initial intention",
      createdAt: "2026-07-11T00:00:00.000Z",
    },
  ],
  processedIdempotencyKeys: [],
  events: [],
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
};

describe("episode recommendation", () => {
  it("is deterministic for identical inputs", () => {
    const now = new Date("2026-07-11T12:00:00.000Z");
    const first = recommendForEpisode(base, now);
    const second = recommendForEpisode(structuredClone(base), now);
    expect(first.result.retreatRootHash).toBe(second.result.retreatRootHash);
    expect(first.result.score).toBe(second.result.score);
  });

  it("returns one recommendation while retaining internal alternatives", () => {
    const result = recommendForEpisode(
      base,
      new Date("2026-07-11T12:00:00.000Z"),
    );
    expect(result.result.retreatRootHash).toBeTruthy();
    expect(result.alternatives).toHaveLength(2);
    expect(result.uncertainties).toContain(
      "You have not set a firm travel window yet.",
    );
  });
});
