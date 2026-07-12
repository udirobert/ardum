import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { projectActorMemory } from "./enrich";
import { projectMemoryForActor } from "./projector";
import { cogneeMemory } from "./cognee";
import type { Episode } from "@/episodes/model";
import type { MatchResult } from "@/matching/types";
import type {
  SemanticMemory,
  SemanticSnippet,
} from "./semantic-memory";

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

// Build a SemanticMemory stub. The default recall returns []. Each
// case flips one knob to exercise its branch. `throwBefore` models a
// Cognee that rejects the request outright; `delayMs` models one that
// resolves late enough to trip the recallTimeoutMs.
//
// Kept parameter-less on the SemanticMemory methods (`remember`,
// `recall`, `forget`) because the stub doesn't read those arguments —
// the tests don't need them. Lint-clean and a touch easier to read.
function mkSemantic(
  opts: {
    recallItems?: SemanticSnippet[];
    delayMs?: number;
    throwBefore?: boolean;
  } = {},
): SemanticMemory {
  return {
    remember: async () => {},
    forget: async () => {},
    recall: async () => {
      if (opts.throwBefore) throw new Error("simulated Cognee failure");
      if (opts.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      }
      return opts.recallItems ?? [];
    },
  };
}

const episodesWithMatch = (): Episode[] => [
  mkEpisode({
    recommendation: {
      intentionVersion: 1,
      rankingPolicyVersion: "intention.v1",
      result: mkMatch(),
      alternatives: [],
      uncertainties: [],
      generatedAt: "2024-06-01T00:00:00.000Z",
    },
  }),
];

describe("projectActorMemory", () => {
  it("returns pure projector output when no semantic adapter is provided", async () => {
    const result = await projectActorMemory("actor-1", episodesWithMatch());
    const baseline = projectMemoryForActor("actor-1", episodesWithMatch());
    // Same shape as the baseline (we cannot compare references because
    // the baseline is a fresh object, but the structural equality is
    // the proof we want — no enrichment happened).
    expect(result).toEqual(baseline);
    expect(result.provider).toBe("none");
    expect(result.isReturning).toBe(true);
  });

  it("passes projector output through unchanged when recall returns empty", async () => {
    const semantic = mkSemantic({ recallItems: [] });
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      semantic,
    );
    expect(result.provider).toBe("none");
    expect(result.pastNotes).toEqual([]);
    expect(result.rawRecall).toEqual([]);
    expect(result.isReturning).toBe(true);
  });

  it("falls back to projector output when recall exceeds recallTimeoutMs", async () => {
    // Stub resolves with real items after 200ms — well past the 50ms
    // timeout we set in this test. expect withTimeout to resolve to
    // null and the projector output to be returned untouched. Delays
    // are kept short so the test doesn't leak a pending macrotask
    // past the assertion window.
    const semantic = mkSemantic({
      recallItems: [{ text: "late note", source: "diary" }],
      delayMs: 200,
    });
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      semantic,
      { recallTimeoutMs: 50 },
    );
    expect(result.provider).toBe("none");
    expect(result.pastNotes).toEqual([]);
    expect(result.rawRecall).toEqual([]);
  });

  it("falls back to projector output when recall rejects", async () => {
    // Cognee is allowed to be unreachable — the projection layer
    // cannot break an episode transition or first paint on its account.
    const semantic = mkSemantic({ throwBefore: true });
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      semantic,
    );
    expect(result.provider).toBe("none");
    expect(result.pastNotes).toEqual([]);
  });

  it("fills pastNotes and bumps provider to cognee when recall returns items within the deadline", async () => {
    const semantic = mkSemantic({
      recallItems: [
        { text: "first note", source: "diary" },
        { text: "second note", source: "diary" },
        { text: "third note", source: "diary" },
      ],
    });
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      semantic,
    );
    expect(result.provider).toBe("cognee");
    expect(result.pastNotes).toEqual([
      "first note",
      "second note",
      "third note",
    ]);
    expect(result.rawRecall).toHaveLength(3);
    // Operational fields stay populated regardless of semantic input.
    expect(result.isReturning).toBe(true);
    expect(result.pastMatches[0]?.title).toBe("Ubud Stillness Retreat");
  });

  it("caps pastNotes at five entries even when recall returns more", async () => {
    const semantic = mkSemantic({
      recallItems: Array.from({ length: 9 }, (_, i) => ({
        text: `note ${i}`,
        source: "diary",
      })),
    });
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      semantic,
    );
    expect(result.pastNotes).toHaveLength(5);
    expect(result.pastNotes[0]).toBe("note 0");
    expect(result.pastNotes[4]).toBe("note 4");
  });

  it("filters empty strings but keeps whitespace-only ones — pinning the current truthy behavior", async () => {
    // The current implementation uses .filter(Boolean). That removes
    // femptys but keeps whitespace-only strings (a "   " is truthy).
    // Pin both halves of the behavior so a future refactor (e.g.
    // swapping to .filter((t) => t.trim())) fails the suite explicitly.
    const semantic = mkSemantic({
      recallItems: [
        { text: "real", source: "diary" },
        { text: "", source: "diary" },
        { text: "   ", source: "diary" },
        { text: "another real note", source: "diary" },
      ],
    });
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      semantic,
    );
    expect(result.pastNotes).toContain("real");
    expect(result.pastNotes).toContain("another real note");
    expect(result.pastNotes).toContain("   ");
    expect(result.pastNotes).not.toContain("");
  });
});

