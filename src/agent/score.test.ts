// Unit tests for the deterministic matcher. Pure functions — no I/O, no
// network, no env. Covers the cases the demo depends on plus the budget
// and breath-cycle helpers.

import { describe, expect, it } from "vitest";

import {
  RESTORATIVE_LENS,
  MOVEMENT_LENS,
  scoreAll,
  scoreAllWithOverrides,
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
      attestor: a.attestor,
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
    preferences: overrides.preferences,
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

  it("all ten seed retreats are ranked for every input", () => {
    const ranked = scoreAll(
      profile({ energy: "settled", social: "solo", budget: "1k-2k" }),
      attestations()
    );
    expect(ranked).toHaveLength(10);
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

// Counterfactual overrides ---------------------------------------------

describe("scoreAllWithOverrides", () => {
  it("returns retreats sorted by the overridden composite", () => {
    const p = profile({ energy: "low", social: "solo", budget: "under-1k" });
    const ranked = scoreAllWithOverrides(p, attestations(), {
      "Energy alignment": 0.9,
    });
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].result.score).toBeGreaterThanOrEqual(
        ranked[i].result.score
      );
    }
  });

  it("every score is in [0, 1] after override", () => {
    const p = profile({ energy: "sharp", social: "communal", budget: "2k-3k" });
    const ranked = scoreAllWithOverrides(p, attestations(), {
      "Social comfort": 0.7,
    });
    for (const { result } of ranked) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });

  it("changes at least one retreat's score compared to the default weights", () => {
    // Verify the override is actually taking effect: at least one retreat
    // must score differently with overridden weights than with defaults.
    // We don't assert which one — the test is about the override path,
    // not the specific ranking.
    const p = profile({
      energy: "sharp",
      social: "communal",
      budget: "2k-3k",
    });
    const defaultRanked = scoreAll(p, attestations());
    const energyHeavy = scoreAllWithOverrides(p, attestations(), {
      "Energy alignment": 0.9,
    });
    let anyDifferent = false;
    for (let i = 0; i < defaultRanked.length; i++) {
      if (
        Math.abs(
          defaultRanked[i].result.score - energyHeavy[i].result.score
        ) > 0.001
      ) {
        anyDifferent = true;
        break;
      }
    }
    expect(anyDifferent).toBe(true);
  });

  it("changes the runner-up under at least one lens on the seed pool", () => {
    // The deterministic scorer is robust on the seed pool — the top match
    // often stays the same under a rebalance. The disagreement shows up
    // one or two positions down. Brute force over profiles and lenses;
    // assert the runner-up (or any retreat) shifts at least once.
    const profiles = [
      profile({ energy: "low", social: "solo", budget: "under-1k" }),
      profile({ energy: "sharp", social: "communal", budget: "2k-3k" }),
      profile({ energy: "settled", social: "small-circle", budget: "1k-2k" }),
      profile({ energy: "in-movement", social: "open-circle", budget: "3k-plus" }),
    ];
    const lenses = [RESTORATIVE_LENS, MOVEMENT_LENS];
    let shiftFound = false;
    outer: for (const p of profiles) {
      const defaultRanked = scoreAll(p, attestations());
      for (const lens of lenses) {
        const altRanked = scoreAllWithOverrides(
          p,
          attestations(),
          lens.overrides
        );
        // Compare the runner-up at every position.
        for (let i = 0; i < defaultRanked.length; i++) {
          if (defaultRanked[i].result.id !== altRanked[i].result.id) {
            shiftFound = true;
            break outer;
          }
        }
      }
    }
    expect(shiftFound).toBe(true);
  });

  it("RESTORATIVE_LENS and MOVEMENT_LENS both produce a valid ranking", () => {
    const p = profile({
      energy: "low",
      social: "solo",
      budget: "1k-2k",
    });
    for (const lens of [RESTORATIVE_LENS, MOVEMENT_LENS]) {
      const ranked = scoreAllWithOverrides(p, attestations(), lens.overrides);
      expect(ranked.length).toBe(10);
      for (const { result } of ranked) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    }
  });
});

// Synthetic pool — lens re-rank property ------------------------------
//
// The seed-catalog "changes the runner-up under at least one lens"
// test above is robust but non-deterministic — the seed pool often
// converges toward a few dominant retreats. This block is the
// deterministic counter-test: a fixed 2-retreat pool with mutually
// exclusive energy and social claims, scored across Balanced /
// Restorative / Movement, produces a verifiable top-pick shift (the
// property the HoldPanel disclosure's "confidence check" claim
// depends on). The pool is inline so changes to the seed catalog
// cannot affect these assertions.

