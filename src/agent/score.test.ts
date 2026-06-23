// Unit tests for the deterministic matcher. Pure functions — no I/O, no
// network, no env. Covers the cases the demo depends on plus the budget
// and breath-cycle helpers.

import { describe, expect, it } from "vitest";

import {
  scoreAll,
  scoreRetreat,
} from "@/agent/score";
import type { AttestationIndex } from "@/attestation/schema";
import type {
  PractitionerProfile,
  PoseBaseline,
} from "@/calibration/schema";
import {
  SEED_ATTESTATIONS,
} from "@/lib/seed-attestations";

// Helpers --------------------------------------------------------------

function byRootHash(map: Map<string, AttestationIndex>, rootHash: string) {
  const a = map.get(rootHash);
  if (!a) throw new Error(`Missing seed: ${rootHash}`);
  return a;
}

function pool(): Map<string, AttestationIndex> {
  const m = new Map<string, AttestationIndex>();
  for (const a of SEED_ATTESTATIONS) {
    m.set(a.rootHash, {
      rootHash: a.rootHash,
      kind: a.kind,
      title: a.title,
      description: a.description,
      claims: a.claims,
      createdAt: a.createdAt,
    });
  }
  return m;
}

function profile(overrides: Partial<PractitionerProfile>): PractitionerProfile {
  return {
    energy: overrides.energy ?? "settled",
    budget: overrides.budget ?? "1k-2k",
    social: overrides.social ?? "small-circle",
    pose: overrides.pose,
    notes: overrides.notes,
    createdAt: overrides.createdAt ?? "2026-06-23T00:00:00.000Z",
  };
}

function pose(overrides: Partial<PoseBaseline>): PoseBaseline {
  return {
    shoulderMobility: overrides.shoulderMobility ?? "open",
    hipMobility: overrides.hipMobility ?? "open",
    breathPhase: overrides.breathPhase ?? "even",
    confidence: overrides.confidence ?? 0.85,
  };
}

function attestations(): AttestationIndex[] {
  return Array.from(pool().values());
}

// Top-match correctness ------------------------------------------------

describe("scoreAll — top match correctness", () => {
  it("ranks Sidemen first for low + solo + under-1k", () => {
    const ranked = scoreAll(
      profile({ energy: "low", social: "solo", budget: "under-1k" }),
      attestations()
    );
    expect(ranked[0].result.retreatTitle).toBe("Sidemen Restoration Retreat");
    expect(ranked[0].result.score).toBeGreaterThan(0.4);
  });

  it("ranks Canggu Movement first for sharp + communal + 2k-3k", () => {
    const ranked = scoreAll(
      profile({ energy: "sharp", social: "communal", budget: "2k-3k" }),
      attestations()
    );
    expect(ranked[0].result.retreatTitle).toBe(
      "Canggu Movement Intensive"
    );
  });

  it("ranks Ubud Stillness first for settled + small-circle + 1k-2k", () => {
    const ranked = scoreAll(
      profile({
        energy: "settled",
        social: "small-circle",
        budget: "1k-2k",
      }),
      attestations()
    );
    expect(ranked[0].result.retreatTitle).toBe("Ubud Stillness Retreat");
  });

  it("is deterministic for the same input", () => {
    const p = profile({ energy: "low", social: "solo", budget: "under-1k" });
    const a = scoreAll(p, attestations());
    const b = scoreAll(p, attestations());
    expect(a.map((r) => r.result.id)).toEqual(b.map((r) => r.result.id));
  });
});

// Score bounds ----------------------------------------------------------

