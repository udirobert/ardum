// Server-side test for the memory summary route. Mirrors the
// perspectives route test's setup: mock resolveActor at the module
// boundary, use the real local in-memory episode repository
// (vitest.config.ts environment: 'node' defaults to the local
// adapter — no Supabase env means no Supabase binding), exercise
// the projection + projector-only contract.
//
// Per-case isolation is mandatory: local.ts stores episodes in
// `globalThis.__ardumEpisodes`, a process-global Map. Test 1 seeds a
// booked episode; without resetting the Map before Test 2, that
// fixture still filters into listOwned() because both share the
// same TEST_ACTOR_ID, and Test 2's "isReturning === false" claim
// becomes a lie. contract.suite.ts uses the same globalThis.clear()
// reset pattern; this route test follows the same contract.
//
// The actor mock is hoisted via vi.hoisted so beforeEach holds a
// stable reference to the same vi.fn() that vi.mock() replaced —
// that lets every case start from a known default (TEST_ACTOR_ID)
// and lets Case 3 safely queue mockResolvedValueOnce(null) without
// leaking across test ordering.
//
// Why the env-mask vi.mock is inlined here (not in a shared helper):
// two attempts to DRY the override into src/test-utils/localRepoOnly
// failed in this codebase:
//   1. A side-effect `import "@/test-utils/localRepoOnly"` did not
//      register the vi.mock — vitest's transform only hoists vi.mock
//      calls within the file that declares them.
//   2. Exporting the factory from the helper and importing it here
//      hit a temporal-dead-zone error at hoist time
//      (ReferenceError: Cannot access '__vi_import_*' before
//      initialization) — the imported const is in the TDZ when the
//      hoisted vi.mock call references it.
// The inline form below is the canonical vitest 3 pattern: the
// factory body is hoisted whole along with the call, so the mock
// is registered before the route handler loads and evaluates
// hasSupabase(). A future contributor who reaches for "this should
// be DRY'd" should re-derive the above failure modes first.
//
// What is pinned:
//   1. Returning practitioner (booked history) → isReturning: true,
//      pastBookings[0], pastMatches[0] populated correctly.
//   2. Practitioner with empty history (no episodes) → memory
//      is the EMPTY_MEMORY shape (isReturning: false).
//   3. Actor cookie absent → { memory: null } (no inference from
//      absence).

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  EPISODE_SCHEMA_VERSION,
  RANKING_POLICY_VERSION,
  type Episode,
} from "@/episodes/model";
import { episodeRepository } from "@/episodes/repository";
import { GET } from "./route";

const { TEST_ACTOR_ID, resolveActorMock } = vi.hoisted(() => ({
  TEST_ACTOR_ID: crypto.randomUUID(),
  // A single vi.fn() that vi.mock() rebinds to the route's
  // resolveActor import. Holding the reference here means
  // beforeEach can re-establish a clean default between cases
  // even when one case queues a transient override.
  resolveActorMock: vi.fn(),
}));

vi.mock("@/identity/actor", () => ({
  resolveActor: resolveActorMock,
}));

// Hoisted to the top of this file by vitest's transform. Forces
// hasSupabase() to return false so the episodeRepository aggregator
// uses the local in-memory adapter instead of real Supabase — the
// developer's .env.local may export SUPABASE_URL, which would
// otherwise silently route listOwned() to a live database and the
// globalThis.__ardumEpisodes.clear() reset in beforeEach would clear
// an idle map, leaking Test 1's seeded fixture into Test 2. The
// override is confined to this test file only; supabase.test.ts and
// the Supabase contract suite load without this vi.mock and see the
// real hasSupabase().
vi.mock("@/lib/env", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  return { ...actual, hasSupabase: () => false };
});

