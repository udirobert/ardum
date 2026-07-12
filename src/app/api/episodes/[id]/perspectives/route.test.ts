// Server-side test that enforces the broadened source-of-truth rule
// committed in 2075a69:
//
//   "Derived ranking views (lens re-rankings and similar) never
//    mutate episode state."
//
// Today the only derived-view surface is the lens toggle (GET
// /api/episodes/[id]/perspectives). The route handler reads the
// episode, scores three re-rankings over the existing practitioner
// profile and evidence, and returns the JSON payload. If a future
// contributor adds a side-effecting call — appending an event,
// bumping updatedAt, flipping status, adjusting a hold — this test
// fails before the change ships and the broader rule loses its only
// automated guard.

import { describe, expect, it, vi } from "vitest";

// Actor id for this test. Computed once per process via vi.hoisted
// so the value is available to the mock factory's closures
// regardless of vitest's import-order quirks (only vi.mock, not
// arbitrary const declarations, is hoisted automatically). The
// local in-memory adapter treats actorId as an opaque key; the
// Supabase adapter's create() upserts into public.actors (id
// column `uuid primary key`, see scripts/migrations/001-episodes.sql).
// A non-UUID string would fail a real-connection run; a freshly
// minted UUID works in either binding and is unique across reruns.
const { TEST_ACTOR_ID } = vi.hoisted(() => ({
  TEST_ACTOR_ID: crypto.randomUUID(),
}));

// Mock the actor resolution at the module boundary before importing
// the route. Both exports are stubbed so a future contributor
// adding either call site to the route does not crash on an
// undefined import binding. The cookie/signature path is
// deliberately not exercised here — the rule under test is about
// state, not auth.
vi.mock("@/identity/actor", () => ({
  resolveActor: vi.fn().mockResolvedValue(TEST_ACTOR_ID),
  verifyActorCookie: vi.fn().mockReturnValue(TEST_ACTOR_ID),
}));

import { EPISODE_SCHEMA_VERSION, type Episode } from "@/episodes/model";
import { episodeRepository } from "@/episodes/repository";
import { GET } from "./route";

const FIXTURE_CREATED_AT = "2026-07-15T00:00:00.000Z";

// Minimal `ready` episode that the lens handler can score over.
// Mirrors the shape from src/episodes/perspectives.test.ts so the
// helper returns a non-null perspectives payload (the canonical
// success path of the surface under test). Crypto-random id avoids
// singleton collisions across neighbouring tests.
function makeReadyFixture(): Episode {
  return {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    actorId: TEST_ACTOR_ID,
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
        createdAt: FIXTURE_CREATED_AT,
      },
    ],
    processedIdempotencyKeys: [],
    events: [],
    createdAt: FIXTURE_CREATED_AT,
    updatedAt: FIXTURE_CREATED_AT,
  };
}

describe("GET /api/episodes/[id]/perspectives", () => {
  it("preserves episode revision — broadened AGENTS.md derived-views rule", async () => {
    // Seed: a fully-constrained, owned episode the lens handler can
    // successfully score.
    const fixture = makeReadyFixture();
    await episodeRepository.create(fixture);

    // Baseline: capture every field the local adapter stores.
    // local.ts getOwned returns a structuredClone; whatever the
    // handler does internally cannot be detected by reference
    // comparison, only by a value comparison against the live store
    // after the call returns.
    const before = await episodeRepository.getOwned(
      TEST_ACTOR_ID,
      fixture.id,
    );
    expect(before).toBeDefined();

    // Act: invoke the route handler directly. Next.js 15+ requires
    // `context.params` to be a Promise; wrap accordingly.
    const request = new Request(
      `http://localhost/api/episodes/${fixture.id}/perspectives`,
    );
    const context = { params: Promise.resolve({ id: fixture.id }) };
    const response = await GET(request, context);

    // Sanity: the handler should return 200 with a perspectives
    // payload and no error key (success-path semantics). The
    // fixture has all three primary constraints, so the helper
    // returns real entries, not the all-null fallback.
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      perspectives?: Record<string, unknown>;
      error?: string;
    };
    expect(body.perspectives).toBeDefined();
    expect(body.error).toBeUndefined();

    // The broadened rule, primary assertion: revision is unchanged.
    const after = await episodeRepository.getOwned(
      TEST_ACTOR_ID,
      fixture.id,
    );
    expect(after).toBeDefined();
    expect(after?.revision).toBe(before?.revision);

    // Belt-and-braces: any other field a future contributor might
    // mutate silently (events appended, updatedAt advanced, status
    // flipped, hold adjusted, monitor tick moved) is caught by
    // deep equality against the persisted baseline.
    expect(after).toEqual(before);
  });
});
