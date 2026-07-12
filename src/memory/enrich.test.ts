import { describe, expect, it } from "vitest";
import { projectActorMemory } from "./enrich";
import { projectMemoryForActor } from "./projector";
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
