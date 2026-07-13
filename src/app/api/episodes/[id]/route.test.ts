// Server-side contract: episode detail includes server-projected miraPresence.

import { describe, expect, it, vi } from "vitest";

const { TEST_ACTOR_ID } = vi.hoisted(() => ({
  TEST_ACTOR_ID: crypto.randomUUID(),
}));

vi.mock("@/identity/actor", () => ({
  resolveActor: vi.fn().mockResolvedValue(TEST_ACTOR_ID),
  verifyActorCookie: vi.fn().mockReturnValue(TEST_ACTOR_ID),
}));

vi.mock("@/memory/cognee", () => ({
  cogneeMemory: undefined,
}));

import { EPISODE_SCHEMA_VERSION, type Episode } from "@/episodes/model";
import { episodeRepository } from "@/episodes/repository";
import { GET } from "./route";

const FIXTURE_CREATED_AT = "2026-07-15T00:00:00.000Z";

function makeMonitoringFixture(): Episode {
  return {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    actorId: TEST_ACTOR_ID,
    revision: 1,
    status: "monitoring",
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
        createdAt: FIXTURE_CREATED_AT,
      },
    ],
    monitor: {
      status: "active",
      watchFor: ["availability"],
      nextCheckAt: FIXTURE_CREATED_AT,
      observations: [],
    },
    processedIdempotencyKeys: [],
    events: [],
    createdAt: FIXTURE_CREATED_AT,
    updatedAt: FIXTURE_CREATED_AT,
  };
}

describe("GET /api/episodes/[id]", () => {
  it("returns miraPresence projected from episode operational state", async () => {
    const fixture = makeMonitoringFixture();
    await episodeRepository.create(fixture);

    const request = new Request(`http://localhost/api/episodes/${fixture.id}`);
    const response = await GET(request, {
      params: Promise.resolve({ id: fixture.id }),
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.miraPresence).toEqual({
      posture: "watching",
      valence: expect.any(Number),
    });
    expect(body.nextDecision).toBeTruthy();
    expect(body.episode.id).toBe(fixture.id);
    expect(body.memory).toBeTruthy();
  });
});