beforeEach(() => {
  // Wipe the local in-memory episode map so each case starts empty.
  // Without this, Test 1's seeded booked fixture — filtered to
  // TEST_ACTOR_ID — would leak into Test 2's "no history" claim.
  // globalThis.__ardumEpisodes is the same Map the local adapter's
  // closure points at (see src/episodes/repositories/local.ts), so
  // an in-place clear() resets it without replacing the reference.
  globalThis.__ardumEpisodes?.clear();
  // Default: an authenticated visitor so all cases that don't
  // override see the TEST_ACTOR_ID owner. Case 3 queues a
  // one-shot null override on top of this default.
  resolveActorMock.mockReset();
  resolveActorMock.mockResolvedValue(TEST_ACTOR_ID);
});

const NOW = "2026-07-20T00:00:00.000Z";

// A booked episode: an actor that holds a recommendation and has
// committed to it. Used to drive isReturning=true with a populated
// pastBooking. Field shapes must match `Episode` (src/episodes/model.ts):
//   - RecommendationSnapshot needs intentionVersion + rankingPolicyVersion.
//   - commitment uses bookingRootHash + depositTxId (NOT retreatRootHash
//     + depositTxHash — those names belong to the recommendation).
function makeBookedFixture(title: string): Episode {
  return {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    actorId: TEST_ACTOR_ID,
    revision: 1,
    status: "completed",
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
        createdAt: NOW,
      },
    ],
    processedIdempotencyKeys: [],
    events: [],
    recommendation: {
      intentionVersion: 1,
      rankingPolicyVersion: RANKING_POLICY_VERSION,
      result: {
        id: `att-${title}`,
        retreatRootHash: `att-${title}`,
        retreatTitle: title,
        retreatDescription: "A week of slow practice in the mountains.",
        retreatLocation: "Boulder, Colorado",
        durationDays: 7,
        priceUsd: 1800,
        capacity: 12,
        practiceStyle: ["yin", "meditation"],
        score: 0.82,
        headline: "Held for someone arriving low.",
        reasoning: [],
        attestationCount: 1,
        attestor: "0xabc",
        attestedAt: NOW,
      },
      alternatives: [],
      uncertainties: [],
      generatedAt: NOW,
    },
    commitment: {
      status: "booked",
      bookingRootHash: `att-${title}`,
      depositTxId: "0xdeposit",
      bookedAt: NOW,
    },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("GET /api/memory", () => {
  it("returns a populated MemoryContext for a returning practitioner", async () => {
    const fixture = makeBookedFixture("Stillwater Cabin");
    await episodeRepository.create(fixture);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      memory: {
        isReturning: boolean;
        pastBookings: { title: string }[];
        pastMatches: { title: string }[];
      } | null;
    };
    expect(body.memory).not.toBeNull();
    expect(body.memory?.isReturning).toBe(true);
    expect(body.memory?.pastBookings[0]?.title).toBe("Stillwater Cabin");
    expect(body.memory?.pastMatches[0]?.title).toBe("Stillwater Cabin");
  });

  it("returns isReturning:false EMPTY_MEMORY for an actor with no episodes", async () => {
    // beforeEach ran: listOwned returns the empty array, the pure
    // projector returns EMPTY_MEMORY. Provider must stay "none"
    // because this route is projector-only.
    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      memory: {
        isReturning: boolean;
        pastBookings: unknown[];
        pastMatches: unknown[];
        provider: string;
      } | null;
    };
    expect(body.memory).not.toBeNull();
    expect(body.memory?.isReturning).toBe(false);
    expect(body.memory?.pastBookings).toEqual([]);
    expect(body.memory?.pastMatches).toEqual([]);
    expect(body.memory?.provider).toBe("none");
  });

  it("returns { memory: null } when no ownership cookie is present", async () => {
    // Queue a single override: the next resolveActor() call returns
    // null. beforeEach's mockReset() at the next test reverts this.
    resolveActorMock.mockResolvedValueOnce(null);

    const response = await GET();
    expect(response.status).toBe(200);
    const body = (await response.json()) as { memory: unknown };
    expect(body.memory).toBeNull();
  });
});