// Pairs with src/memory/cognee.test.ts: that file pins the
// Cognee adapter's HTTP contract in isolation. This block pins
// the bridge — projectActorMemory — against the REAL cogneeMemory
// with a mocked fetch. The mkSemantic stub above models delay and
// throw in-process; the cases here model the real fetch path that
// the stub skips: 200, 500, fetch-throw, and a fetch that resolves
// late enough to trip the 800ms withTimeout. Without this block,
// a Cognee API change (response shape, header, dataset prefix) or
// a transport failure (DNS, TLS, ECONNREFUSED) would silently
// degrade pastNotes and the practitioner would see the projector
// output without knowing the supplement failed.
describe("projectActorMemory with the real cogneeMemory (fetch mocked)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalBaseUrl: string | undefined;
  let originalApiKey: string | undefined;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    originalBaseUrl = process.env.COGNEE_BASE_URL;
    originalApiKey = process.env.COGNEE_API_KEY;
    process.env.COGNEE_BASE_URL = "https://cognee.test";
    process.env.COGNEE_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalBaseUrl === undefined) delete process.env.COGNEE_BASE_URL;
    else process.env.COGNEE_BASE_URL = originalBaseUrl;
    if (originalApiKey === undefined) delete process.env.COGNEE_API_KEY;
    else process.env.COGNEE_API_KEY = originalApiKey;
  });

  it("fills pastNotes from a real Cognee 200 response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          results: [{ text: "real note from Cognee", source: "diary" }],
        }),
        { status: 200 },
      ),
    );
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      cogneeMemory,
    );
    expect(result.provider).toBe("cognee");
    expect(result.pastNotes).toEqual(["real note from Cognee"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to projector output when the real Cognee delays past recallTimeoutMs", async () => {
    // Real Cognee resolves after 200ms with valid items. The
    // 50ms recallTimeoutMs we set in the test fires first, so
    // pastNotes stay empty. The 200ms delay (rather than the
    // full 800ms) keeps the test fast — we only need to
    // demonstrate that withTimeout resolves to null before the
    // fetch does. The 1000ms vitest timeout is a safety net for
    // the lingering setTimeout in the mock — vitest warns on
    // leaked timers.
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                new Response(
                  JSON.stringify({
                    results: [{ text: "late note", source: "diary" }],
                  }),
                  { status: 200 },
                ),
              ),
            200,
          ),
        ),
    );
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      cogneeMemory,
      { recallTimeoutMs: 50 },
    );
    expect(result.provider).toBe("none");
    expect(result.pastNotes).toEqual([]);
    // Projector passthrough: isReturning stays true because the
    // episode has a recommendation, regardless of the semantic
    // supplement.
    expect(result.isReturning).toBe(true);
  }, 1000);

  it("falls back to projector output when the real Cognee returns 500", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500 }),
    );
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      cogneeMemory,
    );
    expect(result.provider).toBe("none");
    expect(result.pastNotes).toEqual([]);
  });

  it("falls back to projector output when the real fetch throws", async () => {
    // The outter try/catch in cogneeMemory.recall() swallows the
    // network-layer error and returns []. Pins the contract: a
    // Cognee outage cannot break an episode transition or first
    // paint.
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    const result = await projectActorMemory(
      "actor-1",
      episodesWithMatch(),
      cogneeMemory,
    );
    expect(result.provider).toBe("none");
    expect(result.pastNotes).toEqual([]);
  });
});
