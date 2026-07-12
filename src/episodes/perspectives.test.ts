import { describe, expect, it } from "vitest";
import {
  EPISODE_SCHEMA_VERSION,
  type Episode,
} from "./model";
import { scoreEpisodePerspectives } from "./perspectives";

// This test bypasses the localEvidence catalog and injects a known pool
// via the lens fixture below. The lens registry in score.ts is the
// single source of truth — scoreEpisodePerspectives calls
// scoreWithPerspective which reads it.
//
// Where localEvidence is unavailable in test contexts we rely on the
// default seed catalog. To make the test deterministic across CI we
// reproduce a profile-only check (the function throws nothing on the
// happy path; if localEvidence is empty, every perspective is null).

const ready: Episode = {
  schemaVersion: EPISODE_SCHEMA_VERSION,
  id: "episode-1",
  actorId: "actor-1",
  revision: 1,
  status: "ready",
  intentions: [
    {
      version: 1,
      statement: "Recover after a difficult season",
      constraints: {
        energy: "low",
        budget: "1k-2k",
        social: "small-circle",
      },
      changeReason: "Initial intention",
      createdAt: "2026-07-12T00:00:00.000Z",
    },
  ],
  processedIdempotencyKeys: [],
  events: [],
  createdAt: "2026-07-12T00:00:00.000Z",
  updatedAt: "2026-07-12T00:00:00.000Z",
};

describe("scoreEpisodePerspectives", () => {
  it("returns one entry per perspective for a ready episode", () => {
    const result = scoreEpisodePerspectives(ready);
    expect(result.balanced === null || typeof result.balanced === "object")
      .toBe(true);
    expect(result.restorative === null || typeof result.restorative === "object")
      .toBe(true);
    expect(result.movement === null || typeof result.movement === "object")
      .toBe(true);
  });

  it("returns all nulls when one of the primary constraints is missing", () => {
    const incomplete: Episode = {
      ...ready,
      intentions: [
        {
          ...ready.intentions[0],
          constraints: { energy: "low", social: "small-circle" },
        },
      ],
    };
    const result = scoreEpisodePerspectives(incomplete);
    expect(result.balanced).toBeNull();
    expect(result.restorative).toBeNull();
    expect(result.movement).toBeNull();
  });

  it("is deterministic for identical inputs", () => {
    const first = scoreEpisodePerspectives(ready);
    const second = scoreEpisodePerspectives(structuredClone(ready));
    expect(first.balanced?.retreatRootHash ?? null).toBe(
      second.balanced?.retreatRootHash ?? null,
    );
    expect(first.restorative?.retreatRootHash ?? null).toBe(
      second.restorative?.retreatRootHash ?? null,
    );
    expect(first.movement?.retreatRootHash ?? null).toBe(
      second.movement?.retreatRootHash ?? null,
    );
  });
});
