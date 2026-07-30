import { beforeEach, describe, expect, it, vi } from "vitest";
import { EPISODE_SCHEMA_VERSION, type Episode } from "./model";
import { applyEpisodeCommand, createEpisode } from "./service";

vi.mock("./repository", () => ({
  episodeRepository: {
    getOwned: vi.fn(),
    get: vi.fn(),
    save: vi.fn((_actorId: string, episode: Episode) =>
      Promise.resolve(episode),
    ),
    create: vi.fn((episode) => Promise.resolve(episode)),
    createInvite: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock("@/identity/actor-profile", () => ({
  actorProfileRepository: {
    get: vi.fn(() => Promise.resolve({ profile: {}, preferredName: null })),
  },
}));
vi.mock("@/memory/observe", () => ({
  fireSemanticRemember: vi.fn(),
}));

import { episodeRepository } from "./repository";

const fixedClock = { now: () => new Date("2026-07-11T12:00:00.000Z") };
const fixedIds = { create: () => `id-${Math.random().toString(36).slice(2, 8)}` };

const fullConstraints = {
  energy: "low" as const,
  budget: "1k-2k" as const,
  social: "solo" as const,
};

function baseEpisode(
  overrides: Partial<Episode> = {},
): Episode {
  return {
    schemaVersion: EPISODE_SCHEMA_VERSION,
    id: "ep-1",
    actorId: "actor-1",
    revision: 3,
    status: "ready",
    intentions: [
      {
        version: 1,
        statement: "Recover after a difficult launch",
        constraints: { ...fullConstraints },
        changeReason: "Initial intention",
        createdAt: "2026-07-11T00:00:00.000Z",
      },
    ],
    processedIdempotencyKeys: [],
    events: [],
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    ...overrides,
  };
}

function episodeWithRecommendation(
  overrides: Partial<Episode> = {},
): Episode {
  return {
    ...baseEpisode(overrides),
    status: "recommendation-ready",
    recommendation: {
      intentionVersion: 1,
      rankingPolicyVersion: "intention.v1",
      result: {
        id: "match-1",
        retreatRootHash: "hash-first",
        retreatTitle: "Quiet Valley",
        retreatDescription: "A place to rest.",
        retreatLocation: "Ubud, Bali",
        durationDays: 5,
        priceUsd: 1200,
        capacity: 8,
        practiceStyle: ["rest", "breathwork"],
        score: 0.9,
        headline: "Rest deeply.",
        reasoning: [],
        attestationCount: 1,
        attestor: "0xabc",
        attestedAt: "2026-07-10T00:00:00.000Z",
      },
      alternatives: [
        {
          id: "match-2",
          retreatRootHash: "hash-second",
          retreatTitle: "Forest Stream",
          retreatDescription: "A place to breathe.",
          retreatLocation: "Chiang Mai",
          durationDays: 7,
          priceUsd: 1400,
          capacity: 12,
          practiceStyle: ["meditation"],
          score: 0.82,
          headline: "Breathe.",
          reasoning: [],
          attestationCount: 1,
          attestor: "0xdef",
          attestedAt: "2026-07-10T00:00:00.000Z",
        },
      ],
      uncertainties: ["You have not set a firm travel window yet."],
      generatedAt: "2026-07-11T00:00:00.000Z",
    },
  };
}

function stubRepo(episode: Episode): void {
  vi.mocked(episodeRepository.getOwned).mockResolvedValue(episode);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createEpisode", () => {
  it("requires a non-empty statement and consent", async () => {
    await expect(
      createEpisode("actor-1", { statement: "", persistenceConsent: true }, { clock: fixedClock, ids: fixedIds }),
    ).rejects.toThrow(/making space/);
    await expect(
      createEpisode("actor-1", { statement: "Rest", persistenceConsent: false }, { clock: fixedClock, ids: fixedIds }),
    ).rejects.toThrow(/consent/i);
  });

  it("starts in clarifying when constraints include energy", async () => {
    const ep = await createEpisode(
      "actor-1",
      { statement: "Rest", persistenceConsent: true, constraints: { energy: "low" } },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(ep.status).toBe("clarifying");
  });
});

describe("applyEpisodeCommand — recommend", () => {
  it("produces a recommendation from complete constraints", async () => {
    stubRepo(baseEpisode());
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "recommend", expectedRevision: 3 },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.status).toBe("recommendation-ready");
    expect(episode.recommendation?.result.retreatRootHash).toBeTruthy();
  });

  it("honours existing rejectedRetreats as exclusions", async () => {
    const ep = baseEpisode({ rejectedRetreats: ["hash-first"] });
    stubRepo(ep);
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "recommend", expectedRevision: 3 },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.recommendation!.result.retreatRootHash).not.toBe("hash-first");
  });
});