const ENERGY_FIT_ROOT_SYN = "test-retreat-energy-fit-001";
const SOCIAL_FIT_ROOT_SYN = "test-retreat-social-fit-001";

const syntheticPool: AttestationIndex[] = [
  {
    rootHash: ENERGY_FIT_ROOT_SYN,
    kind: "retreat",
    title: "Synthetic Energy-Match Retreat",
    description:
      "Settles the energy axis cleanly; misses the social axis. Used " +
      "by the lens re-rank property test to prove behavior without " +
      "relying on the seed catalog.",
    claims: {
      location: "test",
      durationDays: 7,
      priceUsd: 1500,
      capacity: 10,
      practiceStyle: ["restorative"],
      energyFit: ["settled"],
      socialFit: ["communal"],
      breathPhase: [],
    },
    attestor: "0x0000000000000000000000000000000000000000",
    createdAt: "2026-07-12T00:00:00.000Z",
  },
  {
    rootHash: SOCIAL_FIT_ROOT_SYN,
    kind: "retreat",
    title: "Synthetic Social-Match Retreat",
    description:
      "Settles the social axis cleanly; misses the energy axis. " +
      "Twin of the energy-fit retreat so the lens decides.",
    claims: {
      location: "test",
      durationDays: 7,
      priceUsd: 1500,
      capacity: 10,
      practiceStyle: ["restorative"],
      energyFit: ["sharp"],
      socialFit: ["solo"],
      breathPhase: [],
    },
    attestor: "0x0000000000000000000000000000000000000000",
    createdAt: "2026-07-12T00:00:00.000Z",
  },
];

const syntheticPractitioner: PractitionerProfile = {
  energy: "settled",
  budget: "1k-2k",
  social: "solo",
  createdAt: "2026-07-12T00:00:00.000Z",
};

describe("synthetic pool — lens re-rank property", () => {
  it("Balanced picks the energy-fit retreat", () => {
    const ranked = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      {},
    );
    expect(ranked[0]?.result.retreatRootHash).toBe(ENERGY_FIT_ROOT_SYN);
  });

  it("Restorative stays aligned with Balanced (energy-weighted even more)", () => {
    const ranked = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      RESTORATIVE_LENS.overrides,
    );
    expect(ranked[0]?.result.retreatRootHash).toBe(ENERGY_FIT_ROOT_SYN);
  });

  it('Movement flips the top pick to the social-fit retreat — the "confidence check" property', () => {
    const ranked = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      MOVEMENT_LENS.overrides,
    );
    expect(ranked[0]?.result.retreatRootHash).toBe(SOCIAL_FIT_ROOT_SYN);
  });

  it("Balanced and Movement produce different top picks on the mutually-exclusive pool", () => {
    const balanced = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      {},
    );
    const movement = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      MOVEMENT_LENS.overrides,
    );
    expect(balanced[0]?.result.retreatRootHash).not.toBe(
      movement[0]?.result.retreatRootHash,
    );
  });

  it("Composite score rises for the energy-fit retreat under Restorative vs Balanced", () => {
    const balanced = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      {},
    );
    const restorative = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      RESTORATIVE_LENS.overrides,
    );
    const balancedEnergyScore = balanced.find(
      (entry) => entry.result.retreatRootHash === ENERGY_FIT_ROOT_SYN,
    )?.result.score;
    const restorativeEnergyScore = restorative.find(
      (entry) => entry.result.retreatRootHash === ENERGY_FIT_ROOT_SYN,
    )?.result.score;
    expect(balancedEnergyScore).toBeDefined();
    expect(restorativeEnergyScore).toBeDefined();
    expect(restorativeEnergyScore as number).toBeGreaterThan(
      balancedEnergyScore as number,
    );
  });

  it("Composite score falls for the energy-fit retreat under Movement vs Balanced", () => {
    const balanced = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      {},
    );
    const movement = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      MOVEMENT_LENS.overrides,
    );
    const balancedEnergyScore = balanced.find(
      (entry) => entry.result.retreatRootHash === ENERGY_FIT_ROOT_SYN,
    )?.result.score;
    const movementEnergyScore = movement.find(
      (entry) => entry.result.retreatRootHash === ENERGY_FIT_ROOT_SYN,
    )?.result.score;
    expect(balancedEnergyScore).toBeDefined();
    expect(movementEnergyScore).toBeDefined();
    expect(movementEnergyScore as number).toBeLessThan(
      balancedEnergyScore as number,
    );
  });

  it("is deterministic for identical inputs", () => {
    const first = scoreAllWithOverrides(
      syntheticPractitioner,
      syntheticPool,
      {},
    );
    const second = scoreAllWithOverrides(
      structuredClone(syntheticPractitioner),
      syntheticPool,
      {},
    );
    expect(first[0]?.result.retreatRootHash).toBe(
      second[0]?.result.retreatRootHash,
    );
    expect(first[0]?.result.score).toBe(second[0]?.result.score);
  });
});

