// Server-side test that enforces the broadened AGENTS.md
// source-of-truth rule (committed in 2075a69) against the new
// counterfactual energy endpoint:
//
//   "Derived ranking views (lens re-rankings and similar) never
//    mutate episode state."
//
// Mirrors the budget test (commit 13f0092) and the lens test
// (commit 3343142):
//   - vi.hoisted for a per-process UUID-shaped actorId so the mock
//     factory closures can reference it without TDZ risk.
//   - vi.mock("@/identity/actor") at the module boundary, both
//     exports stubbed so the module shape stays complete.
//   - Direct GET invocation against the route handler, with the
//     Next.js 15+ context.params-as-Promise shape.
//   - Asserts response.status === 200, body shape, body.error
//     undefined, after.revision === before.revision, and
//     expect(after).toEqual(before) as belt-and-braces against
//     any silent mutation.

import { describe, expect, it, vi } from "vitest";

// Per-process stable UUID-shaped actor id. The repository
// dispatcher at src/episodes/repository.ts selects either the
// local or Supabase adapter depending on env vars; the Supabase
// adapter writes through to PostgreSQL where the actors table's
// id column is `uuid primary key` (see
// scripts/migrations/001-episodes.sql). A typed UUID literal
// works in both bindings.
const { TEST_ACTOR_ID } = vi.hoisted(() => ({
  TEST_ACTOR_ID: crypto.randomUUID(),
}));

vi.mock("@/identity/actor", () => ({
  resolveActor: vi.fn().mockResolvedValue(TEST_ACTOR_ID),
  verifyActorCookie: vi.fn().mockReturnValue(TEST_ACTOR_ID),
}));

import { EPISODE_SCHEMA_VERSION, type Episode } from "@/episodes/model";
import { episodeRepository } from "@/episodes/repository";
import { GET } from "./route";

const FIXTURE_CREATED_AT = "2026-07-15T00:00:00.000Z";

// Minimal `ready` episode so the lens helper (via currentIntention)
// finds every primary constraint and can produce a top pick on every
// override energy state. Mirrors the budget-test fixture shape.
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

describe("GET /api/episodes/[id]/counterfactual-energy", () => {
  it("preserves episode revision \u2014 broadened AGENTS.md derived-views rule", async () => {
    // Seed: a fully-constrained, owned episode the helper can score.
    const fixture = makeReadyFixture();
    await episodeRepository.create(fixture);

    // Baseline: capture every field the local adapter stores. The
    // adapter returns a structuredClone on read, so before/after
    // are independent value fetches against the live store.
    const before = await episodeRepository.getOwned(TEST_ACTOR_ID, fixture.id);
    expect(before).toBeDefined();

    // Act: directly invoke the route handler with a valid energy.
    const request = new Request(
      `http://localhost/api/episodes/${fixture.id}/counterfactual-energy?energy=settled`,
    );
    const context = { params: Promise.resolve({ id: fixture.id }) };
    const response = await GET(request, context);

    // Sanity: 200 with a counterfactual payload and no error key.
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      counterfactual?: { topRanked?: unknown };
      error?: string;
    };
    expect(body.counterfactual).toBeDefined();
    expect(body.error).toBeUndefined();

    // Primary rule assertion: revision is unchanged after the GET.
    const after = await episodeRepository.getOwned(TEST_ACTOR_ID, fixture.id);
    expect(after).toBeDefined();
    expect(after?.revision).toBe(before?.revision);

    // Belt-and-braces: any silent side-effect (event append, hold
    // adjustment, monitor tick advance, updatedAt bump) is caught
    // by deep equality against the persisted baseline.
    expect(after).toEqual(before);
  });

  it("returns 400 for an invalid energy", async () => {
    const fixture = makeReadyFixture();
    await episodeRepository.create(fixture);

    const request = new Request(
      `http://localhost/api/episodes/${fixture.id}/counterfactual-energy?energy=hyper`,
    );
    const context = { params: Promise.resolve({ id: fixture.id }) };
    const response = await GET(request, context);

    // 400 boundary: the value must be one of the closed enum.
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBeDefined();
    expect(body.error).toContain("Invalid energy");
  });

  it("evaluates an alternative energy and returns a payload", async () => {
    const fixture = makeReadyFixture();
    await episodeRepository.create(fixture);

    // Successful happy-path against a different energy state than
    // the fixture's stated one (low). Pick "sharp" so the helper
    // exercises the opposite end of the axis register; the energy
    // axis is binary-ish in score, so a state swap is more likely
    // to flip the top pick than a budget swap.
    const request = new Request(
      `http://localhost/api/episodes/${fixture.id}/counterfactual-energy?energy=sharp`,
    );
    const context = { params: Promise.resolve({ id: fixture.id }) };
    const response = await GET(request, context);

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      counterfactual?: { topRanked: unknown };
      error?: string;
    };
    expect(body.counterfactual).toBeDefined();
    expect(body.counterfactual).not.toBeNull();
    expect(body.error).toBeUndefined();
  });
});