describe("applyEpisodeCommand — feedback", () => {
  it("throws when there is nothing to react to", async () => {
    stubRepo(baseEpisode());
    await expect(
      applyEpisodeCommand(
        "actor-1",
        "ep-1",
        { type: "feedback", expectedRevision: 3, reason: "timing" },
        { clock: fixedClock, ids: fixedIds },
      ),
    ).rejects.toThrow(/Nothing to react/);
  });

  it("timing: sets aside the current pick and promotes an alternative", async () => {
    stubRepo(episodeWithRecommendation());
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "feedback", expectedRevision: 3, reason: "timing" },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.status).toBe("recommendation-ready");
    expect(episode.rejectedRetreats).toContain("hash-first");
    expect(episode.recommendation!.result.retreatRootHash).not.toBe("hash-first");
    // Hold and coordination are cleared on set-aside
    expect(episode.hold).toBeUndefined();
    expect(episode.coordination).toBeUndefined();
  });

  it("place: behaves the same as timing (set-aside mechanics)", async () => {
    stubRepo(episodeWithRecommendation());
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "feedback", expectedRevision: 3, reason: "place" },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.rejectedRetreats).toContain("hash-first");
    expect(episode.recommendation!.result.retreatRootHash).not.toBe("hash-first");
  });

  it("budget: clears the budget constraint and returns to clarifying", async () => {
    stubRepo(episodeWithRecommendation());
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "feedback", expectedRevision: 3, reason: "budget" },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.status).toBe("clarifying");
    expect(episode.recommendation).toBeUndefined();
    const latest = episode.intentions.at(-1)!;
    expect(latest.constraints.budget).toBeUndefined();
    expect(latest.constraints.energy).toBe("low");
    expect(latest.constraints.social).toBe("solo");
  });

  it("group: clears the social constraint and returns to clarifying", async () => {
    stubRepo(episodeWithRecommendation());
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "feedback", expectedRevision: 3, reason: "group" },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.status).toBe("clarifying");
    const latest = episode.intentions.at(-1)!;
    expect(latest.constraints.social).toBeUndefined();
    expect(latest.constraints.budget).toBe("1k-2k");
  });

  it("intention: clears all three constraints", async () => {
    stubRepo(episodeWithRecommendation());
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "feedback", expectedRevision: 3, reason: "intention" },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.status).toBe("clarifying");
    const latest = episode.intentions.at(-1)!;
    expect(latest.constraints.energy).toBeUndefined();
    expect(latest.constraints.budget).toBeUndefined();
    expect(latest.constraints.social).toBeUndefined();
  });
});