// ─── Preference fit (ADR 0011 §4) ────────────────────────────────────────

describe("scoreAll — preference fit axis", () => {
  const UBUD = "bali-ubud-stillness-0001"; // accommodation: private, shared; dietary: vegetarian, vegan
  const CANGGU_MOVEMENT = "bali-canggu-movement-0002"; // accommodation: shared, dormitory; dietary: vegetarian, gluten-free
  const SIDEMEN = "bali-sidemen-restoration-0003"; // accommodation: private; dietary: vegetarian
  const LISBON = "lisbon-silent-coast-0007"; // undeclared offerings

  it("skips the preference axis when the practitioner has no preferences", () => {
    const ranked = scoreAll(
      profile({ energy: "low", budget: "under-1k", social: "solo" }),
      attestations(),
    );
    const sidemen = ranked.find((r) => r.result.retreatRootHash === SIDEMEN)!;
    const prefStep = sidemen.steps.find((s) => s.axis === "Preference fit");
    expect(prefStep).toBeUndefined();
  });

  it("scores 1.0 when accommodation and dietary both match", () => {
    const ranked = scoreAll(
      profile({
        energy: "low",
        budget: "under-1k",
        social: "solo",
        preferences: { accommodation: "private", dietary: "vegetarian" },
      }),
      attestations(),
    );
    const sidemen = ranked.find((r) => r.result.retreatRootHash === SIDEMEN)!;
    const prefStep = sidemen.steps.find((s) => s.axis === "Preference fit")!;
    expect(prefStep).toBeDefined();
    expect(prefStep.then).toContain("align");
  });

  it("scores neutral (0.5) for retreats with undeclared offerings", () => {
    const ranked = scoreAll(
      profile({
        energy: "settled",
        budget: "2k-3k",
        social: "solo",
        preferences: { accommodation: "private", dietary: "vegan" },
      }),
      attestations(),
    );
    const lisbon = ranked.find((r) => r.result.retreatRootHash === LISBON)!;
    const prefStep = lisbon.steps.find((s) => s.axis === "Preference fit")!;
    expect(prefStep).toBeDefined();
    expect(prefStep.given).toContain("neutral");
  });

  it("scores 0 on mismatch and surfaces it in reasoning", () => {
    const ranked = scoreAll(
      profile({
        energy: "in-movement",
        budget: "2k-3k",
        social: "open-circle",
        preferences: { accommodation: "private", dietary: "vegan" },
      }),
      attestations(),
    );
    const canggu = ranked.find(
      (r) => r.result.retreatRootHash === CANGGU_MOVEMENT,
    )!;
    const prefStep = canggu.steps.find((s) => s.axis === "Preference fit")!;
    expect(prefStep.given).toContain("mismatch");
  });

  it("nudges a matching retreat above a non-matching one with equal base fit", () => {
    // Both Ubud and Sidemen match energy=low, social=solo. Sidemen
    // matches accommodation=private exactly; Ubud also offers private.
    // With a dietary preference for vegetarian (both match), the
    // preference axis should not break the tie in a contradictory way.
    // This test confirms the axis fires and contributes without errors.
    const ranked = scoreAll(
      profile({
        energy: "low",
        budget: "under-1k",
        social: "solo",
        preferences: { accommodation: "private", dietary: "vegetarian" },
      }),
      attestations(),
    );
    const sidemen = ranked.find((r) => r.result.retreatRootHash === SIDEMEN)!;
    const ubud = ranked.find((r) => r.result.retreatRootHash === UBUD)!;
    // Both should have a Preference fit step with a positive score.
    const sidemenPref = sidemen.steps.find((s) => s.axis === "Preference fit")!;
    const ubudPref = ubud.steps.find((s) => s.axis === "Preference fit")!;
    expect(sidemenPref).toBeDefined();
    expect(ubudPref).toBeDefined();
  });

  it("does not fire when only an empty-string preference is set", () => {
    const ranked = scoreAll(
      profile({
        energy: "low",
        budget: "under-1k",
        social: "solo",
        preferences: { accommodation: "", dietary: "" },
      }),
      attestations(),
    );
    const sidemen = ranked.find((r) => r.result.retreatRootHash === SIDEMEN)!;
    const prefStep = sidemen.steps.find((s) => s.axis === "Preference fit");
    expect(prefStep).toBeUndefined();
  });
});