describe("scoreAll — score bounds", () => {
  it("every match score is in [0, 1]", () => {
    const inputs: PractitionerProfile[] = [
      profile({ energy: "low", social: "solo", budget: "under-1k" }),
      profile({ energy: "sharp", social: "communal", budget: "2k-3k" }),
      profile({ energy: "settled", social: "open-circle", budget: "3k-plus" }),
      profile({
        energy: "in-movement",
        social: "small-circle",
        budget: "1k-2k",
        pose: pose({ breathPhase: "shallow" }),
      }),
    ];
    for (const p of inputs) {
      for (const { result } of scoreAll(p, attestations())) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it("all five retreats are ranked for every input", () => {
    const ranked = scoreAll(
      profile({ energy: "settled", social: "solo", budget: "1k-2k" }),
      attestations()
    );
    expect(ranked).toHaveLength(5);
  });
});

// Reasoning shape -------------------------------------------------------

describe("scoreRetreat — reasoning shape", () => {
  const a = byRootHash(pool(), "bali-ubud-stillness-0001");

  it("every step has axis / given / when / then / weight", () => {
    const { steps } = scoreRetreat(
      profile({ energy: "settled", social: "solo", budget: "1k-2k" }),
      a
    );
    for (const step of steps) {
      expect(step.axis).toBeTruthy();
      expect(step.given).toBeTruthy();
      expect(step.when).toBeTruthy();
      expect(step.then).toBeTruthy();
      expect(step.weight).toBeGreaterThanOrEqual(0);
      expect(step.weight).toBeLessThanOrEqual(1);
    }
  });

  it("without a pose baseline, emits fewer axes", () => {
    const withPose = scoreRetreat(
      profile({
        energy: "settled",
        social: "solo",
        budget: "1k-2k",
        pose: pose({}),
      }),
      a
    );
    const withoutPose = scoreRetreat(
      profile({ energy: "settled", social: "solo", budget: "1k-2k" }),
      a
    );
    // Without pose: no Breath cycle step, no Mobility hint step.
    expect(withoutPose.steps.find((s) => s.axis === "Breath cycle")).toBeUndefined();
    expect(withoutPose.steps.find((s) => s.axis === "Mobility hint")).toBeUndefined();
    expect(withPose.steps.length).toBeGreaterThan(withoutPose.steps.length);
  });

  it("includes a 'Breath cycle' step only when both retreat has a cycle and practitioner has pose", () => {
    // Sidemen has a breath cycle.
    const sidemen = byRootHash(pool(), "bali-sidemen-restoration-0003");
    const withPose = scoreRetreat(
      profile({
        energy: "low",
        social: "solo",
        budget: "1k-2k",
        pose: pose({ breathPhase: "extended" }),
      }),
      sidemen
    );
    expect(withPose.steps.find((s) => s.axis === "Breath cycle")).toBeDefined();

    const noPose = scoreRetreat(
      profile({ energy: "low", social: "solo", budget: "1k-2k" }),
      sidemen
    );
    expect(noPose.steps.find((s) => s.axis === "Breath cycle")).toBeUndefined();
  });
});

// Headline honesty ------------------------------------------------------

describe("scoreRetreat — headline", () => {
  it("is one sentence and doesn't reference axes", () => {
    const { result } = scoreRetreat(
      profile({ energy: "settled", social: "solo", budget: "1k-2k" }),
      byRootHash(pool(), "bali-ubud-stillness-0001")
    );
    expect(result.headline).toBeTruthy();
    expect(result.headline.length).toBeLessThan(140);
  });

  it("is honest about a partial match when neither energy nor social match", () => {
    // Canggu Movement fits 'sharp' and 'communal'; ask for 'low' + 'solo'
    // and the headline should not pretend it's a strong match.
    const { result } = scoreRetreat(
      profile({ energy: "low", social: "solo", budget: "under-1k" }),
      byRootHash(pool(), "bali-canggu-movement-0002")
    );
    // The "worth seeing" copy is reserved for retreats that match neither axis.
    expect(result.headline.toLowerCase()).toContain("partial");
  });
});

// Pose baseline improves scoring ---------------------------------------

describe("scoreAll — pose baseline improves signal", () => {
  it("pose baseline with breathPhase matching retreat's character raises the score", () => {
    // Sidemen has a 6-2-8-0 cycle (avg 16s) — "extended" character.
    const sidemen = byRootHash(pool(), "bali-sidemen-restoration-0003");

    const withoutPose = scoreRetreat(
      profile({ energy: "low", social: "solo", budget: "1k-2k" }),
      sidemen
    ).result;

    const withExtendedPose = scoreRetreat(
      profile({
        energy: "low",
        social: "solo",
        budget: "1k-2k",
        pose: pose({ breathPhase: "extended" }),
      }),
      sidemen
    ).result;

    expect(withExtendedPose.score).toBeGreaterThan(withoutPose.score);
  });
});