describe("applyEpisodeCommand — reject-recommendation", () => {
  it("sets aside the named retreat and promotes another", async () => {
    stubRepo(episodeWithRecommendation());
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "reject-recommendation", expectedRevision: 3, retreatRootHash: "hash-first" },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.status).toBe("recommendation-ready");
    expect(episode.rejectedRetreats).toContain("hash-first");
    expect(episode.recommendation!.result.retreatRootHash).not.toBe("hash-first");
  });

  it("falls back to clarifying with empty constraints when the pool is exhausted", async () => {
    // Pre-seed rejectedRetreats with all catalog hashes except the current
    // top pick. Rejecting that last one exhausts the pool and triggers the
    // clarifying fallback with an empty-constraint intention revision.
    const ALL_HASHES = [
      "bali-ubud-stillness-0001",
      "bali-canggu-movement-0002",
      "bali-sidemen-restoration-0003",
      "bali-ubud-pranayama-0004",
      "bali-canggu-strength-0005",
      "tulum-cenote-intensive-0006",
      "lisbon-silent-coast-0007",
      "rishikesh-ashram-stay-0008",
      "nosara-surf-yin-0009",
      "joshua-tree-desert-silent-0010",
    ];
    const lastPick = ALL_HASHES[0];
    const ep = episodeWithRecommendation({
      rejectedRetreats: ALL_HASHES.slice(1),
    });
    // Override the recommendation result to be the one remaining hash
    ep.recommendation = {
      ...ep.recommendation!,
      result: { ...ep.recommendation!.result, retreatRootHash: lastPick },
      alternatives: [],
    };
    stubRepo(ep);
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "reject-recommendation", expectedRevision: 3, retreatRootHash: lastPick },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.status).toBe("clarifying");
    expect(episode.recommendation).toBeUndefined();
    const latest = episode.intentions.at(-1)!;
    expect(latest.constraints).toEqual({});
    expect(episode.rejectedRetreats).toContain(lastPick);
  });

  it("clears hold and coordination on rejection", async () => {
    const ep = episodeWithRecommendation({
      hold: {
        id: "hold-1",
        retreatId: "hash-first",
        status: "active",
        expiresAt: "2026-07-13T00:00:00.000Z",
        createdAt: "2026-07-11T00:00:00.000Z",
        provider: "local",
      },
      coordination: {
        sharingConsent: true,
        participantName: "Sam",
        inviteCreatedAt: "2026-07-11T00:00:00.000Z",
        inviteExpiresAt: "2026-07-12T00:00:00.000Z",
        responses: [],
      },
    });
    stubRepo(ep);
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      { type: "reject-recommendation", expectedRevision: 3, retreatRootHash: "hash-first" },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.hold).toBeUndefined();
    expect(episode.coordination).toBeUndefined();
  });
});

describe("applyEpisodeCommand — revise-intention", () => {
  it("merges constraints without clearing existing ones", async () => {
    const ep = baseEpisode();
    stubRepo(ep);
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      {
        type: "revise-intention",
        expectedRevision: 3,
        constraints: { budget: "2k-3k" },
        reason: "Budget shifted",
      },
      { clock: fixedClock, ids: fixedIds },
    );
    const latest = episode.intentions.at(-1)!;
    expect(latest.constraints.budget).toBe("2k-3k");
    expect(latest.constraints.energy).toBe("low");
    expect(latest.constraints.social).toBe("solo");
  });

  it("preserves rejectedRetreats across constraint revisions", async () => {
    const ep = baseEpisode({ rejectedRetreats: ["hash-first", "hash-second"] });
    stubRepo(ep);
    const { episode } = await applyEpisodeCommand(
      "actor-1",
      "ep-1",
      {
        type: "revise-intention",
        expectedRevision: 3,
        constraints: { energy: "settled" },
        reason: "Energy shifted",
      },
      { clock: fixedClock, ids: fixedIds },
    );
    expect(episode.rejectedRetreats).toEqual(["hash-first", "hash-second"]);
  });
});

describe("applyEpisodeCommand — revision guard", () => {
  it("rejects a stale expectedRevision", async () => {
    stubRepo(baseEpisode());
    await expect(
      applyEpisodeCommand(
        "actor-1",
        "ep-1",
        { type: "recommend", expectedRevision: 1 },
        { clock: fixedClock, ids: fixedIds },
      ),
    ).rejects.toThrow(/Refresh before trying again/);
  });
});
